// image-display.js - 이미지 표시 로직
// @ts-check

/**
 * @fileoverview
 * 채팅 메시지에 캐릭터 이미지를 표시하는 로직
 *
 * SOLID 원칙:
 * - SRP: 이미지 표시/생성만 담당
 * - OCP: 새로운 이미지 스타일 추가 가능
 * - DIP: 플랫폼 선택자에 의존 (추상화)
 */

/**
 * 이미지 표시 관리자 클래스
 */
export class ImageDisplayManager {
  /**
   * @param {string} platformId - 플랫폼 ID
   * @param {Object} selectors - 플랫폼별 선택자
   */
  constructor(platformId, selectors) {
    this.platformId = platformId;
    this.selectors = selectors;
  }

  /**
   * 여러 등장인물의 이미지를 표시 (각 인물 대사 위에 배치)
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @param {Array} characters - 인물 배열 (images 포함)
   */
  displayMultipleCharacters(messageElement, characters) {
    console.log('[ImageDisplay] 🎨 Displaying', characters.length, 'characters');
    console.log('[ImageDisplay] 📝 Characters:', characters.map(c => `${c.name} (${c.images?.length || 0} images)`).join(', '));

    // === DOM 구조 분석 (디버깅) ===
    console.log('[ImageDisplay] 🔍 === ANALYZING DOM STRUCTURE ===');

    // 원본 이미지 컨테이너들 찾기
    const originalImageContainers = messageElement.querySelectorAll(this.selectors.imageContainer);
    console.log(`[ImageDisplay] 📦 Found ${originalImageContainers.length} original image containers`);

    originalImageContainers.forEach((container, idx) => {
      console.log(`[ImageDisplay] 📦 Container ${idx + 1}:`);
      console.log(`  - Parent: ${container.parentElement?.tagName}.${container.parentElement?.className}`);
      console.log(`  - Previous sibling: ${container.previousElementSibling?.tagName}.${container.previousElementSibling?.className}`);
      console.log(`  - Next sibling: ${container.nextElementSibling?.tagName}.${container.nextElementSibling?.className}`);
    });

    console.log('[ImageDisplay] 🔍 === END DOM ANALYSIS ===');

    // 각 인물마다 대사를 찾아서 그 위에 이미지 삽입
    characters.forEach((character, charIndex) => {
      console.log(`[ImageDisplay] 🔍 Processing character ${charIndex + 1}/${characters.length}: "${character.name}"`);

      if (!character.images || character.images.length === 0) {
        console.log(`[ImageDisplay] ⚠️  Character "${character.name}" has no images, skipping`);
        return;
      }

      console.log(`[ImageDisplay] ✅ Character "${character.name}" has ${character.images.length} images`);

      // 인물 이름이 포함된 네임태그 찾기
      const nametagSpans = messageElement.querySelectorAll(this.selectors.nametag);
      console.log(`[ImageDisplay] 🏷️  Found ${nametagSpans.length} nametags in message`);

      // 디버깅: 모든 네임태그 텍스트 출력
      const nametagTexts = Array.from(nametagSpans).map(tag => tag.textContent.trim());
      console.log(`[ImageDisplay] 🏷️  Nametag texts:`, nametagTexts);

      let foundMatch = false;
      for (const nametag of nametagSpans) {
        const nametagText = nametag.textContent.trim();
        console.log(`[ImageDisplay] 🔎 Checking nametag: "${nametagText}" vs character: "${character.name}"`);

        // 네임태그 텍스트가 인물 이름과 일치하는지 확인
        if (nametagText === character.name) {
          console.log(`[ImageDisplay] ✅ Name match found!`);
          foundMatch = true;

          // 네임태그가 속한 단락 찾기
          const parentLine = nametag.closest(this.selectors.parentLine);
          if (!parentLine) {
            console.log(`[ImageDisplay] ❌ parentLine not found for "${character.name}"`);
            continue;
          }

          // 이 단락 안에서 원본 이미지 컨테이너 찾기
          const originalImageContainer = parentLine.querySelector(this.selectors.imageContainer);
          if (!originalImageContainer) {
            console.log(`[ImageDisplay] ❌ Original image container not found for "${character.name}"`);
            continue;
          }

          console.log(`[ImageDisplay] 📍 Found original image container for "${character.name}"`);

          // 이미 Extension 이미지로 교체되었는지 확인
          const prevElement = originalImageContainer.previousElementSibling;
          if (prevElement && prevElement.classList.contains('extension-character-image')) {
            console.log(`[ImageDisplay] ⏭️  Image already replaced for "${character.name}", skipping`);
            continue;
          }

          // Extension 이미지 컨테이너 생성
          console.log(`[ImageDisplay] 🖼️  Creating extension image container for "${character.name}"`);
          const imageContainer = this.createSingleImageContainer(character.images[0]);
          imageContainer.classList.add('extension-character-image');

          // 원본 이미지 컨테이너를 Extension 이미지로 교체
          if (!originalImageContainer.parentElement) {
            console.log(`[ImageDisplay] ❌ Original container has no parent for "${character.name}"`);
            continue;
          }

          console.log(`[ImageDisplay] 📌 Replacing original image with extension image for "${character.name}"`);
          console.log(`  - Original container parent: ${originalImageContainer.parentElement.tagName}`);
          originalImageContainer.parentElement.insertBefore(imageContainer, originalImageContainer);

          // 원본 이미지 숨기기 (HTMLElement로 캐스팅)
          if (originalImageContainer instanceof HTMLElement) {
            originalImageContainer.style.display = 'none';
          }

          console.log(`[ImageDisplay] ✅ Successfully replaced image for ${character.name}`);
        }
      }

      if (!foundMatch) {
        console.log(`[ImageDisplay] ❌ No matching nametag found for "${character.name}"`);
      }
    });

    console.log('[ImageDisplay] ✅ Display complete - images placed above dialogues');

    // 원본 이미지 숨기기 (이미지 삽입 후)
    this.hideOriginalImages(messageElement);
  }

  /**
   * 단일 이미지 컨테이너 생성 (기존 채팅 UI 스타일)
   *
   * @param {Object} imageData - 이미지 데이터
   * @returns {HTMLElement} 이미지 컨테이너 요소
   */
  createSingleImageContainer(imageData) {
    // API 응답에서 이미지 URL 추출 (imageUrl 또는 thumbnail 사용)
    const imageUrl = imageData.imageUrl || imageData.thumbnail;

    if (!imageUrl) {
      console.error('[ImageDisplay] ❌ No image URL found in imageData:', imageData);
      // 빈 컨테이너 반환
      const emptyWrapper = document.createElement('span');
      emptyWrapper.className = 'extension-single-image';
      return emptyWrapper;
    }

    console.log('[ImageDisplay] 🖼️  Using image URL:', imageUrl);

    // 기존 채팅 이미지와 동일한 구조: span.block.my-2.rounded-lg
    const wrapper = document.createElement('span');
    wrapper.className = 'extension-single-image block my-2 rounded-lg overflow-hidden relative';
    wrapper.style.cssText = `
      min-height: 440px;
      cursor: pointer;
    `;

    // 배경 블러 이미지 (기존 UI 스타일)
    const bgImg = document.createElement('img');
    bgImg.src = imageUrl;
    bgImg.setAttribute('aria-hidden', 'true');
    bgImg.className = 'absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-50';

    // 메인 이미지
    const mainImg = document.createElement('img');
    mainImg.src = imageUrl;
    mainImg.alt = 'Character';
    mainImg.className = 'relative block max-w-full max-h-110 h-auto mx-auto object-contain';

    // 클릭 이벤트 - 새 탭에서 열기
    wrapper.addEventListener('click', () => {
      window.open(imageUrl, '_blank');
    });

    wrapper.appendChild(bgImg);
    wrapper.appendChild(mainImg);

    return wrapper;
  }

  /**
   * 원본 이미지 숨기기
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   */
  hideOriginalImages(messageElement) {
    console.log('[ImageDisplay] 🙈 Hiding original images...');
    const allImageContainers = messageElement.querySelectorAll('span.block.my-2.rounded-lg');
    console.log(`[ImageDisplay] 📊 Found ${allImageContainers.length} total image containers`);

    let hiddenCount = 0;
    allImageContainers.forEach((container, idx) => {
      // Extension이 생성한 이미지는 제외 (extension-single-image 또는 extension-character-image 클래스 있음)
      const isExtensionImage = container.classList.contains('extension-single-image') ||
                               container.classList.contains('extension-character-image');

      if (!isExtensionImage) {
        console.log(`[ImageDisplay] 🔍 Container ${idx + 1}: Original image detected, hiding`);
        if (container instanceof HTMLElement) {
          container.style.display = 'none';
        }
        hiddenCount++;
      } else {
        console.log(`[ImageDisplay] ✅ Container ${idx + 1}: Extension image, keeping visible`);
      }
    });

    console.log(`[ImageDisplay] 🙈 Hidden ${hiddenCount} original image containers`);
  }

  /**
   * 기존 Extension 이미지 제거
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {number} 제거된 이미지 수
   */
  removeExistingExtensionImages(messageElement) {
    let removedCount = 0;

    // 1. 개별 이미지 제거
    const existingExtensionImages = messageElement.querySelectorAll('.extension-character-image');
    if (existingExtensionImages.length > 0) {
      console.log(`[ImageDisplay] 🧹 Removing ${existingExtensionImages.length} existing extension images`);
      existingExtensionImages.forEach((img) => img.remove());
      removedCount += existingExtensionImages.length;
      delete messageElement.dataset.extensionProcessed;
    }

    // 2. 이전 방식의 컨테이너 제거 (레거시 클린업)
    const legacyContainer = messageElement.querySelector('.extension-characters-container');
    if (legacyContainer) {
      console.log('[ImageDisplay] 🧹 Removing legacy container');
      legacyContainer.remove();
      removedCount++;
      delete messageElement.dataset.extensionProcessed;
    }

    return removedCount;
  }
}
