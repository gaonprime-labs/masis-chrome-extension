// BabeChatPlatform.js - BabeChat 플랫폼 구현체
// @ts-check

import { ChatPlatform } from './ChatPlatform.js';

/**
 * @fileoverview
 * BabeChat 플랫폼의 구체적인 구현입니다.
 * DOM 선택자와 메시지 처리 로직이 BabeChat에 특화되어 있습니다.
 *
 * BabeChat DOM 구조 분석 (2026-02):
 * - 채팅 컨테이너: #messages-area
 * - AI 메시지: #messages-area > div.flex.flex-col.gap-3.px-5.pt-4 (children > 1)
 * - 사용자 메시지: 같은 구조지만 children === 1, 내부에 "justify-end" 클래스
 * - 아바타: img[src*="cloudfront.net/characters"] (size-12 rounded-full)
 * - 콘텐츠 이미지: img[src*="itimg.kr"], img[src*="r2.dev"] 등
 * - 네임태그: 텍스트 내 "캐릭터명 |" 패턴
 * - 메타정보: NOW📆, 🏷️, ✨ 등으로 시작하는 마지막 블록
 *
 * SOLID 원칙:
 * - SRP: BabeChat 플랫폼의 DOM 선택 및 메시지 처리만 담당
 * - OCP: ChatPlatform 인터페이스 확장으로 기능 추가
 * - LSP: ChatPlatform의 모든 메서드를 올바르게 구현
 */

/**
 * BabeChat 플랫폼 구현
 *
 * @extends {ChatPlatform}
 */
export class BabeChatPlatform extends ChatPlatform {
  /**
   * @override
   */
  getName() {
    return 'BabeChat';
  }

  /**
   * @override
   */
  getId() {
    return 'babechat';
  }

  /**
   * @override
   * BabeChat 메시지 요소 선택자
   *
   * BabeChat DOM 구조:
   * - 채팅 컨테이너: #messages-area
   * - 메시지 블록: #messages-area > div.flex.flex-col.gap-3.px-5.pt-4
   * - AI 메시지: children > 1 (아바타, 텍스트, 이미지, 메타정보 등)
   * - 사용자 메시지: children === 1, 내부에 "justify-end" 클래스
   *
   * AI 메시지만 선택하기 위해 아바타 이미지가 있는 요소를 찾음
   */
  getMessageSelector() {
    // AI 메시지: #messages-area 내부의 직접 자식 div 중
    // 아바타 이미지(cloudfront.net/characters)를 포함하는 것만 선택
    // 참고: flex-col 클래스가 없는 div.px-5도 메시지일 수 있음
    return '#messages-area > div:has(img[src*="cloudfront.net/characters"])';
  }

  /**
   * @override
   * BabeChat 인물 네임태그 선택자
   *
   * BabeChat은 네임태그가 별도 요소가 아닌 텍스트 내에 포함:
   * - 패턴: "캐릭터명 | 대사내용"
   * - extractCharacterNames() 메서드로 파싱 필요
   */
  getNametagSelector() {
    // BabeChat은 네임태그가 텍스트 내에 포함되어 있음
    // 아바타가 있는 div를 찾아 그 안의 텍스트에서 파싱
    return 'div:has(img[src*="cloudfront.net/characters"])';
  }

  /**
   * @override
   * BabeChat 원본 이미지 컨테이너 선택자
   *
   * BabeChat 이미지 구조:
   * - 콘텐츠 이미지: itimg.kr, r2.dev, dorua, soda 등 외부 호스트
   * - 아바타 이미지 제외: cloudfront.net/characters (size-12 rounded-full)
   * - UI 이미지 제외: babechat.ai/assets
   */
  getImageContainerSelector() {
    // 콘텐츠 이미지만 선택 (아바타, UI 아이콘 제외)
    return [
      'img[src*="itimg.kr"]:not(.extension-image):not(.extension-character-image)',
      'img[src*="soda"]:not(.extension-image):not(.extension-character-image)',
      'img[src*="dorua"]:not(.extension-image):not(.extension-character-image)',
      'img[src*="ri4.org"]:not(.extension-image):not(.extension-character-image)',
      'img[src*="r2.dev"]:not(.extension-image):not(.extension-character-image):not([src*="cloudfront.net/characters"])',
    ].join(', ');
  }

  /**
   * @override
   * BabeChat 스트리밍 인디케이터 선택자
   * - 입력 필드가 비활성화되면 스트리밍 중
   * - 또는 특정 로딩 애니메이션 클래스
   */
  getStreamingIndicatorSelector() {
    // BabeChat 스트리밍 감지:
    // 1. 입력 필드 disabled 상태
    // 2. 로딩 애니메이션 요소
    return 'textarea[disabled], input[disabled], [class*="loading"], [class*="animate-pulse"], [class*="typing"]';
  }

  /**
   * @override
   * BabeChat 부모 라인 선택자
   *
   * AI 메시지 내부 구조:
   * - 각 턴(아바타+텍스트 또는 이미지)이 직접 자식 div로 구성
   * - 이미지가 있는 div는 hasContentImg로 식별
   */
  getParentLineSelector() {
    // 메시지 내 각 블록 (아바타 블록, 텍스트 블록, 이미지 블록)
    return ':scope > div';
  }

  /**
   * BabeChat 특화: 메시지 내 네임태그 찾기
   * BabeChat은 텍스트 내에서 "캐릭터명 |" 패턴 파싱
   *
   * 예시: '배서진 | 뭐라는 거야, 이 병신은.'
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {string[]} 캐릭터 이름 목록
   */
  extractCharacterNames(messageElement) {
    const text = messageElement.textContent || '';
    // "캐릭터명 |" 또는 "캐릭터명｜" 패턴 매칭 (따옴표 없이도 가능)
    // 예: '배서진 | 대사' 또는 '"배서진" | 대사'
    const patterns = [
      /[""]([^""]+)[""]\s*[|｜]/g, // 따옴표로 감싼 경우
      /^([가-힣a-zA-Z0-9_\s]+)\s*[|｜]/gm, // 따옴표 없이 시작하는 경우
    ];

    const names = [];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        if (name && !names.includes(name) && name.length < 30) {
          names.push(name);
        }
      }
    }

    return names;
  }

  /**
   * BabeChat 특화: 메시지 내 원본 이미지 찾기
   *
   * BabeChat 이미지 구조:
   * - 아바타: img[src*="cloudfront.net/characters"] (제외)
   * - 콘텐츠: img[src*="itimg.kr"], img[src*="r2.dev"] 등 (포함)
   * - UI 아이콘: babechat.ai/assets (제외)
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {Element[]} 원본 이미지 요소 목록
   */
  getOriginalImagesInMessage(messageElement) {
    const images = [];

    // 콘텐츠 이미지 호스트 목록 (아바타, UI 제외)
    const contentImageSelectors = [
      'img[src*="itimg.kr"]',
      'img[src*="soda"]',
      'img[src*="dorua"]',
      'img[src*="ri4.org"]',
    ];

    // r2.dev는 아바타와 콘텐츠 모두 사용할 수 있으므로 별도 처리
    const r2Images = messageElement.querySelectorAll(
      'img[src*="r2.dev"]:not(.extension-image):not(.extension-character-image):not([class*="rounded-full"])'
    );
    images.push(...Array.from(r2Images));

    // 다른 콘텐츠 이미지 호스트
    contentImageSelectors.forEach((selector) => {
      const foundImages = messageElement.querySelectorAll(
        `${selector}:not(.extension-image):not(.extension-character-image)`
      );
      images.push(...Array.from(foundImages));
    });

    // 중복 제거 및 아바타 필터링
    const uniqueImages = [...new Set(images)].filter((img) => {
      const src = img.getAttribute('src') || '';
      const className = img.className || '';
      // 아바타 이미지 제외 (cloudfront.net/characters 또는 rounded-full 클래스)
      const isAvatar =
        src.includes('cloudfront.net/characters') ||
        className.includes('rounded-full') ||
        className.includes('size-12');
      // UI 아이콘 제외
      const isUIIcon = src.includes('babechat.ai/assets');
      return !isAvatar && !isUIIcon;
    });

    return uniqueImages;
  }

  /**
   * BabeChat 특화: 마크다운 이미지 URL 추출
   * BabeChat은 ![](url) 형식으로 이미지를 표시
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {string[]} 이미지 URL 목록
   */
  extractMarkdownImageUrls(messageElement) {
    const text = messageElement.textContent || '';
    // ![](url) 또는 ![alt](url) 패턴
    const pattern = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
    const urls = [];
    let match;

    while ((match = pattern.exec(text)) !== null) {
      urls.push(match[1]);
    }

    return urls;
  }

  /**
   * BabeChat 특화: 메시지가 스트리밍 중인지 확인
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {boolean}
   */
  isMessageStreaming(messageElement) {
    // 1. 메시지 내 스트리밍 인디케이터 확인
    const streamingIndicator = messageElement.querySelector(this.getStreamingIndicatorSelector());
    if (streamingIndicator) return true;

    // 2. 전역 입력 필드 비활성화 확인
    const inputField = document.querySelector('textarea[placeholder*="메시지"], input[placeholder*="메시지"]');
    if (inputField && (inputField.hasAttribute('disabled') || inputField.getAttribute('aria-disabled') === 'true')) {
      return true;
    }

    return false;
  }

  /**
   * BabeChat 특화: 메시지에 원본 이미지가 있는지 확인
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {boolean}
   */
  hasOriginalImages(messageElement) {
    const images = this.getOriginalImagesInMessage(messageElement);
    const markdownUrls = this.extractMarkdownImageUrls(messageElement);
    return images.length > 0 || markdownUrls.length > 0;
  }

  /**
   * @override
   * BabeChat 메시지 텍스트 추출
   *
   * 메타데이터 블록 제외:
   * - NOW📆: 시간 정보
   * - 🏷️: 장소 정보
   * - ✨: 상태 정보
   * - 🪤, 💡, 💘: 게임 정보
   */
  extractMessageText(messageElement) {
    const textContent = messageElement.textContent?.trim() || '';

    // 마크다운 이미지 문법 제거
    let cleanedText = textContent.replace(/!\[.*?\]\([^)]+\)/g, '');

    // 메타데이터 블록 제거 (NOW📆로 시작하는 라인부터 끝까지)
    const metaPatterns = [
      /NOW📆:[\s\S]*$/,
      /🏷️:[\s\S]*$/,
      /INFO[\s\S]*$/,
    ];

    for (const pattern of metaPatterns) {
      const match = cleanedText.match(pattern);
      if (match) {
        cleanedText = cleanedText.substring(0, match.index).trim();
        break;
      }
    }

    return cleanedText;
  }

  /**
   * BabeChat 특화: 캐릭터 아바타 URL 추출
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {string|null} 아바타 URL
   */
  getCharacterAvatarUrl(messageElement) {
    const avatarImg = messageElement.querySelector('img[src*="cloudfront.net/characters"]');
    return avatarImg?.getAttribute('src') || null;
  }

  /**
   * BabeChat 특화: 캐릭터 ID 추출
   *
   * @param {HTMLElement} messageElement - 메시지 요소
   * @returns {string|null} 캐릭터 ID
   */
  getCharacterId(messageElement) {
    const profileLink = messageElement.querySelector('a[href*="/character/"]');
    if (profileLink) {
      const href = profileLink.getAttribute('href') || '';
      const match = href.match(/\/character\/u\/([^/]+)/);
      return match ? match[1] : null;
    }
    return null;
  }

  /**
   * BabeChat 특화: Extension 이미지가 이미 추가되었는지 확인
   *
   * @param {Element} originalImageContainer - 원본 이미지 컨테이너
   * @returns {boolean}
   */
  isExtensionImageAlreadyAdded(originalImageContainer) {
    const parent = originalImageContainer.parentElement;
    if (!parent) return false;

    // 이전 형제 요소가 extension 이미지인지 확인
    const prevElement = originalImageContainer.previousElementSibling;
    if (prevElement?.classList.contains('extension-character-image')) {
      return true;
    }

    // 부모 내에서 extension 이미지 확인
    return parent.querySelector('.extension-character-image') !== null;
  }

  /**
   * BabeChat 특화: 원본 이미지 컨테이너를 Extension 이미지로 교체
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
   * BabeChat 특화: 현재 채팅 모드 확인 (대화/소설)
   *
   * @returns {'chat' | 'novel'} 채팅 모드
   */
  getCurrentChatMode() {
    const selectedTab = document.querySelector('button[aria-selected="true"], [role="tab"][aria-selected="true"]');
    if (selectedTab?.textContent?.includes('소설')) {
      return 'novel';
    }
    return 'chat';
  }

  /**
   * BabeChat 특화: 현재 채팅방 ID 추출
   *
   * @returns {string|null} 채팅방 ID
   */
  getCurrentRoomId() {
    const url = window.location.href;
    const match = url.match(/roomId=(\d+)/);
    return match ? match[1] : null;
  }
}
