// dom-analyzer.js - DOM 구조 분석 유틸리티
// @ts-check

/**
 * @fileoverview
 * 채팅 플랫폼의 DOM 구조를 자동으로 분석하고 선택자를 추천하는 도구입니다.
 *
 * 사용 방법:
 * 1. 루나톡 페이지에서 개발자 콘솔 열기
 * 2. 이 스크립트를 콘솔에 복사/붙여넣기
 * 3. analyzeChatPlatform() 실행
 * 4. 결과를 복사하여 LunaTalkPlatform.js에 적용
 */

/**
 * 채팅 플랫폼 DOM 구조 분석
 */
function analyzeChatPlatform() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔍 채팅 플랫폼 DOM 구조 분석 시작...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const results = {
    messages: analyzeMessages(),
    nametags: analyzeNametags(),
    images: analyzeImages(),
    streaming: analyzeStreamingIndicator(),
    parentLine: analyzeParentLine(),
  };

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 분석 완료!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  printRecommendedSelectors(results);

  return results;
}

/**
 * 메시지 요소 분석
 */
function analyzeMessages() {
  console.log('📦 1. 메시지 요소 분석');
  console.log('─────────────────────────────────────');

  // 페이지의 모든 요소를 탐색하여 메시지 패턴 찾기
  const potentialMessages = document.querySelectorAll('div[class*="message"], div[class*="chat"], div[class*="bubble"], article, section');

  console.log(`   발견된 후보: ${potentialMessages.length}개`);

  if (potentialMessages.length === 0) {
    console.warn('   ⚠️  메시지 요소를 찾을 수 없습니다.');
    return null;
  }

  // 가장 일반적인 클래스 패턴 분석
  const classPatterns = new Map();

  potentialMessages.forEach((el) => {
    const classes = Array.from(el.classList);
    const classString = classes.join('.');

    if (classString) {
      classPatterns.set(classString, (classPatterns.get(classString) || 0) + 1);
    }
  });

  // 가장 많이 사용된 클래스 패턴 찾기
  const sortedPatterns = Array.from(classPatterns.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  console.log('   추천 선택자:');
  sortedPatterns.forEach(([pattern, count], idx) => {
    console.log(`   ${idx + 1}. .${pattern} (${count}개 발견)`);
  });

  // 첫 번째 메시지 요소 상세 분석
  const firstMessage = potentialMessages[0];
  console.log('\n   첫 번째 메시지 요소 상세:');
  console.log(`   - 태그: ${firstMessage.tagName}`);
  console.log(`   - 클래스: ${firstMessage.className}`);
  console.log(`   - ID: ${firstMessage.id || '없음'}`);
  console.log(`   - 부모: ${firstMessage.parentElement?.tagName}.${firstMessage.parentElement?.className}`);

  return {
    count: potentialMessages.length,
    recommendedSelector: `.${sortedPatterns[0]?.[0] || 'message'}`,
    allPatterns: sortedPatterns,
    sampleElement: firstMessage,
  };
}

/**
 * 네임태그 요소 분석
 */
function analyzeNametags() {
  console.log('\n🏷️  2. 네임태그 요소 분석');
  console.log('─────────────────────────────────────');

  const potentialNametags = document.querySelectorAll(
    'span[class*="name"], div[class*="name"], span[class*="author"], div[class*="author"], strong, b'
  );

  console.log(`   발견된 후보: ${potentialNametags.length}개`);

  if (potentialNametags.length === 0) {
    console.warn('   ⚠️  네임태그 요소를 찾을 수 없습니다.');
    return null;
  }

  // 텍스트가 짧은(이름일 가능성이 높은) 요소 필터링
  const likelyNametags = Array.from(potentialNametags).filter(
    (el) => el.textContent && el.textContent.trim().length < 30
  );

  console.log(`   이름으로 추정되는 요소: ${likelyNametags.length}개`);

  // 클래스 패턴 분석
  const classPatterns = new Map();

  likelyNametags.forEach((el) => {
    const classes = Array.from(el.classList);
    const classString = classes.join('.');

    if (classString) {
      classPatterns.set(classString, (classPatterns.get(classString) || 0) + 1);
    }
  });

  const sortedPatterns = Array.from(classPatterns.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  console.log('   추천 선택자:');
  sortedPatterns.forEach(([pattern, count], idx) => {
    console.log(`   ${idx + 1}. .${pattern} (${count}개 발견)`);
  });

  if (likelyNametags[0]) {
    console.log('\n   첫 번째 네임태그 요소 상세:');
    console.log(`   - 태그: ${likelyNametags[0].tagName}`);
    console.log(`   - 클래스: ${likelyNametags[0].className}`);
    console.log(`   - 텍스트: "${likelyNametags[0].textContent?.trim()}"`);
  }

  return {
    count: likelyNametags.length,
    recommendedSelector: `.${sortedPatterns[0]?.[0] || 'character-name'}`,
    allPatterns: sortedPatterns,
    sampleElement: likelyNametags[0],
  };
}

/**
 * 이미지 컨테이너 분석
 */
function analyzeImages() {
  console.log('\n🖼️  3. 이미지 컨테이너 분석');
  console.log('─────────────────────────────────────');

  const images = document.querySelectorAll('img');
  console.log(`   발견된 이미지: ${images.length}개`);

  if (images.length === 0) {
    console.warn('   ⚠️  이미지를 찾을 수 없습니다.');
    return null;
  }

  // 이미지의 부모 컨테이너 분석
  const containerPatterns = new Map();

  images.forEach((img) => {
    const container = img.closest('div, span, figure, picture');
    if (container) {
      const classes = Array.from(container.classList);
      const classString = classes.join('.');

      if (classString) {
        containerPatterns.set(classString, (containerPatterns.get(classString) || 0) + 1);
      }
    }
  });

  const sortedPatterns = Array.from(containerPatterns.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  console.log('   추천 선택자:');
  sortedPatterns.forEach(([pattern, count], idx) => {
    console.log(`   ${idx + 1}. .${pattern} (${count}개 발견)`);
  });

  const firstImage = images[0];
  const firstContainer = firstImage.closest('div, span, figure, picture');

  if (firstContainer) {
    console.log('\n   첫 번째 이미지 컨테이너 상세:');
    console.log(`   - 태그: ${firstContainer.tagName}`);
    console.log(`   - 클래스: ${firstContainer.className}`);
    console.log(`   - 부모: ${firstContainer.parentElement?.tagName}.${firstContainer.parentElement?.className}`);
  }

  return {
    count: images.length,
    recommendedSelector: `.${sortedPatterns[0]?.[0] || 'image-wrapper'}`,
    allPatterns: sortedPatterns,
    sampleElement: firstContainer,
  };
}

/**
 * 스트리밍 인디케이터 분석
 */
function analyzeStreamingIndicator() {
  console.log('\n⏳ 4. 스트리밍 인디케이터 분석');
  console.log('─────────────────────────────────────');

  const potentialIndicators = document.querySelectorAll(
    '[class*="loading"], [class*="typing"], [class*="shimmer"], [class*="skeleton"], [class*="spinner"], [class*="dots"]'
  );

  console.log(`   발견된 후보: ${potentialIndicators.length}개`);

  if (potentialIndicators.length === 0) {
    console.warn('   ⚠️  스트리밍 인디케이터를 찾을 수 없습니다.');
    console.log('   💡 메시지를 입력하여 AI 응답이 스트리밍되는 동안 다시 실행하세요.');
    return null;
  }

  // 클래스 패턴 분석
  const classPatterns = new Map();

  potentialIndicators.forEach((el) => {
    const classes = Array.from(el.classList);
    const classString = classes.join('.');

    if (classString) {
      classPatterns.set(classString, (classPatterns.get(classString) || 0) + 1);
    }
  });

  const sortedPatterns = Array.from(classPatterns.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  console.log('   추천 선택자:');
  sortedPatterns.forEach(([pattern, count], idx) => {
    console.log(`   ${idx + 1}. .${pattern} (${count}개 발견)`);
  });

  return {
    count: potentialIndicators.length,
    recommendedSelector: `.${sortedPatterns[0]?.[0] || 'loading-indicator'}`,
    allPatterns: sortedPatterns,
    sampleElement: potentialIndicators[0],
  };
}

/**
 * 부모 라인(단락) 요소 분석
 */
function analyzeParentLine() {
  console.log('\n📄 5. 부모 라인(단락) 요소 분석');
  console.log('─────────────────────────────────────');

  const potentialLines = document.querySelectorAll('p, div[class*="line"], div[class*="paragraph"], div[class*="text"]');

  console.log(`   발견된 후보: ${potentialLines.length}개`);

  if (potentialLines.length === 0) {
    console.warn('   ⚠️  단락 요소를 찾을 수 없습니다.');
    return null;
  }

  // 텍스트를 포함하는 요소만 필터링
  const linesWithText = Array.from(potentialLines).filter(
    (el) => el.textContent && el.textContent.trim().length > 0
  );

  console.log(`   텍스트가 있는 요소: ${linesWithText.length}개`);

  // 태그 분석
  const tagCounts = new Map();
  linesWithText.forEach((el) => {
    tagCounts.set(el.tagName, (tagCounts.get(el.tagName) || 0) + 1);
  });

  console.log('   추천 선택자:');
  Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .forEach(([tag, count], idx) => {
      console.log(`   ${idx + 1}. ${tag.toLowerCase()} (${count}개 발견)`);
    });

  return {
    count: linesWithText.length,
    recommendedSelector: Array.from(tagCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0].toLowerCase() || 'p',
    tagCounts: Array.from(tagCounts.entries()),
    sampleElement: linesWithText[0],
  };
}

/**
 * 추천 선택자 출력
 */
function printRecommendedSelectors(results) {
  console.log('📋 추천 선택자 요약');
  console.log('═════════════════════════════════════\n');

  console.log('다음 선택자를 LunaTalkPlatform.js에 복사하세요:\n');
  console.log('```javascript');
  console.log('const PLATFORM_SELECTORS = {');
  console.log('  lunatalk: {');
  console.log(`    message: '${results.messages?.recommendedSelector || '.message-container'}',`);
  console.log(`    nametag: '${results.nametags?.recommendedSelector || '.character-name'}',`);
  console.log(`    imageContainer: '${results.images?.recommendedSelector || '.image-wrapper'}',`);
  console.log(`    streamingIndicator: '${results.streaming?.recommendedSelector || '.loading-indicator'}',`);
  console.log(`    parentLine: '${results.parentLine?.recommendedSelector || 'p'}',`);
  console.log('  },');
  console.log('};');
  console.log('```\n');

  console.log('💡 팁:');
  console.log('1. 스트리밍 중에 다시 실행하면 더 정확한 결과를 얻을 수 있습니다.');
  console.log('2. 선택자가 정확하지 않다면 개발자 도구로 요소를 직접 확인하세요.');
  console.log('3. :not(.extension-image) 같은 제외 조건을 추가할 수 있습니다.\n');
}

/**
 * 인터랙티브 모드: 요소 클릭으로 선택자 추출
 */
function startInteractiveMode() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 인터랙티브 모드 시작!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('페이지의 요소를 클릭하면 선택자가 자동으로 생성됩니다.');
  console.log('종료하려면 stopInteractiveMode()를 실행하세요.\n');

  window.__domAnalyzerClickHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const element = e.target;
    const selector = generateSelector(element);

    console.log('─────────────────────────────────────');
    console.log(`클릭한 요소: ${element.tagName}`);
    console.log(`클래스: ${element.className}`);
    console.log(`추천 선택자: ${selector}`);
    console.log('─────────────────────────────────────\n');
  };

  document.addEventListener('click', window.__domAnalyzerClickHandler, true);
}

/**
 * 인터랙티브 모드 종료
 */
function stopInteractiveMode() {
  if (window.__domAnalyzerClickHandler) {
    document.removeEventListener('click', window.__domAnalyzerClickHandler, true);
    delete window.__domAnalyzerClickHandler;
    console.log('✅ 인터랙티브 모드 종료됨');
  }
}

/**
 * 요소로부터 선택자 생성
 */
function generateSelector(element) {
  const classes = Array.from(element.classList);
  if (classes.length > 0) {
    return `.${classes.join('.')}`;
  }
  if (element.id) {
    return `#${element.id}`;
  }
  return element.tagName.toLowerCase();
}

// 전역 함수로 노출
window.analyzeChatPlatform = analyzeChatPlatform;
window.startInteractiveMode = startInteractiveMode;
window.stopInteractiveMode = stopInteractiveMode;

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ DOM 분석 유틸리티 로드됨!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log('사용 방법:');
console.log('1. analyzeChatPlatform() - 자동 분석');
console.log('2. startInteractiveMode() - 요소 클릭으로 선택자 추출');
console.log('3. stopInteractiveMode() - 인터랙티브 모드 종료\n');
