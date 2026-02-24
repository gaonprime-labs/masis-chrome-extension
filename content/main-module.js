// content/main.js - Entry point for the extension
// @ts-check

import { injectStyles } from './styles.js';
import { handleNewMessage } from './message-handler.js';
import { initializeObservers } from './observers.js';

console.log('[Extension] Content script loaded (Handler pattern version)');
injectStyles();

// Platform abstraction layer
class ChatPlatform {
  getName() { throw new Error('Method getName() must be implemented'); }
  getId() { throw new Error('Method getId() must be implemented'); }
  getMessageSelector() { throw new Error('Method getMessageSelector() must be implemented'); }
  getNametagSelector() { throw new Error('Method getNametagSelector() must be implemented'); }
  getImageContainerSelector() { throw new Error('Method getImageContainerSelector() must be implemented'); }
  getStreamingIndicatorSelector() { throw new Error('Method getStreamingIndicatorSelector() must be implemented'); }
  getParentLineSelector() { throw new Error('Method getParentLineSelector() must be implemented'); }

  getOriginalImagesInMessage(messageElement) {
    const selector = this.getImageContainerSelector();
    const imageSelector = selector.includes('img') ? selector : `${selector} img`;
    return Array.from(messageElement.querySelectorAll(imageSelector));
  }

  extractMessageText(messageElement) {
    return messageElement.textContent?.trim() || '';
  }

  isMessageStreaming(messageElement) {
    const streamingIndicator = messageElement.querySelector(this.getStreamingIndicatorSelector());
    return Boolean(streamingIndicator);
  }

  hasOriginalImages(messageElement) {
    const originalImages = this.getOriginalImagesInMessage(messageElement);
    return originalImages.length > 0;
  }
}

// NoahChat platform implementation
class NoahChatPlatform extends ChatPlatform {
  getName() { return 'NoahChat'; }
  getId() { return 'noahchat'; }
  getMessageSelector() { return '.px-3.transition-all:not(.justify-end)'; }
  getNametagSelector() { return 'span.inline-flex.items-center.shrink-0.whitespace-nowrap.rounded-md.font-medium'; }
  getImageContainerSelector() { return 'span.block.my-2.rounded-lg:not(.extension-single-image):not(.extension-character-image)'; }
  getStreamingIndicatorSelector() { return '.animate-shimmer'; }
  getParentLineSelector() { return 'p.whitespace-pre-wrap'; }

  getOriginalImagesInMessage(messageElement) {
    const selector = this.getImageContainerSelector();
    const imageSelector = selector.includes('img') ? selector : `${selector} img`;
    return Array.from(messageElement.querySelectorAll(imageSelector));
  }

  extractMessageText(messageElement) {
    const paragraphs = messageElement.querySelectorAll('p.whitespace-pre-wrap');
    if (paragraphs.length > 0) {
      const texts = Array.from(paragraphs)
        .map((p) => p.textContent?.trim())
        .filter((text) => text && text.length > 0);
      return texts.join('\n');
    }
    return messageElement.textContent?.trim() || '';
  }
}

// LunaTalk platform implementation (Shadow DOM support)
class LunaTalkPlatform extends ChatPlatform {
  getName() { return 'LunaTalk'; }
  getId() { return 'lunatalk'; }
  getMessageSelector() { return '#messageList > li.cWrap'; }
  getNametagSelector() { return '.dialogue'; }
  getImageContainerSelector() { return '.content img:not(.extension-image)'; }
  getStreamingIndicatorSelector() { return '.loadingText'; }
  getParentLineSelector() { return '.dialogue'; }

  getOriginalImagesInMessage(messageElement) {
    const cbox = messageElement.querySelector('.cbox');
    if (!cbox || !cbox.shadowRoot) return [];
    const images = cbox.shadowRoot.querySelectorAll('.content img:not(.extension-image)');
    return Array.from(images);
  }

  extractMessageText(messageElement) {
    const cbox = messageElement.querySelector('.cbox');
    if (cbox && cbox.shadowRoot) {
      const content = cbox.shadowRoot.querySelector('.content');
      if (content) return content.textContent?.trim() || '';
    }
    return messageElement.textContent?.trim() || '';
  }

  getDialoguesInMessage(messageElement) {
    const cbox = messageElement.querySelector('.cbox');
    if (!cbox || !cbox.shadowRoot) return [];
    const dialogues = cbox.shadowRoot.querySelectorAll('.dialogue');
    return Array.from(dialogues);
  }

  extractCharacterNameFromDialogue(dialogueElement) {
    const text = dialogueElement.textContent?.trim() || '';
    const match = text.match(/^(.+?)\s*\|\s*/);
    return match ? match[1].trim() : null;
  }
}

// BabeChat platform implementation
// DOM 구조 (2026-02):
// - 채팅 컨테이너: #messages-area
// - AI 메시지: #messages-area > div.flex.flex-col:has(img[src*="cloudfront.net/characters"])
// - 콘텐츠 이미지: itimg.kr, r2.dev 등 (아바타 제외)
// - 네임태그: 텍스트 내 "캐릭터명 |" 패턴
class BabeChatPlatform extends ChatPlatform {
  getName() { return 'BabeChat'; }
  getId() { return 'babechat'; }

  // AI 메시지: 아바타 이미지가 있는 컨테이너 (flex-col 유무 상관없이)
  getMessageSelector() {
    return '#messages-area > div:has(img[src*="cloudfront.net/characters"])';
  }

  getNametagSelector() {
    return 'div:has(img[src*="cloudfront.net/characters"])';
  }

  getImageContainerSelector() {
    return [
      'img[src*="itimg.kr"]:not(.extension-image):not(.extension-character-image)',
      'img[src*="soda"]:not(.extension-image):not(.extension-character-image)',
      'img[src*="dorua"]:not(.extension-image):not(.extension-character-image)',
      'img[src*="ri4.org"]:not(.extension-image):not(.extension-character-image)',
      'img[src*="r2.dev"]:not(.extension-image):not(.extension-character-image):not([class*="rounded-full"])',
    ].join(', ');
  }

  getStreamingIndicatorSelector() {
    return 'textarea[disabled], input[disabled], [class*="loading"], [class*="animate-pulse"], [class*="typing"]';
  }

  getParentLineSelector() {
    return ':scope > div';
  }

  getOriginalImagesInMessage(messageElement) {
    const images = [];

    // 콘텐츠 이미지 호스트 목록
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

    // 중복 제거 및 아바타/UI 필터링
    const uniqueImages = [...new Set(images)].filter((img) => {
      const src = img.getAttribute('src') || '';
      const className = img.className || '';
      const isAvatar = src.includes('cloudfront.net/characters') ||
                       className.includes('rounded-full') ||
                       className.includes('size-12');
      const isUIIcon = src.includes('babechat.ai/assets');
      return !isAvatar && !isUIIcon;
    });

    return uniqueImages;
  }

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

  extractCharacterNames(messageElement) {
    const text = messageElement.textContent || '';
    const patterns = [
      /[""]([^""]+)[""]\s*[|｜]/g,
      /^([가-힣a-zA-Z0-9_\s]+)\s*[|｜]/gm,
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

  extractMarkdownImageUrls(messageElement) {
    const text = messageElement.textContent || '';
    const pattern = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
    const urls = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
      urls.push(match[1]);
    }
    return urls;
  }
}

// Platform factory
class PlatformFactory {
  static createPlatform(platformId) {
    console.log('[PlatformFactory] Creating platform:', platformId);
    switch (platformId) {
      case 'noahchat': return new NoahChatPlatform();
      case 'lunatalk': return new LunaTalkPlatform();
      case 'babechat': return new BabeChatPlatform();
      default:
        console.warn('[PlatformFactory] Unsupported platform:', platformId, ', falling back to NoahChat');
        return new NoahChatPlatform();
    }
  }
}

// Global state
let NoahChatHandler, LunaTalkHandler, BabeChatHandler;
let currentHandler = null;
let currentPlatform = new NoahChatPlatform();

// Detect platform from domain
function detectPlatformFromDomain() {
  const hostname = window.location.hostname;
  console.log('[Extension] Detecting platform from domain:', hostname);

  if (hostname.includes('lunatalk') || hostname.includes('lonatalk')) {
    console.log('[Extension] Detected LunaTalk domain');
    return 'lunatalk';
  }

  if (hostname.includes('noahchat') || hostname.includes('noah')) {
    console.log('[Extension] Detected NoahChat domain');
    return 'noahchat';
  }

  if (hostname.includes('babechat') || hostname.includes('babe')) {
    console.log('[Extension] Detected BabeChat domain');
    return 'babechat';
  }

  console.log('[Extension] Unknown domain, defaulting to NoahChat');
  return 'noahchat';
}

// Create handler for platform
function createHandler(platform) {
  const platformId = platform.getId();
  if (!NoahChatHandler || !LunaTalkHandler || !BabeChatHandler) {
    console.warn('[Extension] Handlers not loaded yet, using fallback');
    return null;
  }

  switch (platformId) {
    case 'noahchat':
      console.log('[Extension] Creating NoahChatHandler');
      return new NoahChatHandler(platform);
    case 'lunatalk':
      console.log('[Extension] Creating LunaTalkHandler');
      return new LunaTalkHandler(platform);
    case 'babechat':
      console.log('[Extension] Creating BabeChatHandler');
      return new BabeChatHandler(platform);
    default:
      console.warn('[Extension] Unknown platform:', platformId, ', using NoahChatHandler');
      return new NoahChatHandler(platform);
  }
}

// Initialize platform and observers
function initializePlatform() {
  chrome.storage.local.get(['platform', 'autoDetect'], (config) => {
    let platformId;
    const autoDetect = config.autoDetect !== false;

    if (autoDetect) {
      platformId = detectPlatformFromDomain();
      console.log('[Extension] Using auto-detected platform');
    } else {
      platformId = config.platform || 'noahchat';
      console.log('[Extension] Using manually configured platform');
    }

    currentPlatform = PlatformFactory.createPlatform(platformId);
    currentHandler = createHandler(currentPlatform);

    console.log('[Extension] Using platform:', currentPlatform.getName(), '(' + currentPlatform.getId() + ')');
    console.log('[Extension] Handler initialized:', currentHandler ? 'YES' : 'NO');

    // Initialize observers with callback
    initializeObservers(currentPlatform, currentHandler, (messageElement) => {
      handleNewMessage(messageElement, currentPlatform, currentHandler);
    });
  });
}

// Initialize function (called from wrapper)
async function initialize() {
  try {
    const noahModule = await import(chrome.runtime.getURL('platforms/handlers/NoahChatHandler.js'));
    NoahChatHandler = noahModule.NoahChatHandler;

    const lunaModule = await import(chrome.runtime.getURL('platforms/handlers/LunaTalkHandler.js'));
    LunaTalkHandler = lunaModule.LunaTalkHandler;

    const babeModule = await import(chrome.runtime.getURL('platforms/handlers/BabeChatHandler.js'));
    BabeChatHandler = babeModule.BabeChatHandler;

    console.log('[Extension] Handlers loaded successfully');
    initializePlatform();
  } catch (error) {
    console.error('[Extension] Failed to load handlers:', error);
  }

  // Inject SSE interceptor script
  const injectScript = document.createElement('script');
  injectScript.src = chrome.runtime.getURL('injected-script.js');
  injectScript.onload = function () {
    console.log('[Extension] Injected script loaded');
    this.remove();
  };
  injectScript.onerror = function () {
    console.error('[Extension] Failed to load injected script');
    this.remove();
  };
  (document.head || document.documentElement).appendChild(injectScript);
}

// Auto-initialize
console.log('[Extension] 🚀 Calling initialize()...');
initialize();

// Export for wrapper
export default initialize;
