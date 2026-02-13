// PlatformFactory.js - 플랫폼 팩토리 패턴
// @ts-check

import { NoahChatPlatform } from './NoahChatPlatform.js';
import { LunaTalkPlatform } from './LunaTalkPlatform.js';

/**
 * @fileoverview
 * 플랫폼 인스턴스를 생성하는 팩토리 클래스입니다.
 * 새로운 플랫폼을 추가할 때 이 파일만 수정하면 됩니다.
 *
 * SOLID 원칙:
 * - SRP: 플랫폼 인스턴스 생성 책임만
 * - OCP: 새 플랫폼 추가 시 기존 코드 수정 최소화
 * - DIP: content.js는 구체적 플랫폼이 아닌 팩토리에 의존
 */

/**
 * 지원하는 플랫폼 목록
 *
 * @typedef {Object} PlatformInfo
 * @property {string} id - 플랫폼 식별자
 * @property {string} name - 플랫폼 표시 이름
 * @property {string} description - 플랫폼 설명
 */

/**
 * 플랫폼 팩토리
 */
export class PlatformFactory {
  /**
   * 지원하는 플랫폼 목록 반환
   *
   * @returns {PlatformInfo[]}
   */
  static getSupportedPlatforms() {
    return [
      {
        id: 'noahchat',
        name: 'NoahChat',
        description: 'NoahChat 플랫폼 (기본)',
      },
      {
        id: 'lunatalk',
        name: 'LunaTalk',
        description: 'LunaTalk 플랫폼 (추후 구현)',
      },
    ];
  }

  /**
   * 플랫폼 인스턴스 생성
   *
   * @param {string} platformId - 플랫폼 식별자 (예: 'noahchat', 'lunatalk')
   * @returns {ChatPlatform} 플랫폼 인스턴스
   * @throws {Error} 지원하지 않는 플랫폼인 경우
   */
  static createPlatform(platformId) {
    console.log(`[PlatformFactory] Creating platform: ${platformId}`);

    switch (platformId) {
      case 'noahchat':
        return new NoahChatPlatform();

      case 'lunatalk':
        return new LunaTalkPlatform();

      default:
        console.error(`[PlatformFactory] Unsupported platform: ${platformId}`);
        console.log('[PlatformFactory] Falling back to NoahChat');
        return new NoahChatPlatform(); // 기본값
    }
  }

  /**
   * 플랫폼이 지원되는지 확인
   *
   * @param {string} platformId - 플랫폼 식별자
   * @returns {boolean}
   */
  static isPlatformSupported(platformId) {
    const supportedIds = this.getSupportedPlatforms().map((p) => p.id);
    return supportedIds.includes(platformId);
  }

  /**
   * 플랫폼 정보 가져오기
   *
   * @param {string} platformId - 플랫폼 식별자
   * @returns {PlatformInfo|null}
   */
  static getPlatformInfo(platformId) {
    return this.getSupportedPlatforms().find((p) => p.id === platformId) || null;
  }
}
