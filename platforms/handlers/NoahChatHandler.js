// platforms/handlers/NoahChatHandler.js
// @ts-check

import { PlatformHandler } from './PlatformHandler.js';

/**
 * @fileoverview
 * NoahChat 플랫폼 전용 이미지 처리 Handler입니다.
 * 일반 DOM 구조를 사용하며, 네임태그를 기반으로 이미지를 삽입합니다.
 *
 * SOLID 원칙:
 * - SRP: NoahChat의 이미지 표시 로직만 담당
 * - OCP: PlatformHandler를 확장하여 기능 추가
 * - LSP: PlatformHandler의 모든 메서드를 올바르게 구현
 */

/**
 * NoahChat 플랫폼 Handler
 *
 * @extends {PlatformHandler}
 */
export class NoahChatHandler extends PlatformHandler {
  /**
   * @override
   * NoahChat: 네임태그를 찾아 해당 단락에 이미지 삽입
   */
  displayCharacters(messageElement, characters) {
    console.log('[NoahChatHandler] 🎨 Displaying', characters.length, 'characters');

    // 1. 로딩 플레이스홀더 제거 (이미지 삽입 전)
    const loadingPlaceholders = messageElement.querySelectorAll('.extension-loading-placeholder');
    console.log(`[NoahChatHandler] 🧹 Removing ${loadingPlaceholders.length} loading placeholders`);
    loadingPlaceholders.forEach((placeholder) => {
      placeholder.style.opacity = '0';
      setTimeout(() => placeholder.remove(), 300);
    });

    const nametagSelector = this.platform.getNametagSelector();
    const parentLineSelector = this.platform.getParentLineSelector();
    const imageContainerSelector = this.platform.getImageContainerSelector();

    characters.forEach((character, charIndex) => {
      console.log(
        `[NoahChatHandler] 🔍 Processing character ${charIndex + 1}/${characters.length}: "${character.name}"`
      );

      if (!character.images || character.images.length === 0) {
        console.log(`[NoahChatHandler] ⚠️  Character "${character.name}" has no images, skipping`);
        return;
      }

      const nametagSpans = messageElement.querySelectorAll(nametagSelector);
      console.log(`[NoahChatHandler] 🏷️  Found ${nametagSpans.length} nametags in message`);

      let foundMatch = false;

      for (const nametag of nametagSpans) {
        const nametagText = nametag.textContent?.trim() || '';

        if (nametagText === character.name) {
          console.log(`[NoahChatHandler] ✅ Name match found for "${character.name}"`);
          foundMatch = true;

          // 네임태그가 속한 단락 찾기
          const parentLine = nametag.closest(parentLineSelector);
          if (!parentLine) {
            console.log(`[NoahChatHandler] ❌ Parent line not found for "${character.name}"`);
            continue;
          }

          // 단락 내 원본 이미지 컨테이너 찾기
          const originalImageContainer = parentLine.querySelector(imageContainerSelector);
          if (!originalImageContainer) {
            console.log(
              `[NoahChatHandler] ❌ Original image container not found for "${character.name}"`
            );
            continue;
          }

          // 이미 교체되었는지 확인
          const prevElement = originalImageContainer.previousElementSibling;
          if (prevElement && prevElement.classList.contains('extension-character-image')) {
            console.log(`[NoahChatHandler] ⏭️  Image already replaced for "${character.name}"`);
            continue;
          }

          // Extension 이미지 생성
          const imageContainer = this.createImageContainer(character.images[0]);
          imageContainer.classList.add('extension-character-image');

          // 원본 이미지 앞에 삽입
          if (originalImageContainer.parentElement) {
            originalImageContainer.parentElement.insertBefore(
              imageContainer,
              originalImageContainer
            );

            // 원본 이미지 숨기기
            if (originalImageContainer instanceof HTMLElement) {
              originalImageContainer.style.display = 'none';
            }

            console.log(`[NoahChatHandler] ✅ Successfully replaced image for "${character.name}"`);
          } else {
            console.log(`[NoahChatHandler] ❌ No parent element for original image`);
          }
        }
      }

      if (!foundMatch) {
        console.log(`[NoahChatHandler] ❌ No matching nametag found for "${character.name}"`);
      }
    });

    console.log('[NoahChatHandler] ✅ Display complete');
  }

  /**
   * @override
   * NoahChat은 스트리밍 감지가 필요 없으므로 빈 구현
   */
  setupMessageObserver(messageElement) {
    // NoahChat은 일반 DOM 사용, 별도 Observer 불필요
  }
}
