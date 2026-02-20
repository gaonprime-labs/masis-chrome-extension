// popup.js - 익스텐션 설정 UI

/**
 * 프로젝트 URL 상수
 * 개발 환경: http://localhost:3000
 * 프로덕션: https://ark.gaonprime.com
 */
function getProjectUrl() {
  // 로컬 개발 시에는 localhost 사용, 배포 시에는 프로덕션 URL 사용
  const isDevelopment = !('update_url' in chrome.runtime.getManifest());
  return isDevelopment ? 'http://localhost:3000' : 'https://ark.gaonprime.com';
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

  // 프로젝트 URL 자동 설정
  const projectUrl = getProjectUrl();

  // 저장된 설정 불러오기
  const config = await chrome.storage.local.get([
    'enabled',
    'platform',
    'folderId',
  ]);

  enabledCheckbox.checked = config.enabled || false;
  platformSelect.value = config.platform || 'noahchat'; // 기본값: NoahChat

  // 공유 폴더 목록 로드 (로그인 불필요)
  await loadPublicFolders(projectUrl, config.folderId);

  // 저장된 폴더가 있으면 태그 캐시 확인/업데이트
  if (config.folderId) {
    await updateFolderTagsCache(projectUrl, config.folderId);
  }

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
    }
  });

  // 저장 버튼 클릭
  saveBtn.addEventListener('click', async () => {
    const newConfig = {
      enabled: enabledCheckbox.checked,
      platform: platformSelect.value,
      folderId: folderIdSelect.value,
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
