// background/folder-matcher.js - 인물명-폴더 매칭 로직
// @ts-check

/**
 * 캐릭터명 매핑 적용
 *
 * @param {string} characterName - 원본 캐릭터 이름
 * @param {Object} mappings - 캐릭터명 매핑 객체
 * @returns {string} 매핑된 캐릭터 이름 또는 원본 이름
 */
function applyMapping(characterName, mappings) {
  if (!mappings || typeof mappings !== 'object') {
    return characterName;
  }

  // 매핑 값 추출 헬퍼 (객체 또는 문자열 지원)
  const extractFolderName = (value) => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && value.folderName) return value.folderName;
    return null;
  };

  // 1. 정확한 매핑 확인
  if (mappings[characterName]) {
    const folderName = extractFolderName(mappings[characterName]);
    if (folderName) {
      console.log(`[FolderMatcher] 🔗 Mapping: "${characterName}" → "${folderName}"`);
      return folderName;
    }
  }

  // 2. 대소문자 무시 매핑 확인
  const lowerName = characterName.toLowerCase();
  const mappedEntry = Object.entries(mappings).find(
    ([key]) => key.toLowerCase() === lowerName
  );
  if (mappedEntry) {
    const folderName = extractFolderName(mappedEntry[1]);
    if (folderName) {
      console.log(`[FolderMatcher] 🔗 Mapping (case-insensitive): "${characterName}" → "${folderName}"`);
      return folderName;
    }
  }

  return characterName;
}

/**
 * 등장인물 이름을 기반으로 폴더 검색 및 매칭
 *
 * @param {Character[]} characters - 파싱된 등장인물 배열
 * @param {string} projectUrl - 프로젝트 URL
 * @param {string} parentFolderId - 검색할 부모 폴더 ID
 * @param {Object} mappings - 캐릭터명 매핑 객체 (선택사항)
 * @returns {Promise<Character[]>} 폴더 ID가 매칭된 등장인물 배열
 */
export async function matchCharacterFolders(characters, projectUrl, parentFolderId, mappings = {}) {
  console.log('[FolderMatcher] 🔍 Matching folders for', characters.length, 'characters');
  console.log('[FolderMatcher] 📁 Parent folder:', parentFolderId);

  // 각 인물마다 폴더 검색 (병렬 처리)
  const matchedCharacters = await Promise.all(
    characters.map(async (character) => {
      try {
        const folderId = await findFolderByName(character.name, projectUrl, parentFolderId, mappings);
        return {
          ...character,
          folderId,
        };
      } catch (error) {
        console.error(`[FolderMatcher] ❌ Error matching folder for "${character.name}":`, error);
        return {
          ...character,
          folderId: null,
        };
      }
    })
  );

  // 매칭 결과 로깅
  matchedCharacters.forEach((char) => {
    if (char.folderId) {
      console.log(`[FolderMatcher] ✅ "${char.name}" → Folder ID: ${char.folderId}`);
    } else {
      console.log(`[FolderMatcher] ❌ "${char.name}" → No matching folder`);
    }
  });

  return matchedCharacters;
}

/**
 * 인물 이름으로 폴더 검색
 *
 * @param {string} characterName - 인물 이름
 * @param {string} projectUrl - 프로젝트 URL
 * @param {string} parentFolderId - 검색할 부모 폴더 ID
 * @param {Object} mappings - 캐릭터명 매핑 객체 (선택사항)
 * @returns {Promise<string|null>} 폴더 ID 또는 null
 */
async function findFolderByName(characterName, projectUrl, parentFolderId, mappings = {}) {
  console.log(`[FolderMatcher] 🔍 Searching folder for: "${characterName}"`);

  // 0. 매핑 적용 (매핑이 있으면 먼저 적용)
  const mappedName = applyMapping(characterName, mappings);

  // 1. 정확한 이름으로 검색 (최우선) - 매핑된 이름 사용
  const exactMatch = await searchFolder(mappedName, projectUrl, parentFolderId);
  if (exactMatch && exactMatch.length > 0) {
    const bestMatch = selectBestMatch(exactMatch, mappedName);
    if (bestMatch) {
      console.log(`[FolderMatcher] 🎯 Exact match for "${characterName}" (mapped: "${mappedName}"): "${bestMatch.name}" (${bestMatch._id})`);
      return bestMatch._id;
    }
  }

  // 2. 정규화된 이름으로 재시도 (공백 제거, 소문자 변환)
  const normalizedName = mappedName.trim().toLowerCase().replace(/\s+/g, '');
  if (normalizedName !== mappedName.toLowerCase()) {
    const normalizedMatch = await searchFolder(normalizedName, projectUrl, parentFolderId);
    if (normalizedMatch && normalizedMatch.length > 0) {
      const bestMatch = selectBestMatch(normalizedMatch, mappedName);
      if (bestMatch) {
        console.log(`[FolderMatcher] 🎯 Normalized match for "${characterName}" (mapped: "${mappedName}"): "${bestMatch.name}" (${bestMatch._id})`);
        return bestMatch._id;
      }
    }
  }

  // 3. 단어 단위로 분리하여 부분 일치 시도 (긴 단어 우선)
  // 예: "엔비 스텔라" → ["스텔라", "엔비"] (길이순 정렬)
  const words = mappedName
    .split(/\s+/)
    .filter((word) => word.length >= 2) // 2글자 이상만
    .sort((a, b) => b.length - a.length); // 긴 단어 우선

  console.log(`[FolderMatcher] 📝 Words to try (length-sorted):`, words);

  for (const word of words) {
    const partialMatch = await searchFolder(word, projectUrl, parentFolderId);
    if (partialMatch && partialMatch.length > 0) {
      const bestMatch = selectBestMatch(partialMatch, mappedName);
      if (bestMatch) {
        console.log(`[FolderMatcher] 🎯 Partial match for "${characterName}" (mapped: "${mappedName}", word: "${word}"): "${bestMatch.name}" (${bestMatch._id})`);
        return bestMatch._id;
      }
    }
  }

  console.log(`[FolderMatcher] ❌ No match found for "${characterName}" (mapped: "${mappedName}")`);
  return null;
}

/**
 * 여러 폴더 중 가장 적합한 폴더 선택
 * 매칭 점수 기반으로 최적의 폴더를 선택합니다.
 *
 * @param {FolderInfo[]} folders - 검색된 폴더 배열
 * @param {string} characterName - 원본 캐릭터 이름
 * @returns {FolderInfo|null} 가장 적합한 폴더 또는 null
 */
function selectBestMatch(folders, characterName) {
  if (!folders || folders.length === 0) return null;

  const lowerCharName = characterName.toLowerCase();

  // 각 폴더에 점수 부여
  const scored = folders.map((folder) => {
    const lowerFolderName = folder.name.toLowerCase();
    let score = 0;

    // 완전 일치 (최고 점수)
    if (lowerFolderName === lowerCharName) {
      score = 1000;
    }
    // 캐릭터 이름이 폴더 이름에 완전히 포함 ("엔비" ⊂ "엔비 스텔라")
    else if (lowerFolderName.includes(lowerCharName)) {
      score = 900;
    }
    // 폴더 이름이 캐릭터 이름으로 시작 ("엔비 스텔라" starts with "엔비")
    else if (lowerFolderName.startsWith(lowerCharName)) {
      score = 850;
    }
    // 단어 단위 부분 일치
    else {
      const charWords = lowerCharName.split(/\s+/);
      const folderWords = lowerFolderName.split(/\s+/);
      const matchedWords = charWords.filter((word) => folderWords.includes(word));
      score = 700 + matchedWords.length * 50; // 매칭된 단어 수에 비례
    }

    // 길이 차이가 클수록 감점 (너무 다른 이름은 제외)
    const lengthDiff = Math.abs(lowerFolderName.length - lowerCharName.length);
    score -= lengthDiff * 2;

    return { folder, score };
  });

  // 점수순 정렬
  scored.sort((a, b) => b.score - a.score);

  console.log(`[FolderMatcher] 📊 Match scores for "${characterName}":`, scored.map((s) => `"${s.folder.name}": ${s.score}`));

  // 최고 점수 폴더 반환
  return scored[0].folder;
}

/**
 * 폴더 검색 API 호출
 *
 * @param {string} name - 검색할 폴더 이름
 * @param {string} projectUrl - 프로젝트 URL
 * @param {string} parentId - 검색할 부모 폴더 ID
 * @returns {Promise<FolderInfo[]|null>} 폴더 정보 배열 또는 null
 */
async function searchFolder(name, projectUrl, parentId) {
  try {
    const url = `${projectUrl}/api/folders/search?name=${encodeURIComponent(name)}&parentId=${encodeURIComponent(parentId)}`;
    console.log('[FolderMatcher] 📍 Searching:', url);

    const response = await fetch(url, {
      credentials: 'include', // 쿠키 포함
    });

    // HTML 응답 체크 (인증 실패 시)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      console.error('[FolderMatcher] ❌ Received HTML response - authentication failed');
      throw new Error('Authentication failed - please login to masis.gaonprime.com');
    }

    if (!response.ok) {
      console.error('[FolderMatcher] ❌ API Error:', response.status);
      return null;
    }

    const result = await response.json();

    if (!result.success || !result.data?.folders) {
      console.error('[FolderMatcher] ❌ Invalid response:', result);
      return null;
    }

    const folders = result.data.folders;
    if (folders.length === 0) {
      return null;
    }

    console.log(`[FolderMatcher] ✅ Found ${folders.length} folders:`, folders.map((f) => f.name));

    // 모든 매칭 결과 반환 (selectBestMatch에서 점수 기반 선택)
    return folders;
  } catch (error) {
    console.error('[FolderMatcher] ❌ Search error:', error);
    return null;
  }
}

/**
 * 폴더가 매칭된 인물만 필터링
 *
 * @param {Character[]} characters - 인물 배열
 * @returns {Character[]} 폴더 ID가 있는 인물만
 */
export function filterMatchedCharacters(characters) {
  return characters.filter((char) => char.folderId !== null);
}

/**
 * 매칭 실패한 인물 목록 반환
 *
 * @param {Character[]} characters - 인물 배열
 * @returns {string[]} 매칭 실패한 인물 이름 배열
 */
export function getUnmatchedCharacterNames(characters) {
  return characters
    .filter((char) => char.folderId === null)
    .map((char) => char.name);
}
