// content/observers.js - MutationObserver and event listeners
// @ts-check

import { findChatMessage } from './utils.js';

const pendingMessages = new Set();
let lastStreamingMessage = null;
let isEnabled = true;

// Create MutationObserver for new messages
export function createMessageObserver(platform, handler, onNewMessage) {
  const messageSelector = platform.getMessageSelector();
  const imageContainerSelector = platform.getImageContainerSelector();

  const observer = new MutationObserver((mutations) => {
    if (!isEnabled) return;

    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = /** @type {Element} */ (node);

            // Detect new message
            const messageElement = findChatMessage(element, messageSelector);
            if (
              messageElement &&
              messageElement.dataset.extensionProcessed !== 'true' &&
              !pendingMessages.has(messageElement)
            ) {
              console.log('[MutationObserver] New message element detected');

              // Setup message observer for LunaTalk (Shadow DOM)
              if (handler && platform.getId() === 'lunatalk') {
                handler.setupMessageObserver(messageElement);
              }

              const isStreaming = platform.isMessageStreaming(messageElement);
              const hasOriginalImages = platform.hasOriginalImages(messageElement);

              console.log('[MutationObserver] Streaming:', isStreaming ? 'YES' : 'NO');
              console.log('[MutationObserver] Original images:', hasOriginalImages ? 'YES' : 'NO');

              if (hasOriginalImages) {
                console.log('[MutationObserver] Images already present, processing immediately...');
                pendingMessages.delete(messageElement);
                onNewMessage(messageElement);
              } else {
                console.log('[MutationObserver] No images yet, marking as pending...');
                pendingMessages.add(messageElement);
              }
            }

            // Detect image container addition (NoahChat)
            if (platform.getId() === 'noahchat') {
              checkForImageContainers(element, imageContainerSelector, messageSelector, onNewMessage);
            }
          }
        });
      }
    }
  });

  return observer;
}

// Check for image containers (NoahChat)
function checkForImageContainers(element, imageContainerSelector, messageSelector, onNewMessage) {
  if (element.matches && element.matches(imageContainerSelector)) {
    const parentMessage = element.closest(messageSelector);
    if (parentMessage && pendingMessages.has(parentMessage)) {
      console.log('[MutationObserver] Image container added to pending message!');
      pendingMessages.delete(parentMessage);
      onNewMessage(parentMessage);
    }
  }

  if (element.children) {
    for (const child of element.children) {
      checkForImageContainers(child, imageContainerSelector, messageSelector, onNewMessage);
    }
  }
}

// Process existing messages on page load
export function processExistingMessages(platform, handler, onNewMessage) {
  console.log('==================================================');
  console.log('[ProcessExisting] Processing existing messages...');

  const messageSelector = platform.getMessageSelector();
  const existingMessages = document.querySelectorAll(messageSelector);
  console.log('[ProcessExisting] Found', existingMessages.length, 'total message elements on page');

  existingMessages.forEach((msg, index) => {
    if (!(msg instanceof HTMLElement)) return;

    console.log('[ProcessExisting] Checking message', index + 1, '/', existingMessages.length);

    // Skip messages with extension images
    const hasExtensionImages = msg.querySelector('.extension-character-image');
    if (hasExtensionImages) {
      console.log('[ProcessExisting] Message', index + 1, ': Already has extension images, skipping');
      msg.dataset.extensionProcessed = 'true';
      return;
    }

    // Check for original images
    const originalImages = platform.getOriginalImagesInMessage(msg);
    console.log('[ProcessExisting] Message', index + 1, ': Found', originalImages.length, 'original images');

    if (originalImages.length === 0) {
      console.log('[ProcessExisting] Message', index + 1, ': No original images, skipping');
      msg.dataset.extensionProcessed = 'true';
      return;
    }

    console.log('[ProcessExisting] Message', index + 1, ': HAS', originalImages.length, 'ORIGINAL IMAGES - PROCESSING');

    // Extract text
    const text = platform.extractMessageText(msg);
    console.log('[ProcessExisting] Message', index + 1, 'text preview:', text.substring(0, 100));

    onNewMessage(msg);
  });

  console.log('[ProcessExisting] Finished checking', existingMessages.length, 'messages');
  console.log('==================================================');

  // Setup observers for existing messages (LunaTalk)
  if (handler && platform.getId() === 'lunatalk') {
    const existingMessages = document.querySelectorAll(messageSelector);
    existingMessages.forEach((msg) => {
      if (msg instanceof HTMLElement) {
        handler.setupMessageObserver(msg);
      }
    });
  }
}

// Check for new messages periodically
function checkForNewMessages(platform, onNewMessage) {
  if (!isEnabled) return;

  const messageSelector = platform.getMessageSelector();
  const allMessages = document.querySelectorAll(messageSelector);
  const unprocessed = Array.from(allMessages)
    .filter((msg) => msg instanceof HTMLElement)
    .filter((msg) => {
      const hasOriginalImages = platform.hasOriginalImages(msg);
      return msg.dataset.extensionProcessed !== 'true' && hasOriginalImages;
    });

  if (unprocessed.length > 0) {
    console.log('[Polling] Found', unprocessed.length, 'unprocessed messages');

    unprocessed.forEach((msg) => {
      const originalImages = platform.getOriginalImagesInMessage(msg);
      console.log('[Polling] Processing message with', originalImages.length, 'original images');
      onNewMessage(msg);
    });
  }
}

// Setup SSE stream complete listener
export function setupStreamCompleteListener(platform, onNewMessage) {
  window.addEventListener('extension:stream_complete', () => {
    console.log('[Extension] SSE stream_complete event received');

    setTimeout(() => {
      if (lastStreamingMessage) {
        console.log('[Extension] Processing last streaming message after completion');
        onNewMessage(lastStreamingMessage);
        lastStreamingMessage = null;
      } else {
        console.log('[Extension] No streaming message tracked, checking all unprocessed messages');
        checkForNewMessages(platform, onNewMessage);
      }
    }, 1000);
  });
}

// Setup custom message processing event listener (LunaTalkHandler)
export function setupProcessMessageListener(onNewMessage) {
  document.addEventListener('extension:processMessage', (event) => {
    const customEvent = /** @type {CustomEvent} */ (event);
    const { messageElement } = customEvent.detail;
    if (messageElement) {
      onNewMessage(messageElement);
    }
  });
}

// Setup SPA routing detection
export function setupUrlChangeObserver(platform, handler, onNewMessage) {
  let lastUrl = location.href;

  const urlObserver = new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      console.log('[Extension] URL changed, reprocessing messages...');
      setTimeout(() => {
        processExistingMessages(platform, handler, onNewMessage);
      }, 1000);
    }
  });

  urlObserver.observe(document, { subtree: true, childList: true });

  return urlObserver;
}

// Initialize all observers
export function initializeObservers(platform, handler, onNewMessage) {
  // Create message observer
  const messageObserver = createMessageObserver(platform, handler, onNewMessage);

  // Setup event listeners
  setupStreamCompleteListener(platform, onNewMessage);
  setupProcessMessageListener(onNewMessage);

  // Create URL observer
  const urlObserver = setupUrlChangeObserver(platform, handler, onNewMessage);

  // Start observing after page load
  if (document.body) {
    setTimeout(() => {
      processExistingMessages(platform, handler, onNewMessage);
    }, 2000);

    messageObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log('[Extension] Observer started');
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        processExistingMessages(platform, handler, onNewMessage);
      }, 2000);

      messageObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });

      console.log('[Extension] Observer started');
    });
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    messageObserver.disconnect();
    urlObserver.disconnect();
  });

  return {
    messageObserver,
    urlObserver,
  };
}

// Enable/disable observers
export function setObserverEnabled(enabled) {
  isEnabled = enabled;
  console.log('[Observer]', enabled ? 'Enabled' : 'Disabled');
}
