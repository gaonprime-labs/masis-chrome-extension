// LunaTalkPlatform.js - LunaTalk 플랫폼 구현체
// @ts-check

import { ChatPlatform } from './ChatPlatform.js';

/**
 * @fileoverview
 * LunaTalk 플랫폼의 구체적인 구현입니다.
 * DOM 선택자는 dom-analyzer.js로 자동 분석한 결과를 기반으로 합니다.
 *
 * SOLID 원칙:
 * - SRP: LunaTalk 플랫폼의 DOM 선택 및 메시지 처리만 담당
 * - OCP: ChatPlatform 인터페이스 확장으로 기능 추가
 * - LSP: ChatPlatform의 모든 메서드를 올바르게 구현
 *
 * DOM 선택자 정보:
 * - 메시지: #messageList > li.cWrap (각 li가 하나의 메시지)
 * - 메시지 내용: .cbox (Shadow DOM 호스트)
 * - Shadow DOM: .cbox.shadowRoot (실제 콘텐츠는 Shadow DOM 안에 있음)
 * - 네임태그: .cName (캐릭터 이름)
 * - 이미지: Shadow DOM 안의 .content img
 * - 이미지 컨테이너: Shadow DOM 안의 img 태그
 * - 스트리밍 인디케이터: .loadingText
 * - 단락 요소: Shadow DOM 안의 .content
 */

/**
 * LunaTalk 플랫폼 구현
 *
 * @extends {ChatPlatform}
 */
export class LunaTalkPlatform extends ChatPlatform {
  /**
   * @override
   */
  getName() {
    return 'LunaTalk';
  }

  /**
   * @override
   */
  getId() {
    return 'lunatalk';
  }

  /**
   * @override
   */
  getMessageSelector() {
    return '#messageList > li.cWrap';
  }

  /**
   * @override
   */
  getNametagSelector() {
    return '.cName';
  }

  /**
   * @override
   */
  getImageContainerSelector() {
    return '.content img:not(.extension-image)';
  }

  /**
   * @override
   */
  getStreamingIndicatorSelector() {
    return '.loadingText';
  }

  /**
   * @override
   */
  getParentLineSelector() {
    return '.content';
  }

  /**
   * 메시지 내 모든 네임태그 찾기
   *
   * @param {Element} messageElement - 메시지 요소
   * @returns {Element[]} 네임태그 요소 배열
   */
  getNametagsInMessage(messageElement) {
    return Array.from(messageElement.querySelectorAll(this.getNametagSelector()));
  }

  /**
   * 메시지 내 모든 원본 이미지 컨테이너 찾기
   * LunaTalk은 Shadow DOM을 사용하므로 특별 처리 필요
   *
   * @param {Element} messageElement - 메시지 요소
   * @returns {Element[]} 이미지 컨테이너 요소 배열
   */
  getOriginalImagesInMessage(messageElement) {
    // .cbox 요소 찾기
    const cbox = messageElement.querySelector('.cbox');
    if (!cbox || !cbox.shadowRoot) {
      return [];
    }

    // Shadow DOM 안에서 이미지 찾기
    const images = cbox.shadowRoot.querySelectorAll('.content img:not(.extension-image)');
    return Array.from(images);
  }

  /**
   * 메시지가 현재 스트리밍 중인지 확인
   *
   * @param {Element} messageElement - 메시지 요소
   * @returns {boolean} 스트리밍 중이면 true
   */
  isMessageStreaming(messageElement) {
    const streamingIndicator = messageElement.querySelector(this.getStreamingIndicatorSelector());
    return Boolean(streamingIndicator);
  }

  /**
   * 메시지에 원본 이미지가 있는지 확인
   *
   * @param {Element} messageElement - 메시지 요소
   * @returns {boolean} 원본 이미지가 있으면 true
   */
  hasOriginalImages(messageElement) {
    const originalImages = this.getOriginalImagesInMessage(messageElement);
    return originalImages.length > 0;
  }

  /**
   * 원본 이미지를 익스텐션 이미지로 교체
   *
   * @param {Element} originalImageContainer - 원본 이미지 컨테이너
   * @param {Element} extensionImageContainer - 익스텐션 이미지 컨테이너
   * @returns {boolean} 교체 성공 여부
   */
  replaceOriginalImageWithExtension(originalImageContainer, extensionImageContainer) {
    if (!originalImageContainer.parentElement) {
      return false;
    }

    // 익스텐션 이미지임을 표시
    extensionImageContainer.classList.add('extension-character-image');

    // 원본 이미지 앞에 익스텐션 이미지 삽입
    originalImageContainer.parentElement.insertBefore(extensionImageContainer, originalImageContainer);

    // 원본 이미지 숨기기
    if (originalImageContainer instanceof HTMLElement) {
      originalImageContainer.style.display = 'none';
    }

    return true;
  }

  /**
   * @override
   * LunaTalk 메시지 텍스트 추출
   * Shadow DOM 내부의 .content 요소에서 텍스트 추출
   */
  extractMessageText(messageElement) {
    const cbox = messageElement.querySelector('.cbox');
    if (cbox && cbox.shadowRoot) {
      const content = cbox.shadowRoot.querySelector('.content');
      if (content) {
        return content.textContent?.trim() || '';
      }
    }
    // Fallback
    return messageElement.textContent?.trim() || '';
  }
}
