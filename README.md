# masis Image Extension - Google 로그인 설정 가이드

Extension에서 Google OAuth 로그인을 사용하여 무제한으로 LLM API를 이용할 수 있습니다.

## 1. Google OAuth Client ID 발급

### 1.1 Google Cloud Console 접속
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택 (또는 새 프로젝트 생성)

### 1.2 OAuth 동의 화면 구성
1. **APIs & Services** → **OAuth consent screen** 이동
2. User Type: **External** 선택
3. 필수 정보 입력:
   - App name: `masis Extension`
   - User support email: 본인 이메일
   - Developer contact: 본인 이메일
4. Scopes: 기본값 유지 (필요시 `email`, `profile`, `openid` 추가)
5. Test users: 본인 이메일 추가 (개발 중)

### 1.3 OAuth Client ID 생성
1. **APIs & Services** → **Credentials** 이동
2. **+ CREATE CREDENTIALS** → **OAuth client ID** 클릭
3. Application type: **Web application** 선택
4. Name: `masis Web Client`
5. **Authorized redirect URIs** 추가:
   ```
   https://ark.gaonprime.com/api/auth/callback/google
   ```
6. **CREATE** 클릭
7. **Client ID** 복사
8. **Client Secret** 복사

## 2. 프로젝트 환경변수 설정

### 2.1 `.env.local` 파일 수정
```env
# Google OAuth (Web Application)
AUTH_GOOGLE_ID=123456789-abc.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=GOCSPX-xxx

# OpenRouter API Key
OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

### 2.2 서버 재시작
```bash
npm run dev
```

## 3. Extension 설치 및 설정

### 3.1 Extension 설치
1. Chrome → `chrome://extensions/` 이동
2. **개발자 모드** 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. `extension/` 폴더 선택

### 3.2 Extension 설정
1. Chrome 툴바에서 Extension 아이콘 클릭
2. **갤러리 폴더** 선택
3. **저장** 클릭

**참고**: Extension은 `https://ark.gaonprime.com` 서버에 자동으로 연결됩니다.

## 4. 로그인 사용 방법

### 4.1 Google 로그인
1. Extension popup에서 **🔐 Google 로그인 (무제한 사용)** 버튼 클릭
2. 새 탭에서 Next.js 로그인 페이지 열림
3. Google 계정 선택 및 권한 승인
4. 로그인 완료 후 탭 닫기
5. Extension popup에 로그인 상태 표시:
   - 사용자 이름/이메일
   - 프로필 이미지
   - 로그아웃 버튼

### 4.2 로그인 혜택
- **무제한 LLM API 사용** (Rate Limit 없음)
- 비로그인: 시간당 10회 제한

### 4.3 로그아웃
Extension popup에서 **로그아웃** 버튼 클릭

## 5. 인증 흐름

```
Extension Popup
    ↓ [Google 로그인 클릭]
Next.js 로그인 페이지 (새 탭)
    ↓ [Google OAuth]
Google 계정 선택
    ↓ [권한 승인]
NextAuth 세션 생성 (쿠키)
    ↓ [탭 닫기]
Extension Popup (세션 확인)
    ↓ [로그인 완료]
API 호출 시 세션 쿠키 자동 포함
    ↓ [무제한 사용 ✅]
```

## 6. 트러블슈팅

### 6.1 로그인 버튼이 보이지 않음
- `https://ark.gaonprime.com` 서버가 정상 작동 중인지 확인
- Extension 설정에서 **갤러리 폴더** 선택 후 저장

### 6.2 로그인 후에도 Rate Limit 적용됨
- 브라우저 쿠키 설정 확인 (타사 쿠키 허용)
- Chrome DevTools → Network → `api/extension/parse` 요청 확인
- 쿠키 헤더에 `authjs.session-token` 포함 여부 확인

### 6.3 "Configuration incomplete" 에러
- Extension 설정에서 **갤러리 폴더** 선택
- 저장 버튼 클릭 후 재시도

## 7. 보안 정보

### 7.1 API Key 보호
- ✅ `OPENROUTER_API_KEY`는 서버에만 저장
- ✅ Extension에서 완전히 제거
- ✅ 클라이언트에 노출되지 않음

### 7.2 Rate Limiting
| 사용자 유형 | 제한 |
|------------|------|
| 로그인 | 무제한 |
| 비로그인 | 10회/시간 (IP 기반) |

### 7.3 인증 방식
- NextAuth v5 (Auth.js) 사용
- Google OAuth 2.0
- HttpOnly 쿠키 기반 세션
- 7일 세션 만료

---

**문의**: GitHub Issues
