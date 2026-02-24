// platforms/handlers/BabeChatHandler.js
// @ts-check

import { PlatformHandler } from './PlatformHandler.js';

/**
 * @fileoverview
 * BabeChat 플랫폼 전용 이미지 처리 Handler입니다.
 * 일반 DOM 구조를 사용하며, 텍스트 패턴("캐릭터명 |")을 기반으로 이미지를 삽입합니다.
 *
 * BabeChat 특성:
 * - 텍스트 내 "캐릭터명 |" 패턴으로 캐릭터 식별
 * - 마크다운 이미지 URL 지원 (![](url))
 * - 입력 필드 비활성화로 스트리밍 감지
 * - 외부 이미지 호스트 (itimg.kr, soda, dorua, ri4.org, r2.dev)
 *
 * SOLID 원칙:
 * - SRP: BabeChat의 이미지 표시 로직만 담당
 * - OCP: PlatformHandler를 확장하여 기능 추가
 * - LSP: PlatformHandler의 모든 메서드를 올바르게 구현
 */

/**
 * BabeChat 플랫폼 Handler
 *
 * @extends {PlatformHandler}
 */
export class BabeChatHandler extends PlatformHandler {
  constructor(platform) {
    super(platform);

    // 스트리밍 감지용 Observer
    this.streamingObservers = new WeakMap();
    // 폴링 인터벌
    this.pollingIntervals = new WeakMap();
  }

  /**
   * @override
   * BabeChat: 대사별 이미지 1:1 교체 (새 형식)
   *
   * 핵심 로직:
   * - 원본 이미지가 N개이면 dialogues 배열의 N개 이미지를 순서대로 사용
   * - 대사별로 다른 이미지를 선택 (같은 캐릭터도 대사마다 다른 이미지 가능)
   * - dialogues 배열 순서 = 원본 이미지 교체 순서
   */
  displayDialogues(messageElement, dialogues) {
    console.log('[BabeChatHandler] 💬 Displaying', dialogues.length, 'dialogue images');

    // 1. 로딩 플레이스홀더 제거
    const loadingPlaceholders = messageElement.querySelectorAll('.extension-loading-placeholder');
    console.log(`[BabeChatHandler] 🧹 Removing ${loadingPlaceholders.length} loading placeholders`);
    loadingPlaceholders.forEach((placeholder) => {
      placeholder.style.opacity = '0';
      setTimeout(() => placeholder.remove(), 300);
    });

    // 2. 원본 이미지 목록 가져오기
    const originalImages = this.platform.getOriginalImagesInMessage(messageElement);
    console.log(`[BabeChatHandler] 📸 Found ${originalImages.length} original images`);

    if (originalImages.length === 0) {
      console.log('[BabeChatHandler] ⚠️ No original images to replace');
      return;
    }

    // 3. 대사별 이미지를 순서대로 추출
    const dialogueImages = dialogues.map((d) => ({
      imageUrl: d.imageUrl,
      thumbnail: d.thumbnail,
      name: d.name,
      score: d.score,
    }));

    if (dialogueImages.length === 0) {
      console.log('[BabeChatHandler] ⚠️ No dialogue images available, hiding originals anyway');
      originalImages.forEach((img) => {
        if (img instanceof HTMLElement) {
          img.style.display = 'none';
          img.dataset.extensionProcessed = 'true';
        }
      });
      return;
    }

    console.log(`[BabeChatHandler] 🖼️ Available dialogue images: ${dialogueImages.length}`);

    // 4. 원본 이미지 1:1 교체 (대사 순서대로)
    let replacedCount = 0;
    originalImages.forEach((img, index) => {
      // 이미 처리된 이미지는 스킵
      if (img.dataset && img.dataset.extensionProcessed === 'true') {
        console.log(`[BabeChatHandler] ⏭️ Image ${index} already processed`);
        return;
      }

      // 이미 Extension 이미지가 앞에 있으면 스킵
      const prevElement = img.previousElementSibling;
      if (prevElement && prevElement.classList && prevElement.classList.contains('extension-character-image')) {
        console.log(`[BabeChatHandler] ⏭️ Image ${index} already has extension image`);
        if (img instanceof HTMLElement) {
          img.dataset.extensionProcessed = 'true';
        }
        return;
      }

      // 대사 순서대로 이미지 선택 (부족하면 라운드 로빈)
      const imageData = dialogueImages[index % dialogueImages.length];

      // Extension 이미지 생성 및 삽입
      const imageContainer = this.createImageContainer(imageData);
      imageContainer.classList.add('extension-character-image');

      if (img.parentElement) {
        img.parentElement.insertBefore(imageContainer, img);

        // 원본 이미지 숨기기
        if (img instanceof HTMLElement) {
          img.style.display = 'none';
          img.dataset.extensionProcessed = 'true';
        }

        replacedCount++;
        console.log(`[BabeChatHandler] ✅ Replaced image ${index} with dialogue ${index % dialogueImages.length} ("${imageData.name}", score: ${imageData.score}%)`);
      }
    });

    console.log(`[BabeChatHandler] ✅ Display complete: ${replacedCount}/${originalImages.length} images replaced`);
  }

  /**
   * @override
   * BabeChat: 원본 이미지 1:1 교체 (레거시 - 캐릭터별)
   *
   * 핵심 로직:
   * - 원본 이미지가 N개이면 extension 이미지도 N개 생성
   * - 캐릭터가 1명이면 같은 이미지를 N번 사용
   * - 캐릭터가 M명이면 라운드 로빈으로 배분
   */
  displayCharacters(messageElement, characters) {
    console.log('[BabeChatHandler] 🎨 Displaying', characters.length, 'characters (legacy)');

    // 1. 로딩 플레이스홀더 제거
    const loadingPlaceholders = messageElement.querySelectorAll('.extension-loading-placeholder');
    console.log(`[BabeChatHandler] 🧹 Removing ${loadingPlaceholders.length} loading placeholders`);
    loadingPlaceholders.forEach((placeholder) => {
      placeholder.style.opacity = '0';
      setTimeout(() => placeholder.remove(), 300);
    });

    // 2. 원본 이미지 목록 가져오기
    const originalImages = this.platform.getOriginalImagesInMessage(messageElement);
    console.log(`[BabeChatHandler] 📸 Found ${originalImages.length} original images`);

    if (originalImages.length === 0) {
      console.log('[BabeChatHandler] ⚠️ No original images to replace');
      return;
    }

    // 3. 유효한 캐릭터 이미지 추출 (이미지가 있는 캐릭터만)
    const validCharacterImages = characters
      .filter((c) => c.images && c.images.length > 0)
      .map((c) => c.images[0]);

    if (validCharacterImages.length === 0) {
      console.log('[BabeChatHandler] ⚠️ No character images available, hiding originals anyway');
      // 캐릭터 이미지가 없어도 원본 이미지는 숨김
      originalImages.forEach((img) => {
        if (img instanceof HTMLElement) {
          img.style.display = 'none';
          img.dataset.extensionProcessed = 'true';
        }
      });
      return;
    }

    console.log(`[BabeChatHandler] 🖼️ Available character images: ${validCharacterImages.length}`);

    // 4. 원본 이미지 1:1 교체 (라운드 로빈)
    let replacedCount = 0;
    originalImages.forEach((img, index) => {
      // 이미 처리된 이미지는 스킵
      if (img.dataset && img.dataset.extensionProcessed === 'true') {
        console.log(`[BabeChatHandler] ⏭️ Image ${index} already processed`);
        return;
      }

      // 이미 Extension 이미지가 앞에 있으면 스킵
      const prevElement = img.previousElementSibling;
      if (prevElement && prevElement.classList && prevElement.classList.contains('extension-character-image')) {
        console.log(`[BabeChatHandler] ⏭️ Image ${index} already has extension image`);
        if (img instanceof HTMLElement) {
          img.dataset.extensionProcessed = 'true';
        }
        return;
      }

      // 라운드 로빈으로 캐릭터 이미지 선택
      const imageData = validCharacterImages[index % validCharacterImages.length];

      // Extension 이미지 생성 및 삽입
      const imageContainer = this.createImageContainer(imageData);
      imageContainer.classList.add('extension-character-image');

      if (img.parentElement) {
        img.parentElement.insertBefore(imageContainer, img);

        // 원본 이미지 숨기기
        if (img instanceof HTMLElement) {
          img.style.display = 'none';
          img.dataset.extensionProcessed = 'true';
        }

        replacedCount++;
        console.log(`[BabeChatHandler] ✅ Replaced image ${index} (using character image ${index % validCharacterImages.length})`);
      }
    });

    console.log(`[BabeChatHandler] ✅ Display complete: ${replacedCount}/${originalImages.length} images replaced`);
  }

  /**
   * 캐릭터 이름 패턴을 찾아 이미지로 교체 (인덱스 반환 버전)
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @param {string} characterName - 캐릭터 이름
   * @param {{imageUrl?: string, thumbnail?: string, url?: string}} imageData - 이미지 데이터
   * @param {Element[]} originalImages - 원본 이미지 배열
   * @param {Set<number>} processedIndices - 이미 처리된 인덱스
   * @returns {number} 교체된 이미지 인덱스 (-1이면 실패)
   * @private
   */
  findAndReplaceCharacterImageWithIndex(messageElement, characterName, imageData, originalImages, processedIndices) {
    // 1. 원본 이미지에서 캐릭터 이름과 매칭되는 것 찾기
    for (let i = 0; i < originalImages.length; i++) {
      // 이미 처리된 인덱스는 스킵
      if (processedIndices.has(i)) {
        continue;
      }

      const img = originalImages[i];

      // 이미 처리된 이미지는 스킵
      if (img.dataset && img.dataset.extensionProcessed === 'true') {
        continue;
      }

      // 이미 Extension 이미지가 앞에 있는지 확인
      const prevElement = img.previousElementSibling;
      if (prevElement && prevElement.classList && prevElement.classList.contains('extension-character-image')) {
        if (img instanceof HTMLElement) {
          img.dataset.extensionProcessed = 'true';
        }
        continue;
      }

      // 이미지 앞의 텍스트에서 캐릭터 이름 확인
      const textContent = this.getTextBeforeElement(messageElement, img);
      if (this.isNameInText(textContent, characterName)) {
        console.log(`[BabeChatHandler] ✅ Character "${characterName}" found before image at index ${i}`);

        // Extension 이미지 생성 및 삽입
        const imageContainer = this.createImageContainer(imageData);
        imageContainer.classList.add('extension-character-image');

        if (img.parentElement) {
          img.parentElement.insertBefore(imageContainer, img);

          if (img instanceof HTMLElement) {
            img.dataset.extensionProcessed = 'true';
          }

          return i;
        }
      }
    }

    // 2. 텍스트 전체에서 캐릭터 이름이 있으면 첫 번째 미처리 이미지에 삽입
    const textContent = messageElement.textContent || '';
    if (this.isNameInText(textContent, characterName)) {
      // 첫 번째 미처리 원본 이미지 찾기
      for (let i = 0; i < originalImages.length; i++) {
        if (processedIndices.has(i)) continue;

        const img = originalImages[i];
        if (img.dataset && img.dataset.extensionProcessed === 'true') continue;

        const prevElement = img.previousElementSibling;
        if (prevElement && prevElement.classList && prevElement.classList.contains('extension-character-image')) {
          continue;
        }

        console.log(`[BabeChatHandler] ✅ Character "${characterName}" found in text, using image at index ${i}`);

        const imageContainer = this.createImageContainer(imageData);
        imageContainer.classList.add('extension-character-image');

        if (img.parentElement) {
          img.parentElement.insertBefore(imageContainer, img);

          if (img instanceof HTMLElement) {
            img.dataset.extensionProcessed = 'true';
          }

          return i;
        }
      }
    }

    // 3. 마크다운 이미지 URL 처리
    const markdownUrls = this.platform.extractMarkdownImageUrls
      ? this.platform.extractMarkdownImageUrls(messageElement)
      : [];

    if (markdownUrls.length > 0 && this.isNameInText(textContent, characterName)) {
      const insertionPoint = this.findMarkdownInsertionPoint(messageElement);

      if (insertionPoint && insertionPoint.parentElement) {
        const imageContainer = this.createImageContainer(imageData);
        imageContainer.classList.add('extension-character-image');
        insertionPoint.parentElement.insertBefore(imageContainer, insertionPoint.nextSibling);
        console.log(`[BabeChatHandler] ✅ Inserted image after markdown for "${characterName}"`);
        return -2; // 특수값: 마크다운 위치에 삽입됨 (원본 이미지 인덱스 아님)
      }
    }

    return -1;
  }

  /**
   * 캐릭터 이름 패턴을 찾아 이미지로 교체 (레거시 - 하위 호환용)
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @param {string} characterName - 캐릭터 이름
   * @param {{imageUrl?: string, thumbnail?: string, url?: string}} imageData - 이미지 데이터
   * @returns {boolean} 매칭 성공 여부
   * @private
   */
  findAndReplaceCharacterImage(messageElement, characterName, imageData) {
    const originalImages = this.platform.getOriginalImagesInMessage(messageElement);
    const result = this.findAndReplaceCharacterImageWithIndex(
      messageElement,
      characterName,
      imageData,
      originalImages,
      new Set()
    );
    return result >= -1 && result !== -1;
  }

  /**
   * 텍스트에 캐릭터 이름이 있는지 확인 (패턴: "캐릭터명 |")
   *
   * @param {string} text - 검색할 텍스트
   * @param {string} characterName - 캐릭터 이름
   * @returns {boolean} 포함 여부
   * @private
   */
  isNameInText(text, characterName) {
    if (!text || !characterName) return false;

    const lowerText = text.toLowerCase();
    const lowerName = characterName.toLowerCase().trim();

    // 1. "캐릭터명 |" 패턴 확인 (유니코드 따옴표 포함)
    const patterns = [
      `"${lowerName}"`,      // "이름"
      `"${lowerName}"`,      // "이름" (유니코드)
      `'${lowerName}'`,      // '이름'
      `${lowerName} |`,      // 이름 |
      `${lowerName}｜`,      // 이름｜ (전각)
      `${lowerName}|`,       // 이름| (붙어있는 경우)
    ];

    for (const pattern of patterns) {
      if (lowerText.includes(pattern)) {
        return true;
      }
    }

    // 2. 단순 이름 포함 확인 (짧은 이름은 패턴 매칭 필요)
    if (lowerName.length >= 3 && lowerText.includes(lowerName)) {
      return true;
    }

    // 3. 이름의 첫 단어만으로 매칭 (예: "엔비 스텔라" → "엔비")
    const firstName = lowerName.split(/\s+/)[0];
    if (firstName.length >= 2) {
      for (const pattern of [`"${firstName}"`, `"${firstName}"`, `${firstName} |`, `${firstName}｜`]) {
        if (lowerText.includes(pattern)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * 특정 요소 앞의 텍스트 가져오기
   *
   * @param {HTMLElement} container - 컨테이너 요소
   * @param {Element} targetElement - 대상 요소
   * @returns {string} 요소 앞의 텍스트
   * @private
   */
  getTextBeforeElement(container, targetElement) {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    let text = '';
    let node;

    while ((node = walker.nextNode())) {
      // 대상 요소에 도달하면 중지
      if (targetElement.contains(node) || node === targetElement) {
        break;
      }
      text += node.textContent || '';
    }

    return text;
  }

  /**
   * 마크다운 이미지 삽입 위치 찾기
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {Element|null} 삽입 위치 요소
   * @private
   */
  findMarkdownInsertionPoint(messageElement) {
    // 텍스트 노드 중 마크다운 이미지 패턴이 있는 위치 찾기
    const elements = messageElement.querySelectorAll('p, div, span');

    for (const element of elements) {
      const text = element.textContent || '';
      if (/!\[.*?\]\(https?:\/\/[^\s)]+\)/.test(text)) {
        return element;
      }
    }

    return null;
  }

  /**
   * 원본 이미지 숨기기
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @private
   */
  hideOriginalImages(messageElement) {
    const originalImages = this.platform.getOriginalImagesInMessage(messageElement);
    let hiddenCount = 0;

    originalImages.forEach((img) => {
      // Extension 이미지는 제외
      if (img.classList && (
        img.classList.contains('extension-image') ||
        img.classList.contains('extension-character-image')
      )) {
        return;
      }

      // Extension 컨테이너 내부 이미지는 제외
      if (img.closest('.extension-character-image') || img.closest('.extension-single-image')) {
        return;
      }

      // 원본 이미지 숨기기
      if (img instanceof HTMLElement) {
        img.style.display = 'none';
        hiddenCount++;
      }
    });

    console.log(`[BabeChatHandler] 🙈 Hidden ${hiddenCount} original images`);
  }

  /**
   * @override
   * BabeChat: 스트리밍 감지를 위한 입력 필드 Observer 설정
   */
  setupMessageObserver(messageElement) {
    // 이미 Observer가 설정되어 있으면 스킵
    if (this.streamingObservers.has(messageElement)) {
      console.log('[BabeChatHandler] ⏭️  Observer already exists');
      return;
    }

    console.log('[BabeChatHandler] 🔍 Setting up message observer');

    let lastImageCount = 0;
    let pollCount = 0;

    // 폴링: 300ms마다 새 이미지/콘텐츠 체크
    const pollingInterval = setInterval(() => {
      pollCount++;

      const isStreaming = this.platform.isMessageStreaming(messageElement);
      const currentImages = this.platform.getOriginalImagesInMessage(messageElement);

      // 새 이미지가 추가되었는지 확인
      if (currentImages.length > lastImageCount) {
        console.log(`[BabeChatHandler] 🆕 New images detected: ${lastImageCount} → ${currentImages.length}`);
        lastImageCount = currentImages.length;

        // 메시지 처리 이벤트 발생
        const event = new CustomEvent('extension:processMessage', {
          detail: { messageElement },
        });
        document.dispatchEvent(event);
      }

      // 스트리밍 완료 시 폴링 중지
      if (!isStreaming && pollCount > 5) {
        console.log('[BabeChatHandler] ✅ Streaming complete, stopping poll');
        clearInterval(pollingInterval);
        this.pollingIntervals.delete(messageElement);

        // 최종 처리
        setTimeout(() => {
          const finalEvent = new CustomEvent('extension:processMessage', {
            detail: { messageElement },
          });
          document.dispatchEvent(finalEvent);
        }, 500);
      }
    }, 300);

    this.pollingIntervals.set(messageElement, pollingInterval);
    this.streamingObservers.set(messageElement, true);

    // 30초 후 자동 정리
    setTimeout(() => {
      const interval = this.pollingIntervals.get(messageElement);
      if (interval) {
        clearInterval(interval);
        this.pollingIntervals.delete(messageElement);
      }
      this.streamingObservers.delete(messageElement);
    }, 30000);
  }

  /**
   * Observer 정리
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   */
  cleanup(messageElement) {
    // Polling 중지
    const interval = this.pollingIntervals.get(messageElement);
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(messageElement);
    }

    // Observer 제거
    this.streamingObservers.delete(messageElement);
  }
}
