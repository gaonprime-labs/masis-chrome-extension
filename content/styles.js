// content/styles.js
// @ts-check

/**
 * @fileoverview
 * Extension CSS 스타일 주입 모듈
 *
 * SOLID 원칙:
 * - SRP: CSS 스타일 주입만 담당
 * - OCP: 새 스타일 추가 시 함수 확장
 */

/**
 * Extension CSS 스타일 주입
 * - 애니메이션 정의
 * - 원본 이미지 숨김 (Light DOM, Shadow DOM)
 * - Extension 이미지 스타일
 */
export function injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
    /* ========================================
     * 애니메이션 정의
     * ======================================== */
    @keyframes extension-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.6; }
    }

    @keyframes extension-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes extension-fade-in {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .extension-loading-placeholder {
      transition: opacity 0.3s ease-out;
    }

    .extension-fade-in {
      animation: extension-fade-in 0.4s ease-out;
    }

    /* ========================================
     * 원본 이미지 즉시 숨김
     * ======================================== */

    /* NoahChat 원본 이미지 즉시 숨김 */
    span.block.my-2.rounded-lg:not(.extension-single-image):not(.extension-character-image):not(.extension-visible) {
      opacity: 0 !important;
      pointer-events: none !important;
      transition: opacity 0.2s ease-out;
    }

    /* LunaTalk 원본 이미지 즉시 숨김 (.content inner img) */
    .content img:not(.extension-image):not(.extension-visible) {
      opacity: 0 !important;
      pointer-events: none !important;
      transition: opacity 0.2s ease-out;
    }

    /* Extension 이미지는 항상 표시 */
    .extension-character-image,
    .extension-single-image,
    .extension-image,
    .extension-loading-placeholder {
      opacity: 1 !important;
      pointer-events: auto !important;
    }
  `;

  document.head.appendChild(style);
  console.log('[Styles] ✅ Extension styles injected');
}
