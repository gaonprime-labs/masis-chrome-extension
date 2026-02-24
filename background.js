// background.js - Service Worker (Unified API version)
// @ts-check - Enable type checking for this file

import { LRUCache } from './background/cache.js';
import { matchCharacterFolders } from './background/folder-matcher.js';

// 전역 캐시 (파싱 결과 캐싱)
const parseCache = new LRUCache(100);

/**
 * 프로젝트 URL 상수
 * 개발 환경: http://localhost:3000
 * 프로덕션: https://ark.gaonprime.com
 */
function getProjectUrl() {
  // 로컬 개발 시에는 localhost 사용, 배포 시에는 프로덕션 URL 사용
  const isDevelopment = !('update_url' in chrome.runtime.getManifest());
  return isDevelopment ? 'http://localhost:3000' : 'https://ark.gaonprime.com';
}

/**
 * Content script로부터 메시지 수신
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PARSE_AND_FIND_MULTIPLE') {
    handleParseAndFindMultiple(message.text, sendResponse);
    return true; // 비동기 응답
  }

  // 레거시 호환 (단일 인물)
  if (message.type === 'PARSE_AND_FIND') {
    handleParseAndFindLegacy(message.text, sendResponse);
    return true;
  }

  // 캐시 초기화 (디버깅용)
  if (message.type === 'CLEAR_CACHE') {
    parseCache.clear();
    sendResponse({ success: true });
    return true;
  }
});

/**
 * 통합 API를 사용한 다중 인물 이미지 선택 (NEW - Unified)
 *
 * 하드코딩 제로 원칙:
 * - LLM이 대화 전체를 분석하여 상황과 캐릭터를 이해
 * - 각 캐릭터의 모든 이미지를 시맨틱하게 평가
 * - 상황에 가장 적합한 이미지 1장을 선택
 *
 * @param {string} text - 파싱할 메시지 텍스트
 * @param {Function} sendResponse - 응답 콜백
 */
async function handleParseAndFindMultiple(text, sendResponse) {
  try {
    // 1. 프로젝트 URL 자동 설정
    const projectUrl = getProjectUrl();

    // 2. 설정 가져오기
    const config = await chrome.storage.local.get([
      'enabled',
      'folderId', // 부모 폴더 ID
      'folderTagsCache', // 폴더별 태그 캐시
      'characterMappings', // 캐릭터명 매핑
    ]);

    if (!config.enabled) {
      sendResponse({ success: false, error: 'Extension is disabled' });
      return;
    }

    if (!config.folderId) {
      sendResponse({ success: false, error: 'Parent folder not selected' });
      return;
    }

    // 3. 캐시 확인
    const cached = parseCache.get(text);
    if (cached) {
      sendResponse(cached);
      return;
    }

    // 4. 부모 폴더의 모든 자식 폴더 가져오기
    let allFolders;
    try {
      const foldersResponse = await fetch(`${projectUrl}/api/folders/${config.folderId}/children`);
      const foldersData = await foldersResponse.json();

      if (!foldersData.success) {
        throw new Error(foldersData.error || 'Failed to fetch folders');
      }

      allFolders = foldersData.data;
    } catch (error) {
      sendResponse({ success: false, error: 'Failed to fetch character folders: ' + error.message });
      return;
    }

    if (allFolders.length === 0) {
      sendResponse({
        success: false,
        error: 'No character folders found in parent folder',
      });
      return;
    }

    // 5. 각 폴더의 모든 이미지 가져오기 (병렬 처리)
    const characterFolders = await Promise.all(
      allFolders.map(async (folder) => {
        try {
          const imagesResponse = await fetch(`${projectUrl}/api/images/public/${folder._id}`);
          const imagesData = await imagesResponse.json();

          if (!imagesData.success) {
            return {
              name: folder.name,
              _id: folder._id,
              images: [],
            };
          }

          const images = imagesData.data.images || [];

          return {
            name: folder.name,
            _id: folder._id,
            images: images.map((img) => ({
              _id: img._id,
              tags: img.tags || [],
              nsfwLevel: img.nsfwLevel || 'general',
              imageUrl: img.imageUrl,
              thumbnail: img.thumbnail,
            })),
          };
        } catch (error) {
          return {
            name: folder.name,
            _id: folder._id,
            images: [],
          };
        }
      })
    );

    // 6. 캐시된 폴더 태그 정보 확인, 없으면 먼저 가져오기
    let availableTags = config.folderTagsCache?.tags || null;
    const hasValidTags = availableTags && typeof availableTags === 'object' && Object.keys(availableTags).length > 0;

    if (!hasValidTags) {
      try {
        const tagsResponse = await fetch(`${projectUrl}/api/extension/folder-tags?folderId=${config.folderId}`, {
          credentials: 'include',
        });

        if (tagsResponse.ok) {
          const tagsData = await tagsResponse.json();
          if (tagsData.tags && Object.keys(tagsData.tags).length > 0) {
            availableTags = tagsData.tags;
            // 캐시에 저장
            await chrome.storage.local.set({ folderTagsCache: tagsData });
          }
        }
      } catch (error) {
        // 태그 가져오기 실패 시 무시
      }
    }

    if (!availableTags || Object.keys(availableTags).length === 0) {
      sendResponse({ success: false, error: 'Failed to load folder tags. Please re-select the folder.' });
      return;
    }

    // 7. Unified API 호출
    let unifiedResponse;
    try {
      const apiResponse = await fetch(`${projectUrl}/api/extension/unified-select`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          characterFolders,
          availableTags,
          characterMappings: config.characterMappings || {},
        }),
      });

      unifiedResponse = await apiResponse.json();

      if (!unifiedResponse.success) {
        throw new Error(unifiedResponse.error || 'Unified selection failed');
      }
    } catch (error) {
      sendResponse({ success: false, error: 'Failed to select images: ' + error.message });
      return;
    }

    // 8. 응답 변환 (LLM 선택 결과 → Extension 형식)
    const characters = unifiedResponse.data.characters
      .filter((char) => char.status === 'matched' && char.selectedImageId)
      .map((char) => {
        // 선택된 이미지 찾기
        const folder = characterFolders.find((f) => f.name === char.folderName);
        const selectedImage = folder?.images.find((img) => img._id === char.selectedImageId);

        if (!selectedImage) {
          return null;
        }

        return {
          name: char.name,
          folderId: folder._id,
          images: [
            {
              imageUrl: selectedImage.imageUrl,
              thumbnail: selectedImage.thumbnail,
              score: char.selectedScore,
              reason: char.selectionReason,
              nsfwLevel: selectedImage.nsfwLevel,
              tags: selectedImage.tags,
            },
          ],
        };
      })
      .filter((char) => char !== null);

    if (characters.length === 0) {
      sendResponse({
        success: false,
        error: 'No appropriate images found for any character',
      });
      return;
    }

    // 9. 결과 반환
    const result = {
      success: true,
      characters,
      unmatchedCharacters: unifiedResponse.data.characters
        .filter((char) => char.status === 'unmatched')
        .map((char) => char.name),
    };

    // 캐시에 저장
    parseCache.set(text, result);

    sendResponse(result);
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * 레거시 호환 핸들러 (단일 인물)
 *
 * @param {string} text - 파싱할 텍스트
 * @param {Function} sendResponse - 응답 콜백
 */
async function handleParseAndFindLegacy(text, sendResponse) {
  // 다중 인물 파싱 후 첫 번째 인물만 반환
  const multiResponse = await new Promise((resolve) => {
    handleParseAndFindMultiple(text, resolve);
  });

  if (!multiResponse.success) {
    sendResponse(multiResponse);
    return;
  }

  // 첫 번째 인물의 태그와 이미지만 반환
  const firstCharacter = multiResponse.characters[0];
  sendResponse({
    success: true,
    tags: firstCharacter.tags,
    images: firstCharacter.images,
  });
}

/**
 * 설정이 변경될 때 캐시 초기화
 */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.projectUrl || changes.characterMappings) {
      parseCache.clear();
    }
  }
});

/**
 * Auth callback 탭 자동 닫기
 * chrome.tabs.onUpdated로 URL 변경 감지
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // URL이 auth-callback으로 변경되었을 때
  if (changeInfo.url && changeInfo.url.includes('/auth-callback')) {
    // 1초 후 탭 닫기
    setTimeout(() => {
      chrome.tabs.remove(tabId).catch(() => {});
    }, 1000);
  }
});
