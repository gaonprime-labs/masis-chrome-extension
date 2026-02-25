// popup.js - 익스텐션 설정 UI

/**
 * 개발 모드 설정
 * true: localhost:3000 사용
 * false: 프로덕션 서버 사용
 */
const DEV_MODE = false;

const PROJECT_URL_DEV = 'http://localhost:3000';
const PROJECT_URL_PROD = 'https://masis.gaonprime.com';

function getProjectUrl() {
  return DEV_MODE ? PROJECT_URL_DEV : PROJECT_URL_PROD;
}

document.addEventListener('DOMContentLoaded', async () => {
  const enabledCheckbox = document.getElementById('enabled');
  const platformSelect = document.getElementById('platform');
  const folderIdSelect = document.getElementById('folderId');
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const loginSection = document.getElementById('loginSection');
  const authSection = document.getElementById('authSection');
  const userName = document.getElementById('userName');
  const userAvatar = document.getElementById('userAvatar');
  const mappingChatNameInput = document.getElementById('mappingChatName');
  const mappingFolderIdSelect = document.getElementById('mappingFolderId');
  const addMappingBtn = document.getElementById('addMappingBtn');
  const mappingListDiv = document.getElementById('mappingList');

  // 프로젝트 URL 자동 설정
  const projectUrl = getProjectUrl();

  // 저장된 설정 불러오기
  const config = await chrome.storage.local.get([
    'enabled',
    'platform',
    'folderId',
    'characterMappings',
  ]);

  enabledCheckbox.checked = config.enabled || false;
  platformSelect.value = config.platform || 'noahchat'; // 기본값: NoahChat

  // 공유 폴더 목록 로드 (로그인 불필요)
  await loadPublicFolders(projectUrl, config.folderId);

  // 저장된 폴더가 있으면 태그 캐시 확인/업데이트
  if (config.folderId) {
    await updateFolderTagsCache(projectUrl, config.folderId);
  }

  // 캐릭터 매핑용 폴더 목록 로드
  await loadMappingFolders(projectUrl, config.folderId);

  // 캐릭터 매핑 목록 로드
  await loadCharacterMappings(config.characterMappings || {});

  // 로그인 상태 확인
  await checkAuthStatus(projectUrl);

  // 로그인 버튼
  loginBtn.addEventListener('click', async () => {
    await handleLogin(projectUrl);
  });

  // 로그아웃 버튼
  logoutBtn.addEventListener('click', async () => {
    await handleLogout(projectUrl);
  });

  // 폴더 선택 변경 시 태그 캐시 강제 업데이트
  folderIdSelect.addEventListener('change', async () => {
    const selectedFolderId = folderIdSelect.value;
    if (selectedFolderId) {
      // 폴더가 바뀌면 기존 캐시 삭제 후 새로 가져오기
      await chrome.storage.local.remove(['folderTagsCache']);
      await updateFolderTagsCache(projectUrl, selectedFolderId);
      // 매핑 폴더 목록도 업데이트
      await loadMappingFolders(projectUrl, selectedFolderId);
    }
  });

  // 매핑 추가 버튼
  addMappingBtn.addEventListener('click', async () => {
    const chatName = mappingChatNameInput.value.trim();
    const folderId = mappingFolderIdSelect.value;

    if (!chatName) {
      showStatus('채팅 이름을 입력하세요', 'error');
      return;
    }

    if (!folderId) {
      showStatus('폴더를 선택하세요', 'error');
      return;
    }

    // 폴더 이름 가져오기
    const folderName = mappingFolderIdSelect.options[mappingFolderIdSelect.selectedIndex].text;

    await addMapping(chatName, folderId, folderName);
    mappingChatNameInput.value = '';
    mappingFolderIdSelect.value = '';
  });

  // 저장 버튼 클릭
  saveBtn.addEventListener('click', async () => {
    const { characterMappings = {} } = await chrome.storage.local.get(['characterMappings']);

    const newConfig = {
      enabled: enabledCheckbox.checked,
      platform: platformSelect.value,
      folderId: folderIdSelect.value,
      characterMappings,
    };

    // 유효성 검증
    if (newConfig.enabled) {
      if (!newConfig.folderId) {
        showStatus('갤러리 폴더를 선택하세요', 'error');
        return;
      }
    }

    // 폴더 태그 캐시 업데이트 (선택된 폴더가 있으면)
    if (newConfig.folderId) {
      await updateFolderTagsCache(projectUrl, newConfig.folderId);
    }

    // 저장
    await chrome.storage.local.set(newConfig);
    showStatus('설정이 저장되었습니다', 'success');

    // content script에 설정 변경 알림 (에러 무시)
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'CONFIG_UPDATED',
          config: newConfig,
        }).catch(() => {
          // content script가 없는 탭이면 무시
        });
      }
    });

    // background에 캐시 클리어 요청 (매핑이 변경되었으므로)
    chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' }).catch(() => {
      // background가 응답하지 않으면 무시
    });
  });
});

/**
 * 공유 폴더 목록 로드 (읽기 전용, 로그인 불필요)
 */
async function loadPublicFolders(projectUrl, selectedFolderId = '') {
  const folderIdSelect = document.getElementById('folderId');

  try {
    // 공유 폴더 API 호출 (인증 불필요)
    const response = await fetch(`${projectUrl}/api/folders/public`);
    const result = await response.json();

    if (result.success && result.data && result.data.folders) {
      folderIdSelect.innerHTML = '';

      if (result.data.folders.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '공유된 폴더가 없습니다';
        folderIdSelect.appendChild(option);
        return;
      }

      result.data.folders.forEach((folder) => {
        const option = document.createElement('option');
        option.value = folder._id;
        // 폴더 이름만 표시
        option.textContent = folder.name;
        if (folder._id === selectedFolderId) {
          option.selected = true;
        }
        folderIdSelect.appendChild(option);
      });
    } else {
      throw new Error('공유 폴더 목록을 불러올 수 없습니다');
    }
  } catch (error) {
    folderIdSelect.innerHTML = '';
    const option = document.createElement('option');
    option.value = '';
    option.textContent = '폴더 로드 실패';
    folderIdSelect.appendChild(option);
  }
}

function showStatus(message, type) {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.style.display = 'block';

  setTimeout(() => {
    statusDiv.style.display = 'none';
  }, 3000);
}

/**
 * 로그인 상태 확인
 */
async function checkAuthStatus(projectUrl) {
  try {
    const response = await fetch(`${projectUrl}/api/auth/session`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to check auth status');
    }

    const session = await response.json();

    if (session && session.user) {
      // 로그인 상태
      loginSection.style.display = 'none';
      authSection.style.display = 'block';
      userName.textContent = session.user.name || session.user.email;

      if (session.user.image) {
        userAvatar.src = session.user.image;
        userAvatar.style.display = 'block';
      }
    } else {
      // 비로그인 상태
      loginSection.style.display = 'block';
      authSection.style.display = 'none';
    }
  } catch (error) {
    loginSection.style.display = 'block';
    authSection.style.display = 'none';
  }
}

/**
 * Google 로그인 처리
 */
async function handleLogin(projectUrl) {
  try {
    // Extension 전용 콜백 URL (action 파라미터로 로그인임을 명시)
    const callbackUrl = `${projectUrl}/auth-callback?action=signin`;
    const loginUrl = `${projectUrl}/extension-login?callbackUrl=${encodeURIComponent(callbackUrl)}`;

    // 새 탭에서 로그인 페이지 열기 (auth-callback 페이지에서 자동으로 닫힘)
    chrome.tabs.create({ url: loginUrl, active: true });

    // 2초 후 로그인 상태 확인 (창이 닫힌 후)
    setTimeout(async () => {
      await checkAuthStatus(projectUrl);
      showStatus('로그인이 완료되었습니다', 'success');
    }, 2000);
  } catch (error) {
    showStatus('로그인 중 오류가 발생했습니다', 'error');
  }
}

/**
 * 로그아웃 처리
 */
async function handleLogout(projectUrl) {
  try {
    // Extension 전용 콜백 URL (action 파라미터로 로그아웃임을 명시)
    const callbackUrl = `${projectUrl}/auth-callback?action=signout`;
    const signoutUrl = `${projectUrl}/api/auth/signout?callbackUrl=${encodeURIComponent(callbackUrl)}`;

    // 새 탭에서 로그아웃 페이지 열기 (auth-callback 페이지에서 자동으로 닫힘)
    chrome.tabs.create({ url: signoutUrl, active: true });

    // 2초 후 로그아웃 상태 확인 (창이 닫힌 후)
    setTimeout(async () => {
      await checkAuthStatus(projectUrl);
      showStatus('로그아웃되었습니다', 'success');
    }, 2000);
  } catch (error) {
    showStatus('로그아웃 중 오류가 발생했습니다', 'error');
  }
}

/**
 * 선택된 폴더의 태그 캐시 업데이트
 * chrome.storage.local에 저장하여 unified-select API 호출 시 활용
 */
async function updateFolderTagsCache(projectUrl, folderId) {
  try {
    // 이미 캐시가 있는지 확인 (같은 폴더 + 유효한 태그가 있을 때만 사용)
    const cached = await chrome.storage.local.get(['folderTagsCache']);
    const hasValidCache = cached.folderTagsCache
      && cached.folderTagsCache.folderId === folderId
      && cached.folderTagsCache.tags
      && Object.keys(cached.folderTagsCache.tags).length > 0;

    if (hasValidCache) {
      return cached.folderTagsCache;
    }

    const response = await fetch(`${projectUrl}/api/extension/folder-tags?folderId=${folderId}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    if (data.error) {
      return null;
    }

    // 캐시에 저장
    await chrome.storage.local.set({ folderTagsCache: data });

    return data;
  } catch (error) {
    return null;
  }
}

// 전역 변수: 캐릭터 폴더 목록 캐시
let characterFoldersCache = [];

/**
 * 매핑용 캐릭터(자식 폴더) 목록 로드
 */
async function loadMappingFolders(projectUrl, parentFolderId) {
  const mappingFolderIdSelect = document.getElementById('mappingFolderId');

  if (!parentFolderId) {
    mappingFolderIdSelect.innerHTML = '<option value="">갤러리 폴더를 먼저 선택하세요</option>';
    characterFoldersCache = [];
    return;
  }

  try {
    const response = await fetch(`${projectUrl}/api/folders/${parentFolderId}/children`, {
      credentials: 'include',
    });
    const result = await response.json();

    if (result.success && result.data) {
      const children = Array.isArray(result.data) ? result.data : (result.data.children || []);
      characterFoldersCache = children;
      mappingFolderIdSelect.innerHTML = '<option value="">캐릭터 선택</option>';

      if (children.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = '캐릭터 폴더가 없습니다';
        mappingFolderIdSelect.appendChild(option);
        return;
      }

      children.forEach((folder) => {
        const option = document.createElement('option');
        option.value = folder._id;
        option.textContent = folder.name;
        mappingFolderIdSelect.appendChild(option);
      });
    } else {
      throw new Error('캐릭터 목록을 불러올 수 없습니다');
    }
  } catch (error) {
    mappingFolderIdSelect.innerHTML = '<option value="">로드 실패</option>';
    characterFoldersCache = [];
  }
}

/**
 * 캐릭터 매핑 목록 로드 및 렌더링
 */
async function loadCharacterMappings(mappings = {}) {
  const mappingListDiv = document.getElementById('mappingList');

  if (!mappings || Object.keys(mappings).length === 0) {
    mappingListDiv.innerHTML = '<p style="font-size: 11px; color: rgba(255, 255, 255, 0.35); text-align: center; padding: 16px 8px;">아래에서 캐릭터를 선택하고 채팅 이름을 입력하세요</p>';
    return;
  }

  renderMappingList(mappings);
}

/**
 * 매핑 목록 DOM 렌더링
 * 폴더명 ← 채팅이름 형식으로 표시
 */
function renderMappingList(mappings) {
  const mappingListDiv = document.getElementById('mappingList');
  mappingListDiv.innerHTML = '';

  Object.entries(mappings).forEach(([chatName, data]) => {
    const item = document.createElement('div');
    item.className = 'mapping-item';

    // 폴더명 (왼쪽)
    const folderNameSpan = document.createElement('span');
    folderNameSpan.className = 'mapping-text';
    folderNameSpan.textContent = data.folderName || data.folderId;

    // 화살표
    const arrow = document.createElement('span');
    arrow.className = 'mapping-arrow';
    arrow.textContent = '←';

    // 채팅 이름 (오른쪽)
    const chatNameSpan = document.createElement('span');
    chatNameSpan.className = 'mapping-text';
    chatNameSpan.textContent = chatName;

    // 삭제 버튼
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '×';
    deleteBtn.onclick = () => removeMapping(chatName);

    item.appendChild(folderNameSpan);
    item.appendChild(arrow);
    item.appendChild(chatNameSpan);
    item.appendChild(deleteBtn);

    mappingListDiv.appendChild(item);
  });
}

/**
 * 새 매핑 추가
 */
async function addMapping(chatName, folderId, folderName) {
  try {
    const { characterMappings = {} } = await chrome.storage.local.get(['characterMappings']);

    // 중복 체크
    if (characterMappings[chatName]) {
      showStatus(`"${chatName}"는 이미 매핑되어 있습니다`, 'error');
      return;
    }

    // 새 매핑 추가
    characterMappings[chatName] = {
      folderId,
      folderName,
    };

    await chrome.storage.local.set({ characterMappings });
    await loadCharacterMappings(characterMappings);
    showStatus('매핑이 추가되었습니다', 'success');

    // background에 캐시 클리어 요청
    chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' }).catch(() => {
      // background가 응답하지 않으면 무시
    });

    // 현재 활성 탭 새로고침
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  } catch (error) {
    showStatus('매핑 추가 중 오류가 발생했습니다', 'error');
  }
}

/**
 * 매핑 삭제
 */
async function removeMapping(chatName) {
  try {
    const { characterMappings = {} } = await chrome.storage.local.get(['characterMappings']);

    delete characterMappings[chatName];

    await chrome.storage.local.set({ characterMappings });
    await loadCharacterMappings(characterMappings);
    showStatus('매핑이 삭제되었습니다', 'success');

    // background에 캐시 클리어 요청
    chrome.runtime.sendMessage({ type: 'CLEAR_CACHE' }).catch(() => {
      // background가 응답하지 않으면 무시
    });

    // 현재 활성 탭 새로고침
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  } catch (error) {
    showStatus('매핑 삭제 중 오류가 발생했습니다', 'error');
  }
}
