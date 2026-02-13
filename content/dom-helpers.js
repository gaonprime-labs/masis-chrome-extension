// dom-helpers.js - DOM 쿼리 헬퍼 함수들
// @ts-check

/**
 * @fileoverview
 * DOM 쿼리 관련 유틸리티 함수 모음
 *
 * SOLID 원칙:
 * - SRP: DOM 쿼리 로직만 담당
 * - OCP: 새로운 DOM 쿼리 패턴 추가 가능
 * - ISP: 각 함수는 특정 목적만 수행
 */

/**
 * Shadow DOM을 지원하는 querySelectorAll
 * LunaTalk처럼 Shadow DOM을 사용하는 플랫폼을 위한 헬퍼 함수
 *
 * @param {Element} element - 검색할 부모 요소
 * @param {string} selector - CSS 선택자
 * @param {string} platformId - 플랫폼 ID (noahchat, lunatalk)
 * @returns {Element[]} 찾은 요소 배열
 */
export function querySelectorAllWithShadow(element, selector, platformId) {
  // 일반 쿼리 시도
  let results = Array.from(element.querySelectorAll(selector));

  // LunaTalk: .cbox 안의 Shadow DOM 확인
  if (platformId === 'lunatalk') {
    const cbox = element.querySelector('.cbox');
    if (cbox && cbox.shadowRoot) {
      const shadowResults = Array.from(cbox.shadowRoot.querySelectorAll(selector));
      results = results.concat(shadowResults);
    }
  }

  return results;
}

/**
 * 메시지 요소에서 원본 이미지 찾기
 *
 * @param {HTMLElement} messageElement - 메시지 요소
 * @param {string} imageSelector - 이미지 선택자
 * @param {string} platformId - 플랫폼 ID
 * @returns {Element[]} 이미지 요소 배열
 */
export function getOriginalImages(messageElement, imageSelector, platformId) {
  return querySelectorAllWithShadow(messageElement, imageSelector, platformId);
}
