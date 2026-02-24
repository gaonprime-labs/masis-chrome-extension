// content/message-handler.js
// @ts-check

/**
 * @fileoverview
 * 메시지 처리 핸들러 모듈
 *
 * SOLID 원칙:
 * - SRP: 메시지 처리 로직만 담당
 * - OCP: displayMultipleCharacters는 확장 가능
 * - DIP: Platform, Handler 추상화에 의존
 */

import { createLoadingPlaceholder } from './utils.js';

/**
 * 새 메시지 처리 (다중 인물 지원)
 *
 * @param {HTMLElement} messageElement - 처리할 메시지 요소
 * @param {Object} platform - 플랫폼 인스턴스
 * @param {Object} handler - Handler 인스턴스
 * @param {number} retryCount - 재시도 횟수
 */
export async function handleNewMessage(messageElement, platform, handler, retryCount = 0) {
  console.log('[HandleMessage] 🚀 === START MESSAGE PROCESSING ===');
  console.log(`[HandleMessage] 🔄 Retry count: ${retryCount}`);

  // 중복 처리 방지
  if (messageElement.dataset.extensionProcessing === 'true') {
    console.log('[HandleMessage] ⏭️  Already processing, skipping');
    return;
  }

  // 원본 이미지 확인
  const originalImages = platform.getOriginalImagesInMessage(messageElement);
  console.log(`[HandleMessage] 📊 Found ${originalImages.length} original images in this message`);

  if (originalImages.length === 0) {
    console.log('[HandleMessage] ⏭️  No original images found, skipping');
    messageElement.dataset.extensionProcessed = 'true';
    return;
  }

  console.log('[HandleMessage] ✅ Images found, proceeding with processing');

  // 원본 이미지 처리 및 로딩 표시
  prepareMessageElement(messageElement, originalImages);

  // 텍스트 추출 및 검증
  const text = platform.extractMessageText(messageElement);
  console.log(`[HandleMessage] 📝 Extracted text length: ${text.length} characters`);

  if (!text || text.length < 50) {
    console.log('[HandleMessage] ⚠️  Text too short, ignoring');
    return;
  }

  messageElement.dataset.extensionProcessing = 'true';
  console.log('[HandleMessage] 🔒 Set processing flag');

  // API 호출 및 응답 처리
  try {
    const response = await fetchCharacters(text);
    await processApiResponse(response, messageElement, handler, originalImages);

    messageElement.dataset.extensionProcessed = 'true';
    delete messageElement.dataset.extensionProcessing;
    console.log('[HandleMessage] 🏁 Set processed flag and cleared processing flag');
  } catch (error) {
    console.error('[Extension] ❌ Error processing message:', error);
    messageElement.dataset.extensionProcessed = 'true';
    delete messageElement.dataset.extensionProcessing;
  }
}

/**
 * 메시지 요소 준비 (로딩 표시)
 *
 * 참고: 원본 이미지 숨김은 각 Handler가 1:1 교체하면서 담당
 *
 * @param {HTMLElement} messageElement - 메시지 요소
 * @param {Element[]} originalImages - 원본 이미지 배열
 * @private
 */
function prepareMessageElement(messageElement, originalImages) {
  console.log('[HandleMessage] 🎬 Preparing message element...');

  // 1. 로딩 인디케이터 삽입
  insertLoadingPlaceholders(originalImages);

  // 2. 기존 Extension 이미지 제거
  cleanupExistingImages(messageElement);
}

/**
 * 원본 이미지 숨김
 *
 * @param {Element[]} originalImages - 원본 이미지 배열
 * @private
 */
function hideOriginalImages(originalImages) {
  originalImages.forEach((img) => {
    if (img instanceof HTMLElement) {
      img.classList.remove('extension-visible');
      img.style.opacity = '0';
      img.style.pointerEvents = 'none';
    }
  });
}

/**
 * 로딩 플레이스홀더 삽입
 *
 * @param {Element[]} originalImages - 원본 이미지 배열
 * @private
 */
function insertLoadingPlaceholders(originalImages) {
  const loadingPlaceholders = [];

  originalImages.forEach((img, index) => {
    const placeholder = createLoadingPlaceholder();
    placeholder.dataset.loadingIndex = String(index);

    if (img.parentElement) {
      img.parentElement.insertBefore(placeholder, img);
      loadingPlaceholders.push(placeholder);
    }
  });

  console.log(`[HandleMessage] ⏳ Inserted ${loadingPlaceholders.length} loading placeholders`);
}

/**
 * 기존 Extension 이미지 제거
 *
 * @param {HTMLElement} messageElement - 메시지 요소
 * @private
 */
function cleanupExistingImages(messageElement) {
  const existingExtensionImages = messageElement.querySelectorAll('.extension-character-image');
  if (existingExtensionImages.length > 0) {
    console.log(`[HandleMessage] 🧹 Removing ${existingExtensionImages.length} existing extension images`);
    existingExtensionImages.forEach((img) => img.remove());
    delete messageElement.dataset.extensionProcessed;
  }

  const legacyContainer = messageElement.querySelector('.extension-characters-container');
  if (legacyContainer) {
    console.log('[HandleMessage] 🧹 Removing legacy container');
    legacyContainer.remove();
    delete messageElement.dataset.extensionProcessed;
  }
}

/**
 * 캐릭터 데이터 가져오기
 *
 * @param {string} text - 추출된 텍스트
 * @returns {Promise<Object>} API 응답
 * @private
 */
async function fetchCharacters(text) {
  console.log('[HandleMessage] 📤 Sending API request...');
  console.log('[HandleMessage] 📄 Text preview:', text.substring(0, 100) + '...');

  const response = await chrome.runtime.sendMessage({
    type: 'PARSE_AND_FIND_MULTIPLE',
    text,
  });

  console.log('[HandleMessage] 📥 API Response received');
  console.log('[HandleMessage] 📊 Response:', JSON.stringify(response, null, 2));

  return response;
}

/**
 * API 응답 처리
 *
 * @param {Object} response - API 응답
 * @param {HTMLElement} messageElement - 메시지 요소
 * @param {Object} handler - Handler 인스턴스
 * @param {Element[]} originalImages - 원본 이미지 배열
 * @private
 */
async function processApiResponse(response, messageElement, handler, originalImages) {
  if (response.success) {
    handleSuccessResponse(response, messageElement, handler, originalImages);
  } else {
    handleFailureResponse(response, messageElement, originalImages);
  }
}

/**
 * 성공 응답 처리
 *
 * @param {Object} response - API 응답 (dialogues 또는 characters 포함)
 * @param {HTMLElement} messageElement - 메시지 요소
 * @param {Object} handler - Handler 인스턴스
 * @param {Element[]} originalImages - 원본 이미지 배열
 * @private
 */
function handleSuccessResponse(response, messageElement, handler, originalImages) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[HandleMessage] ✅ API SUCCESS - Processing completed');

  // 대사별 이미지 (새 형식) 또는 캐릭터별 이미지 (레거시)
  const dialogues = response.dialogues || [];
  const characters = response.characters || [];

  console.log(`[HandleMessage] 💬 Found ${dialogues.length} dialogues with images`);
  console.log(`[HandleMessage] 👤 Found ${characters.length} characters (legacy)`);

  if (response.unmatchedDialogues && response.unmatchedDialogues.length > 0) {
    console.log('[HandleMessage] ⚠️  Unmatched dialogues:', response.unmatchedDialogues.map((d) => `${d.index}:${d.name}`).join(', '));
  }

  dialogues.forEach((d, idx) => {
    const tagCount = d.tags?.length || 0;
    console.log(`[HandleMessage] 📝 Dialogue ${d.dialogueIndex}: ${d.name} (${tagCount} tags, score: ${d.score}%)`);
  });

  // 로딩 플레이스홀더 제거 (항상)
  const loadingPlaceholders = messageElement.querySelectorAll('.extension-loading-placeholder');
  loadingPlaceholders.forEach((placeholder) => {
    placeholder.style.opacity = '0';
    setTimeout(() => placeholder.remove(), 300);
  });

  // 대사/캐릭터가 없으면 원본 이미지만 숨기고 종료
  if (dialogues.length === 0 && characters.length === 0) {
    console.log('[HandleMessage] ⚠️ No dialogues/characters found, hiding original images anyway');
    originalImages.forEach((img) => {
      if (img instanceof HTMLElement) {
        img.style.display = 'none';
        img.dataset.extensionProcessed = 'true';
      }
    });
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return;
  }

  // 대사별 이미지가 있으면 대사별로 처리, 없으면 레거시 캐릭터별 처리
  if (dialogues.length > 0) {
    console.log('[HandleMessage] 🎨 Calling displayDialogues (new format)...');
    displayDialogues(messageElement, dialogues, handler);
  } else {
    console.log('[HandleMessage] 🎨 Calling displayMultipleCharacters (legacy)...');
    displayMultipleCharacters(messageElement, characters, handler);
  }
  console.log('[HandleMessage] ✅ Display completed');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

/**
 * 실패 응답 처리
 *
 * @param {Object} response - API 응답
 * @param {HTMLElement} messageElement - 메시지 요소
 * @param {Element[]} originalImages - 원본 이미지 배열
 * @private
 */
function handleFailureResponse(response, messageElement, originalImages) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[HandleMessage] ❌ API FAILED - Processing failed');
  console.log('[HandleMessage] ❌ Error:', response.error);

  // 실패 시 로딩 제거하고 원본 이미지 복원
  console.log('[HandleMessage] 🔄 Restoring original images...');
  const placeholders = messageElement.querySelectorAll('.extension-loading-placeholder');
  placeholders.forEach((placeholder) => placeholder.remove());

  originalImages.forEach((img) => {
    if (img instanceof HTMLElement) {
      img.classList.add('extension-visible');
      img.style.opacity = '1';
      img.style.pointerEvents = 'auto';
    }
  });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

/**
 * 대사별 이미지를 표시 (Handler에 위임)
 *
 * @param {HTMLElement} messageElement - 메시지 요소
 * @param {Array} dialogues - 대사별 이미지 배열 (dialogueIndex 순서)
 * @param {Object} handler - Handler 인스턴스
 */
function displayDialogues(messageElement, dialogues, handler) {
  console.log('[ImageDisplay] 💬 Displaying', dialogues.length, 'dialogue images');

  if (!handler) {
    console.error('[ImageDisplay] ❌ Handler not initialized, cannot display images');
    return;
  }

  // Handler에 위임 (displayDialogues 메서드가 있으면 사용, 없으면 레거시 변환)
  if (typeof handler.displayDialogues === 'function') {
    handler.displayDialogues(messageElement, dialogues);
  } else {
    // 레거시 호환: dialogues → characters 형식으로 변환
    const characters = dialogues.map((d) => ({
      name: d.name,
      folderId: d.folderId,
      images: [{
        imageUrl: d.imageUrl,
        thumbnail: d.thumbnail,
        score: d.score,
        reason: d.reason,
        nsfwLevel: d.nsfwLevel,
        tags: d.tags,
      }],
    }));
    handler.displayCharacters(messageElement, characters);
  }
}

/**
 * 여러 등장인물의 이미지를 표시 (레거시 - Handler에 위임)
 *
 * @param {HTMLElement} messageElement - 메시지 요소
 * @param {Array} characters - 인물 배열 (images 포함)
 * @param {Object} handler - Handler 인스턴스
 */
function displayMultipleCharacters(messageElement, characters, handler) {
  console.log('[ImageDisplay] 🎨 Displaying', characters.length, 'characters (legacy)');

  if (!handler) {
    console.error('[ImageDisplay] ❌ Handler not initialized, cannot display images');
    return;
  }

  // Handler에 위임
  handler.displayCharacters(messageElement, characters);
}
