// ChatPlatform.js - 채팅 플랫폼 추상화 인터페이스
// @ts-check

/**
 * @fileoverview
 * 채팅 플랫폼별 동작을 정의하는 추상 인터페이스입니다.
 * 새로운 플랫폼을 추가할 때 이 클래스를 상속받아 구현하세요.
 *
 * SOLID 원칙:
 * - SRP: 플랫폼별 DOM 선택자 및 메시지 처리 책임만
 * - OCP: 새 플랫폼 추가 시 기존 코드 수정 없이 확장
 * - LSP: 모든 구현체는 동일한 인터페이스 준수
 * - ISP: 필수 메서드만 포함
 * - DIP: content.js는 이 추상화에 의존
 */

/**
 * 채팅 플랫폼 추상 클래스
 *
 * @abstract
 */
export class ChatPlatform {
  /**
   * 플랫폼 이름
   * @returns {string}
   */
  getName() {
    throw new Error('Method getName() must be implemented');
  }

  /**
   * 플랫폼 식별자 (설정 저장용)
   * @returns {string}
   */
  getId() {
    throw new Error('Method getId() must be implemented');
  }

  /**
   * 채팅 메시지 요소 선택자
   * @returns {string} CSS 선택자
   */
  getMessageSelector() {
    throw new Error('Method getMessageSelector() must be implemented');
  }

  /**
   * 인물 네임태그 선택자
   * @returns {string} CSS 선택자
   */
  getNametagSelector() {
    throw new Error('Method getNametagSelector() must be implemented');
  }

  /**
   * 원본 이미지 컨테이너 선택자
   * @returns {string} CSS 선택자
   */
  getImageContainerSelector() {
    throw new Error('Method getImageContainerSelector() must be implemented');
  }

  /**
   * 메시지가 스트리밍 중인지 확인하는 선택자
   * @returns {string} CSS 선택자
   */
  getStreamingIndicatorSelector() {
    throw new Error('Method getStreamingIndicatorSelector() must be implemented');
  }

  /**
   * 주어진 요소가 채팅 메시지 요소인지 확인
   *
   * @param {Element} element - 확인할 요소
   * @returns {HTMLElement|null} 메시지 요소 또는 null
   */
  findChatMessage(element) {
    if (element instanceof HTMLElement && element.matches(this.getMessageSelector())) {
      return element;
    }
    return element.closest(this.getMessageSelector());
  }

  /**
   * 메시지 요소가 이미 처리되었는지 확인
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {boolean}
   */
  isMessageProcessed(messageElement) {
    return messageElement.dataset.extensionProcessed === 'true';
  }

  /**
   * 메시지를 처리됨으로 표시
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   */
  markMessageProcessed(messageElement) {
    messageElement.dataset.extensionProcessed = 'true';
  }

  /**
   * 메시지가 현재 처리 중인지 확인
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {boolean}
   */
  isMessageProcessing(messageElement) {
    return messageElement.dataset.extensionProcessing === 'true';
  }

  /**
   * 메시지를 처리 중으로 표시
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   */
  markMessageProcessing(messageElement) {
    messageElement.dataset.extensionProcessing = 'true';
  }

  /**
   * 메시지 처리 중 상태 해제
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   */
  unmarkMessageProcessing(messageElement) {
    delete messageElement.dataset.extensionProcessing;
  }

  /**
   * 단락 요소 선택자 (네임태그가 속한 부모)
   * @returns {string} CSS 선택자
   */
  getParentLineSelector() {
    throw new Error('Method getParentLineSelector() must be implemented');
  }

  /**
   * 메시지 내 모든 원본 이미지 찾기 (플랫폼별 구현)
   * Shadow DOM 등 특수한 DOM 구조를 처리해야 하는 경우 오버라이드
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {Element[]} 이미지 요소 배열
   */
  getOriginalImagesInMessage(messageElement) {
    // 기본 구현: 일반 DOM 쿼리
    const selector = this.getImageContainerSelector();
    const imageSelector = selector.includes('img') ? selector : `${selector} img`;
    return Array.from(messageElement.querySelectorAll(imageSelector));
  }

  /**
   * 메시지 텍스트 추출 (플랫폼별 구현)
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {string} 추출된 텍스트
   */
  extractMessageText(messageElement) {
    // 기본 구현: textContent 사용
    return messageElement.textContent?.trim() || '';
  }
}
