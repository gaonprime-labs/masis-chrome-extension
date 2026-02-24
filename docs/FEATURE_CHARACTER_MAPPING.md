# 캐릭터명 매핑 기능 설계 문서

## 📋 요약

채팅에 등장하는 캐릭터명과 이미지 폴더명을 사용자가 직접 매핑할 수 있는 기능입니다.

**예시**:
- 채팅에 "가온"이 나타나면 → "레이" 폴더에서 이미지를 찾음
- 매핑이 없으면 기존처럼 "가온" 폴더를 찾음

---

## 🎯 목표

1. 사용자가 popup UI에서 캐릭터명 ↔ 폴더 매핑을 설정
2. 기존 자동 매칭 로직과 호환 (매핑이 없으면 기존 동작 유지)
3. 여러 채팅 캐릭터명을 하나의 폴더에 매핑 가능 (다대일)
4. 매핑 설정은 chrome.storage.local에 저장

---

## 📐 아키텍처

### 데이터 구조

```javascript
// chrome.storage.local에 저장
{
  // 기존 설정
  enabled: boolean,
  platform: string,
  folderId: string,
  folderTagsCache: object,

  // 신규: 캐릭터명 매핑
  characterMappings: {
    // chatName → folderName 매핑 (다대일 지원)
    "가온": "레이",
    "미카": "레이",     // 여러 이름이 같은 폴더 가능
    "시온": "엔비",
    // ...
  }
}
```

### 수정 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `popup.html` | 매핑 관리 UI 섹션 추가 |
| `popup.js` | 매핑 CRUD 로직 추가 |
| `background.js` | 매핑 적용 로직 추가 |
| `background/folder-matcher.js` | 매핑 우선 적용 로직 |

---

## 🖼️ UI 설계 (popup.html)

### 매핑 관리 섹션

```
┌─────────────────────────────────────────┐
│ 캐릭터명 매핑                            │
├─────────────────────────────────────────┤
│                                         │
│  채팅 이름          →  폴더 선택         │
│  ┌────────────────┐   ┌────────────┬─┐ │
│  │                │   │ (드롭다운) │▼│ │
│  └────────────────┘   └────────────┴─┘ │
│                         [+ 추가]        │
│                                         │
├─────────────────────────────────────────┤
│ 현재 매핑 목록                           │
├─────────────────────────────────────────┤
│ • 가온 → 레이                    [삭제] │
│ • 미카 → 레이                    [삭제] │
│ • 시온 → 엔비                    [삭제] │
└─────────────────────────────────────────┘
```

### HTML 구조

```html
<!-- popup.html에 추가 -->
<div class="section mapping-section">
  <label>캐릭터명 매핑</label>
  <p class="hint">채팅 캐릭터명을 다른 폴더와 연결합니다</p>

  <!-- 새 매핑 추가 폼 -->
  <div class="mapping-form">
    <input type="text" id="chatNameInput" placeholder="채팅 이름 (예: 가온)">
    <span class="arrow">→</span>
    <select id="folderSelect">
      <!-- 동적으로 폴더 목록 로드 -->
    </select>
    <button id="addMappingBtn" class="btn-small">추가</button>
  </div>

  <!-- 매핑 목록 -->
  <div id="mappingList" class="mapping-list">
    <!-- 동적으로 생성 -->
  </div>
</div>
```

---

## 💻 구현 세부사항

### 1. popup.js 변경

```javascript
// 초기화 시 매핑 목록 로드
async function loadCharacterMappings() {
  const config = await chrome.storage.local.get(['characterMappings']);
  const mappings = config.characterMappings || {};
  renderMappingList(mappings);
}

// 매핑 추가
async function addMapping(chatName, folderName) {
  const config = await chrome.storage.local.get(['characterMappings']);
  const mappings = config.characterMappings || {};

  // 중복 체크
  if (mappings[chatName]) {
    showStatus(`"${chatName}"은 이미 매핑되어 있습니다`, 'error');
    return;
  }

  mappings[chatName] = folderName;
  await chrome.storage.local.set({ characterMappings: mappings });
  renderMappingList(mappings);
  showStatus('매핑이 추가되었습니다', 'success');
}

// 매핑 삭제
async function removeMapping(chatName) {
  const config = await chrome.storage.local.get(['characterMappings']);
  const mappings = config.characterMappings || {};
  delete mappings[chatName];
  await chrome.storage.local.set({ characterMappings: mappings });
  renderMappingList(mappings);
}

// 매핑 목록 렌더링
function renderMappingList(mappings) {
  const container = document.getElementById('mappingList');
  container.innerHTML = '';

  Object.entries(mappings).forEach(([chatName, folderName]) => {
    const item = document.createElement('div');
    item.className = 'mapping-item';
    item.innerHTML = `
      <span class="mapping-text">${chatName} → ${folderName}</span>
      <button class="btn-delete" data-chat-name="${chatName}">삭제</button>
    `;
    container.appendChild(item);
  });

  // 삭제 버튼 이벤트
  container.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => removeMapping(btn.dataset.chatName));
  });
}
```

### 2. background.js 변경

```javascript
async function handleParseAndFindMultiple(text, sendResponse) {
  // ... 기존 코드 ...

  // 2. 설정 가져오기 (characterMappings 추가)
  const config = await chrome.storage.local.get([
    'enabled',
    'folderId',
    'folderTagsCache',
    'characterMappings',  // 신규 추가
  ]);

  // ... 기존 코드 ...

  // 7. Unified API 호출 (매핑 정보 전달)
  const apiResponse = await fetch(`${projectUrl}/api/extension/unified-select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      characterFolders,
      availableTags,
      characterMappings: config.characterMappings || {},  // 신규 추가
    }),
  });

  // ... 기존 코드 ...
}
```

### 3. folder-matcher.js 변경

```javascript
/**
 * 매핑을 적용하여 폴더 검색
 *
 * @param {string} characterName - 원본 캐릭터 이름
 * @param {Object} mappings - 캐릭터명 매핑 (chatName → folderName)
 * @returns {string} 매핑된 이름 또는 원본 이름
 */
function applyMapping(characterName, mappings) {
  if (!mappings || typeof mappings !== 'object') {
    return characterName;
  }

  // 정확한 매핑 확인
  if (mappings[characterName]) {
    console.log(`[FolderMatcher] 🔗 Mapping applied: "${characterName}" → "${mappings[characterName]}"`);
    return mappings[characterName];
  }

  // 대소문자 무시 매핑 확인
  const lowerName = characterName.toLowerCase();
  const mappedEntry = Object.entries(mappings).find(
    ([key]) => key.toLowerCase() === lowerName
  );

  if (mappedEntry) {
    console.log(`[FolderMatcher] 🔗 Mapping applied (case-insensitive): "${characterName}" → "${mappedEntry[1]}"`);
    return mappedEntry[1];
  }

  return characterName;
}

/**
 * 인물 이름으로 폴더 검색 (매핑 적용)
 */
async function findFolderByName(characterName, projectUrl, parentFolderId, mappings = {}) {
  // 매핑 적용
  const targetName = applyMapping(characterName, mappings);

  console.log(`[FolderMatcher] 🔍 Searching folder for: "${characterName}" (target: "${targetName}")`);

  // ... 기존 검색 로직 (targetName 사용) ...
}

/**
 * 등장인물 이름을 기반으로 폴더 검색 및 매칭 (매핑 지원)
 */
export async function matchCharacterFolders(characters, projectUrl, parentFolderId, mappings = {}) {
  console.log('[FolderMatcher] 🔍 Matching folders for', characters.length, 'characters');
  console.log('[FolderMatcher] 📁 Parent folder:', parentFolderId);
  console.log('[FolderMatcher] 🔗 Mappings:', mappings);

  const matchedCharacters = await Promise.all(
    characters.map(async (character) => {
      try {
        const folderId = await findFolderByName(
          character.name,
          projectUrl,
          parentFolderId,
          mappings  // 매핑 전달
        );
        return { ...character, folderId };
      } catch (error) {
        console.error(`[FolderMatcher] ❌ Error:`, error);
        return { ...character, folderId: null };
      }
    })
  );

  return matchedCharacters;
}
```

---

## 🔄 처리 흐름

```
1. 사용자가 popup에서 매핑 설정
   예: "가온" → "레이"

2. 저장: chrome.storage.local.set({ characterMappings: {...} })

3. 채팅 메시지 감지 (content script)
   "가온이 웃으며 말했다..."

4. background.js에서 처리
   - 설정 로드 (characterMappings 포함)
   - unified-select API 호출 (매핑 정보 전달)

5. API에서 캐릭터 추출
   - 추출된 캐릭터: "가온"
   - 매핑 적용: "가온" → "레이"
   - "레이" 폴더에서 이미지 검색

6. 이미지 반환 및 표시
```

---

## 📝 API 변경 (masis 메인 프로젝트)

### unified-select API 수정

```typescript
// src/app/api/extension/unified-select/route.ts

interface UnifiedSelectRequest {
  text: string;
  characterFolders: CharacterFolder[];
  availableTags: Record<string, string>;
  characterMappings?: Record<string, string>;  // 신규 추가
}

// 매핑 적용 함수
function applyCharacterMappings(
  characters: string[],
  mappings: Record<string, string>
): Map<string, string> {
  const result = new Map<string, string>();

  characters.forEach(char => {
    const mapped = mappings[char] || char;
    result.set(char, mapped);
  });

  return result;
}
```

---

## 🧪 테스트 시나리오

### 1. 기본 매핑 테스트
- [ ] 매핑 없이 "레이" → "레이" 폴더 검색 (기존 동작)
- [ ] 매핑 "가온" → "레이" 설정 후 "가온" → "레이" 폴더 검색
- [ ] 매핑 삭제 후 "가온" → "가온" 폴더 검색

### 2. 다대일 매핑 테스트
- [ ] "가온", "미카" 둘 다 "레이"에 매핑
- [ ] "가온" 등장 시 "레이" 폴더 사용
- [ ] "미카" 등장 시 "레이" 폴더 사용

### 3. 대소문자 테스트
- [ ] 매핑 "Ray" → "레이" 설정
- [ ] 채팅 "ray" 등장 시 "레이" 폴더 사용

### 4. 폴더 변경 시 동작
- [ ] 폴더 변경 시 매핑은 유지
- [ ] 폴더 선택 드롭다운은 새 폴더 기준으로 갱신

---

## ⏱️ 구현 우선순위

### Phase 1: 기본 기능 (필수)
1. popup.html/js에 매핑 UI 추가
2. chrome.storage에 매핑 저장/로드
3. background.js에서 매핑 읽기
4. folder-matcher.js에서 매핑 적용

### Phase 2: UX 개선 (권장)
1. 폴더 드롭다운 자동완성
2. 매핑 import/export 기능
3. 중복 매핑 경고

### Phase 3: 고급 기능 (선택)
1. 정규식 매핑 지원
2. 폴더별 매핑 그룹
3. 매핑 우선순위 설정

---

## 🚨 주의사항

1. **하위 호환성**: `characterMappings`가 없어도 기존 동작 유지
2. **성능**: 매핑 적용은 O(1) 해시 조회로 구현
3. **저장 용량**: chrome.storage.local 제한 (5MB) 내에서 충분
4. **동기화**: 매핑 변경 시 캐시 초기화 필요

---

## 📁 관련 파일

- Extension: `/Users/MooSaeng/coding/gaon/masis-chrome-extension/`
- Main Project: `/Users/MooSaeng/coding/gaon/masis/`
- API: `src/app/api/extension/unified-select/route.ts`
