// platforms/handlers/LunaTalkHandler.js
// @ts-check

import { PlatformHandler } from './PlatformHandler.js';

/**
 * @fileoverview
 * LunaTalk 플랫폼 전용 이미지 처리 Handler입니다.
 * Shadow DOM을 사용하며, 스트리밍 중 dialogue 요소를 실시간으로 감지합니다.
 *
 * SOLID 원칙:
 * - SRP: LunaTalk의 Shadow DOM 처리 및 이미지 표시만 담당
 * - OCP: PlatformHandler를 확장하여 Shadow DOM 기능 추가
 * - LSP: PlatformHandler의 모든 메서드를 올바르게 구현
 */

/**
 * LunaTalk 플랫폼 Handler
 *
 * @extends {PlatformHandler}
 */
export class LunaTalkHandler extends PlatformHandler {
  constructor(platform) {
    super(platform);

    // Shadow DOM Observer 및 Polling 관리
    this.shadowObservers = new WeakMap();
    this.pollingIntervals = new WeakMap();
  }

  /**
   * @override
   * LunaTalk: Shadow DOM 내 .dialogue 요소에서 이름 추출하여 이미지 삽입
   */
  displayCharacters(messageElement, characters) {
    console.log('[LunaTalkHandler] 🎨 LunaTalk 특화 처리 시작');

    const cbox = messageElement.querySelector('.cbox');
    if (!cbox || !cbox.shadowRoot) {
      console.log('[LunaTalkHandler] ❌ Shadow DOM not found');
      return;
    }

    // 1. Shadow DOM 내 로딩 플레이스홀더 제거 (이미지 삽입 전)
    const loadingPlaceholders = cbox.shadowRoot.querySelectorAll('.extension-loading-placeholder');
    console.log(`[LunaTalkHandler] 🧹 Removing ${loadingPlaceholders.length} loading placeholders in Shadow DOM`);
    loadingPlaceholders.forEach((placeholder) => {
      placeholder.style.opacity = '0';
      setTimeout(() => placeholder.remove(), 300);
    });

    const dialogues = cbox.shadowRoot.querySelectorAll('.dialogue');
    console.log(`[LunaTalkHandler] 📊 Found ${dialogues.length} dialogue elements`);

    characters.forEach((character, charIndex) => {
      console.log(
        `[LunaTalkHandler] 🔍 Processing character ${charIndex + 1}/${characters.length}: "${character.name}"`
      );

      if (!character.images || character.images.length === 0) {
        console.log(`[LunaTalkHandler] ⚠️  Character "${character.name}" has no images, skipping`);
        return;
      }

      let foundMatch = false;

      for (const dialogue of dialogues) {
        // 이미 처리된 dialogue는 스킵
        if (dialogue instanceof HTMLElement && dialogue.dataset.extensionProcessed === 'true') {
          continue;
        }

        // dialogue 텍스트에서 이름 추출: "이름 | 대사" 형식
        const text = dialogue.textContent?.trim() || '';
        const match = text.match(/^["']?(.+?)["']?\s*\|\s*/);

        if (match) {
          const dialogueName = match[1].trim();

          // 부분 일치 검사 (대소문자 무시)
          if (this.isNameMatch(dialogueName, character.name)) {
            console.log(`[LunaTalkHandler] ✅ Name match found: dialogue="${dialogueName}" ↔ character="${character.name}"`);
            foundMatch = true;

            // 이미 Extension 이미지가 있는지 확인
            const prevElement = dialogue.previousElementSibling;
            if (
              prevElement &&
              prevElement.classList &&
              prevElement.classList.contains('extension-character-image')
            ) {
              console.log(`[LunaTalkHandler] ⏭️  Image already added for this dialogue`);
              if (dialogue instanceof HTMLElement) {
                dialogue.dataset.extensionProcessed = 'true';
              }
              continue;
            }

            // Extension 이미지 생성
            const imageContainer = this.createImageContainer(character.images[0]);
            imageContainer.classList.add('extension-character-image');

            // dialogue 앞에 이미지 삽입
            if (dialogue.parentElement) {
              dialogue.parentElement.insertBefore(imageContainer, dialogue);
              console.log(
                `[LunaTalkHandler] ✅ Successfully inserted image for "${character.name}"`
              );

              // 처리 완료 표시
              if (dialogue instanceof HTMLElement) {
                dialogue.dataset.extensionProcessed = 'true';
              }
            } else {
              console.log(`[LunaTalkHandler] ❌ No parent element for dialogue`);
            }
          }
        }
      }

      if (!foundMatch) {
        console.log(`[LunaTalkHandler] ❌ No matching dialogue found for "${character.name}"`);
      }
    });

    // 원본 이미지 숨기기
    this.hideOriginalImages(cbox.shadowRoot);

    console.log('[LunaTalkHandler] ✅ Display complete');
  }

  /**
   * 이름 매칭 검사 (부분 일치 지원)
   *
   * @param {string} dialogueName - dialogue에서 추출한 이름 (예: "엔비")
   * @param {string} characterName - 캐릭터 전체 이름 (예: "엔비 스텔라")
   * @returns {boolean} 매칭 여부
   * @private
   */
  isNameMatch(dialogueName, characterName) {
    const lowerDialogue = dialogueName.toLowerCase().trim();
    const lowerCharacter = characterName.toLowerCase().trim();

    // 1. 완전 일치
    if (lowerDialogue === lowerCharacter) {
      return true;
    }

    // 2. dialogue 이름이 캐릭터 이름에 포함 ("엔비" ⊂ "엔비 스텔라")
    if (lowerCharacter.includes(lowerDialogue)) {
      return true;
    }

    // 3. 캐릭터 이름이 dialogue 이름에 포함 ("엔비 스텔라" ⊂ "엔비 스텔라 (본명)")
    if (lowerDialogue.includes(lowerCharacter)) {
      return true;
    }

    // 4. 단어 단위 부분 일치 (공백으로 분리)
    const dialogueWords = lowerDialogue.split(/\s+/);
    const characterWords = lowerCharacter.split(/\s+/);

    // dialogue 단어 중 하나라도 캐릭터 단어와 일치하면 매칭
    for (const dWord of dialogueWords) {
      if (dWord.length >= 2 && characterWords.includes(dWord)) {
        return true;
      }
    }

    return false;
  }

  /**
   * 원본 이미지 숨기기 (Extension 이미지는 제외)
   *
   * @param {ShadowRoot} shadowRoot - Shadow DOM 루트
   * @private
   */
  hideOriginalImages(shadowRoot) {
    const allImages = shadowRoot.querySelectorAll('.content img');
    const originalImages = Array.from(allImages).filter((img) => {
      const isInsideExtension =
        img.closest('.extension-character-image') || img.closest('.extension-single-image');
      const hasExtensionClass = img.classList.contains('extension-image');
      return !isInsideExtension && !hasExtensionClass;
    });

    console.log(
      `[LunaTalkHandler] 🙈 Hiding ${originalImages.length} original images (total: ${allImages.length})`
    );

    originalImages.forEach((img) => {
      if (img instanceof HTMLElement) {
        img.style.display = 'none';
      }
    });
  }

  /**
   * @override
   * LunaTalk: Shadow DOM 생성 감지 및 스트리밍 중 dialogue 추가 감지
   */
  setupMessageObserver(messageElement) {
    // 이미 Observer가 설정되어 있으면 스킵
    if (this.shadowObservers.has(messageElement)) {
      console.log('[LunaTalkHandler] ⏭️  Observer already exists');
      return;
    }

    // AI 메시지인지 확인
    if (!messageElement.classList.contains('aichat')) {
      console.log('[LunaTalkHandler] ⏭️  Not an AI message');
      return;
    }

    const cbox = messageElement.querySelector('.cbox');

    // Shadow DOM이 아직 없으면 .cbox 감시
    if (!cbox || !cbox.shadowRoot) {
      this.setupCboxObserver(messageElement, cbox);
      return;
    }

    // Shadow DOM이 있으면 폴링 + MutationObserver 설정
    this.setupShadowDOMPolling(messageElement, cbox);
  }

  /**
   * .cbox 요소를 감시하여 Shadow DOM 생성 감지
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @param {Element|null} cbox - .cbox 요소
   * @private
   */
  setupCboxObserver(messageElement, cbox) {
    console.log('[LunaTalkHandler] ⚠️  Shadow DOM not found, watching .cbox...');

    const cboxObserver = new MutationObserver(() => {
      const currentCbox = messageElement.querySelector('.cbox');

      if (currentCbox && currentCbox.shadowRoot) {
        console.log('[LunaTalkHandler] ✅ Shadow DOM detected!');
        cboxObserver.disconnect();
        this.setupMessageObserver(messageElement); // 재귀 호출
      }
    });

    if (cbox) {
      cboxObserver.observe(cbox, {
        childList: true,
        attributes: true,
        subtree: true,
        characterData: true,
      });

      // 30초 후 자동 정리
      setTimeout(() => {
        cboxObserver.disconnect();
      }, 30000);
    }
  }

  /**
   * Shadow DOM 내부 폴링 및 MutationObserver 설정
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @param {Element} cbox - .cbox 요소
   * @private
   */
  setupShadowDOMPolling(messageElement, cbox) {
    console.log('[LunaTalkHandler] 🔍 Setting up Shadow DOM polling');

    let lastDialogueCount = 0;
    let lastImageCount = 0;
    let pollCount = 0;

    // 폴링: 200ms마다 dialogue/이미지 개수 체크
    const pollingInterval = setInterval(() => {
      pollCount++;
      const isStreaming = messageElement.classList.contains('streaming');

      if (!cbox.shadowRoot) {
        clearInterval(pollingInterval);
        return;
      }

      const currentDialogues = cbox.shadowRoot.querySelectorAll('.dialogue');
      const currentImages = cbox.shadowRoot.querySelectorAll('.content img:not(.extension-image)');

      // dialogue나 이미지가 새로 추가되었는지 확인
      if (
        currentDialogues.length > lastDialogueCount ||
        currentImages.length > lastImageCount
      ) {
        console.log(`[LunaTalkHandler] 🆕 New content detected!`);
        console.log(
          `[LunaTalkHandler] 📊 Dialogues: ${lastDialogueCount} → ${currentDialogues.length}`
        );

        lastDialogueCount = currentDialogues.length;
        lastImageCount = currentImages.length;

        // 메시지 처리 이벤트 발생 (content.js에서 처리)
        const event = new CustomEvent('extension:processMessage', {
          detail: { messageElement },
        });
        document.dispatchEvent(event);
      }

      // 스트리밍 완료 시 폴링 중지
      if (!isStreaming && pollCount > 5) {
        console.log('[LunaTalkHandler] ✅ Streaming complete, stopping poll');
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
    }, 200);

    this.pollingIntervals.set(messageElement, pollingInterval);

    // 30초 후 자동 정리
    setTimeout(() => {
      const interval = this.pollingIntervals.get(messageElement);
      if (interval) {
        clearInterval(interval);
        this.pollingIntervals.delete(messageElement);
      }
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
    this.shadowObservers.delete(messageElement);
  }
}
