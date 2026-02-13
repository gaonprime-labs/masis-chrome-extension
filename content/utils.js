// content/utils.js
// @ts-check

/**
 * @fileoverview
 * Extension 공통 유틸리티 함수 모듈
 *
 * SOLID 원칙:
 * - SRP: 유틸리티 함수만 제공
 * - OCP: 새 유틸리티 추가 시 기존 코드 수정 불필요
 */

/**
 * 로딩 플레이스홀더 생성
 * 원본 이미지 위치에 표시할 로딩 인디케이터
 *
 * @returns {HTMLElement} 로딩 플레이스홀더 요소
 */
export function createLoadingPlaceholder() {
  const placeholder = document.createElement('div');
  placeholder.className = 'extension-loading-placeholder';
  placeholder.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    background: linear-gradient(135deg, rgba(100, 100, 100, 0.1) 0%, rgba(150, 150, 150, 0.1) 100%);
    border-radius: 0.5rem;
    margin: 0.5rem 0;
    position: relative;
    overflow: hidden;
    animation: extension-pulse 1.5s ease-in-out infinite;
  `;

  // 로딩 스피너
  const spinner = document.createElement('div');
  spinner.className = 'extension-loading-spinner';
  spinner.style.cssText = `
    width: 40px;
    height: 40px;
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-top-color: rgba(255, 255, 255, 0.8);
    border-radius: 50%;
    animation: extension-spin 0.8s linear infinite;
  `;

  placeholder.appendChild(spinner);

  return placeholder;
}

/**
 * 요소 또는 그 부모에서 채팅 메시지 요소 찾기
 *
 * @param {Element} element - 검색 시작 요소
 * @param {string} messageSelector - 메시지 선택자
 * @returns {HTMLElement|null} 채팅 메시지 요소 또는 null
 */
export function findChatMessage(element, messageSelector) {
  // 1. 자신이 메시지인지 확인
  if (element.matches && element.matches(messageSelector)) {
    return /** @type {HTMLElement} */ (element);
  }

  // 2. 자손 중에 메시지가 있는지 확인
  const descendant = element.querySelector(messageSelector);
  if (descendant instanceof HTMLElement) {
    return descendant;
  }

  // 3. 부모 중에 메시지가 있는지 확인 (최대 5단계)
  let current = element.parentElement;
  let depth = 0;
  while (current && depth < 5) {
    if (current.matches && current.matches(messageSelector)) {
      return current;
    }
    current = current.parentElement;
    depth++;
  }

  // 4. 형제 요소 중에서 메시지 찾기
  const parent = element.parentElement;
  if (!parent) return null;

  const possibleMessage = parent.querySelector(messageSelector);
  return possibleMessage instanceof HTMLElement ? possibleMessage : null;
}
