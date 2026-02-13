// NoahChatPlatform.js - NoahChat 플랫폼 구현체
// @ts-check

import { ChatPlatform } from './ChatPlatform.js';

/**
 * @fileoverview
 * NoahChat 플랫폼의 구체적인 구현입니다.
 * DOM 선택자와 메시지 처리 로직이 NoahChat에 특화되어 있습니다.
 *
 * SOLID 원칙:
 * - SRP: NoahChat 플랫폼의 DOM 선택 및 메시지 처리만 담당
 * - OCP: ChatPlatform 인터페이스 확장으로 기능 추가
 * - LSP: ChatPlatform의 모든 메서드를 올바르게 구현
 */

/**
 * NoahChat 플랫폼 구현
 *
 * @extends {ChatPlatform}
 */
export class NoahChatPlatform extends ChatPlatform {
  /**
   * @override
   */
  getName() {
    return 'NoahChat';
  }

  /**
   * @override
   */
  getId() {
    return 'noahchat';
  }

  /**
   * @override
   * NoahChat 메시지 요소 선택자
   * - .px-3: 패딩
   * - .transition-all: 애니메이션
   * - :not(.justify-end): 사용자 메시지 제외 (AI 메시지만)
   */
  getMessageSelector() {
    return '.px-3.transition-all:not(.justify-end)';
  }

  /**
   * @override
   * NoahChat 인물 네임태그 선택자
   * - span 태그
   * - inline-flex items-center: Flexbox 레이아웃
   * - shrink-0: 축소 방지
   * - whitespace-nowrap: 줄바꿈 방지
   * - rounded-md: 둥근 모서리
   * - font-medium: 중간 굵기 폰트
   */
  getNametagSelector() {
    return 'span.inline-flex.items-center.shrink-0.whitespace-nowrap.rounded-md.font-medium';
  }

  /**
   * @override
   * NoahChat 원본 이미지 컨테이너 선택자
   * - span 태그
   * - block: 블록 레벨 요소
   * - my-2: 수직 마진
   * - rounded-lg: 둥근 모서리
   * - :not(.extension-single-image): Extension이 생성한 이미지 제외
   * - :not(.extension-character-image): Extension이 생성한 인물 이미지 제외
   */
  getImageContainerSelector() {
    return 'span.block.my-2.rounded-lg:not(.extension-single-image):not(.extension-character-image)';
  }

  /**
   * @override
   * NoahChat 스트리밍 인디케이터 선택자
   * - .animate-shimmer: Shimmer 애니메이션 클래스
   */
  getStreamingIndicatorSelector() {
    return '.animate-shimmer';
  }

  /**
   * NoahChat 특화: 메시지 내 네임태그 찾기
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {NodeListOf<Element>} 네임태그 목록
   */
  getNametagsInMessage(messageElement) {
    return messageElement.querySelectorAll(this.getNametagSelector());
  }

  /**
   * NoahChat 특화: 메시지 내 원본 이미지 찾기
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {NodeListOf<Element>} 원본 이미지 컨테이너 목록
   */
  getOriginalImagesInMessage(messageElement) {
    return messageElement.querySelectorAll(this.getImageContainerSelector());
  }

  /**
   * NoahChat 특화: 메시지가 스트리밍 중인지 확인
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {boolean}
   */
  isMessageStreaming(messageElement) {
    const shimmerElement = messageElement.querySelector(this.getStreamingIndicatorSelector());
    return shimmerElement !== null;
  }

  /**
   * NoahChat 특화: 메시지에 원본 이미지가 있는지 확인
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {boolean}
   */
  hasOriginalImages(messageElement) {
    const images = messageElement.querySelectorAll(`${this.getImageContainerSelector()} img`);
    return images.length > 0;
  }

  /**
   * NoahChat 특화: 네임태그가 속한 단락 찾기
   *
   * @param {Element} nametag - 네임태그 요소
   * @returns {Element|null} 단락 요소 또는 null
   */
  getParentLineOfNametag(nametag) {
    return nametag.closest('p.whitespace-pre-wrap');
  }

  /**
   * NoahChat 특화: 단락 내 원본 이미지 컨테이너 찾기
   *
   * @param {Element} parentLine - 단락 요소
   * @returns {Element|null} 원본 이미지 컨테이너 또는 null
   */
  getOriginalImageContainerInLine(parentLine) {
    return parentLine.querySelector(this.getImageContainerSelector());
  }

  /**
   * NoahChat 특화: Extension 이미지가 이미 추가되었는지 확인
   *
   * @param {Element} originalImageContainer - 원본 이미지 컨테이너
   * @returns {boolean}
   */
  isExtensionImageAlreadyAdded(originalImageContainer) {
    const prevElement = originalImageContainer.previousElementSibling;
    return prevElement !== null && prevElement.classList.contains('extension-character-image');
  }

  /**
   * NoahChat 특화: 원본 이미지 컨테이너를 Extension 이미지로 교체
   *
   * @param {Element} originalImageContainer - 원본 이미지 컨테이너
   * @param {HTMLElement} extensionImageContainer - Extension 이미지 컨테이너
   * @returns {boolean} 성공 여부
   */
  replaceOriginalImageWithExtension(originalImageContainer, extensionImageContainer) {
    if (!originalImageContainer.parentElement) {
      return false;
    }

    // Extension 이미지 마커 추가
    extensionImageContainer.classList.add('extension-character-image');

    // 원본 이미지 앞에 Extension 이미지 삽입
    originalImageContainer.parentElement.insertBefore(
      extensionImageContainer,
      originalImageContainer
    );

    // 원본 이미지 숨기기
    if (originalImageContainer instanceof HTMLElement) {
      originalImageContainer.style.display = 'none';
    }

    return true;
  }

  /**
   * @override
   */
  getParentLineSelector() {
    return 'p.whitespace-pre-wrap';
  }

  /**
   * @override
   * NoahChat는 일반 DOM 사용 (Shadow DOM 없음)
   */
  getOriginalImagesInMessage(messageElement) {
    const selector = this.getImageContainerSelector();
    const imageSelector = selector.includes('img') ? selector : `${selector} img`;
    return Array.from(messageElement.querySelectorAll(imageSelector));
  }

  /**
   * @override
   * NoahChat 메시지 텍스트 추출
   * p.whitespace-pre-wrap 요소들의 텍스트를 합침
   */
  extractMessageText(messageElement) {
    const paragraphs = messageElement.querySelectorAll('p.whitespace-pre-wrap');
    if (paragraphs.length > 0) {
      const texts = Array.from(paragraphs)
        .map((p) => p.textContent?.trim())
        .filter((text) => text && text.length > 0);
      return texts.join('\n');
    }
    // Fallback
    return messageElement.textContent?.trim() || '';
  }
}
