// platforms/handlers/PlatformHandler.js
// @ts-check

/**
 * @fileoverview
 * 플랫폼별 이미지 처리 Handler의 추상 클래스입니다.
 * 각 플랫폼(NoahChat, LunaTalk)은 이 클래스를 상속받아 구현합니다.
 *
 * SOLID 원칙:
 * - SRP: 이미지 표시 및 플랫폼별 DOM 처리만 담당
 * - OCP: 새 플랫폼은 이 클래스를 상속하여 확장
 * - LSP: 모든 Handler는 동일한 인터페이스로 대체 가능
 * - DIP: content.js는 구체적 Handler가 아닌 이 인터페이스에 의존
 */

/**
 * 플랫폼별 이미지 처리 Handler 추상 클래스
 */
export class PlatformHandler {
  /**
   * @param {import('../ChatPlatform.js').ChatPlatform} platform - 플랫폼 인스턴스
   */
  constructor(platform) {
    this.platform = platform;
  }

  /**
   * 여러 캐릭터의 이미지를 메시지에 표시
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @param {Array<{name: string, images: Array<{url: string}>}>} characters - 캐릭터 배열
   * @abstract
   */
  displayCharacters(messageElement, characters) {
    throw new Error('Method displayCharacters() must be implemented by subclass');
  }

  /**
   * 메시지 감시 설정 (스트리밍 감지 등)
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @abstract
   */
  setupMessageObserver(messageElement) {
    // 기본 구현: 아무것도 하지 않음 (NoahChat은 불필요)
    // LunaTalk은 이 메서드를 오버라이드하여 Shadow DOM Observer 설정
  }

  /**
   * 단일 이미지 컨테이너 생성
   *
   * @param {{imageUrl?: string, thumbnail?: string, url?: string}} imageData - 이미지 데이터
   * @returns {HTMLElement}
   * @protected
   */
  createImageContainer(imageData) {
    // API 응답에서 이미지 URL 추출 (imageUrl 또는 thumbnail 사용)
    const imageUrl = imageData.imageUrl || imageData.thumbnail || imageData.url;

    console.log('[PlatformHandler] 🖼️  createImageContainer called');
    console.log('[PlatformHandler] 📦 imageData:', imageData);
    console.log('[PlatformHandler] 🎯 Extracted imageUrl:', imageUrl);

    if (!imageUrl) {
      console.error('[PlatformHandler] ❌ No image URL found in imageData:', imageData);
      // 빈 컨테이너 반환
      const emptyWrapper = document.createElement('span');
      emptyWrapper.className = 'extension-single-image';
      return emptyWrapper;
    }

    const wrapper = document.createElement('span');
    wrapper.className = 'extension-single-image extension-character-image extension-fade-in';
    wrapper.style.cssText = `
      display: block;
      margin: 0.5rem 0;
      border-radius: 0.5rem;
      overflow: hidden;
      position: relative;
      min-height: 440px;
      cursor: pointer;
    `;

    // 배경 블러 이미지
    const bgImg = document.createElement('img');
    console.log('[PlatformHandler] 🔧 Setting bgImg.src to:', imageUrl);
    bgImg.src = imageUrl;
    bgImg.setAttribute('aria-hidden', 'true');
    bgImg.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: blur(40px);
      transform: scale(1.1);
      opacity: 0.5;
    `;

    // 메인 이미지
    const mainImg = document.createElement('img');
    console.log('[PlatformHandler] 🔧 Setting mainImg.src to:', imageUrl);
    mainImg.src = imageUrl;
    mainImg.alt = 'Character';
    mainImg.classList.add('extension-image');
    mainImg.style.cssText = `
      position: relative;
      display: block;
      max-width: 100%;
      max-height: 500px;
      height: auto;
      margin: 0 auto;
      object-fit: contain;
    `;

    // src 설정 후 확인
    console.log('[PlatformHandler] ✅ bgImg.src after setting:', bgImg.src);
    console.log('[PlatformHandler] ✅ mainImg.src after setting:', mainImg.src);

    // 클릭 시 새 탭에서 열기
    wrapper.addEventListener('click', () => {
      window.open(imageUrl, '_blank');
    });

    wrapper.appendChild(bgImg);
    wrapper.appendChild(mainImg);

    return wrapper;
  }
}
