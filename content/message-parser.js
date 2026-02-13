// message-parser.js - 메시지 파싱 로직
// @ts-check

/**
 * @fileoverview
 * 채팅 메시지에서 텍스트와 메타데이터를 추출하는 파서
 *
 * SOLID 원칙:
 * - SRP: 메시지 파싱만 담당
 * - OCP: 새로운 파싱 패턴 추가 가능
 * - DIP: 플랫폼 선택자에 의존 (추상화)
 */

/**
 * 메시지 파서 클래스
 */
export class MessageParser {
  /**
   * @param {string} platformId - 플랫폼 ID
   * @param {Object} selectors - 플랫폼별 선택자
   */
  constructor(platformId, selectors) {
    this.platformId = platformId;
    this.selectors = selectors;
  }

  /**
   * 채팅 메시지 요소 찾기
   *
   * @param {Element} element - 검색 시작 요소
   * @returns {HTMLElement|null} 메시지 요소
   */
  findChatMessage(element) {
    // 현재 요소가 메시지인지 확인
    if (element instanceof HTMLElement && element.matches && element.matches(this.selectors.message)) {
      return element;
    }

    // 자식 요소에서 메시지 찾기
    const possibleMessage = element.querySelector?.(this.selectors.message);
    return possibleMessage;
  }

  /**
   * 메시지 텍스트 추출
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {string} 추출된 텍스트
   */
  extractMessageText(messageElement) {
    // NoahChat: p.whitespace-pre-wrap
    if (this.platformId === 'noahchat') {
      const paragraphs = messageElement.querySelectorAll('p.whitespace-pre-wrap');
      if (paragraphs.length > 0) {
        const texts = Array.from(paragraphs)
          .map((p) => p.textContent?.trim())
          .filter((text) => text && text.length > 0);
        return texts.join('\n');
      }
    }

    // LunaTalk: Shadow DOM 내부 .content
    if (this.platformId === 'lunatalk') {
      const cbox = messageElement.querySelector('.cbox');
      if (cbox && cbox.shadowRoot) {
        const content = cbox.shadowRoot.querySelector('.content');
        if (content) {
          return content.textContent?.trim() || '';
        }
      }
    }

    // Fallback: 전체 텍스트
    return messageElement.textContent?.trim() || '';
  }

  /**
   * 메시지가 처리 가능한지 검증
   *
   * @param {string} text - 추출된 텍스트
   * @param {number} minLength - 최소 길이 (기본: 50)
   * @returns {boolean} 처리 가능 여부
   */
  isValidMessage(text, minLength = 50) {
    return text && text.length >= minLength;
  }

  /**
   * 메시지에 컨트롤 버튼이 있는지 확인
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {boolean} 컨트롤 버튼 존재 여부
   */
  hasControlButtons(messageElement) {
    let nextElement = messageElement.nextElementSibling;

    while (nextElement) {
      if (nextElement.querySelector('#chat_msg_regen_btn, button')) {
        return true;
      }
      nextElement = nextElement.nextElementSibling;
    }

    return false;
  }
}
