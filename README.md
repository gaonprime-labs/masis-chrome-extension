# MASIS Image Extension

캐릭터 롤플레이 채팅 사이트에서 대화 상황에 맞는 캐릭터 이미지를 자동으로 표시해주는 Chrome Extension입니다.

[MASIS](https://ark.gaonprime.com)에서 생성한 AI 캐릭터 이미지를 사용합니다.

## 주요 기능

- **자동 이미지 매칭**: 대화 내용을 분석하여 상황에 맞는 이미지 자동 선택
- **다중 캐릭터 지원**: 여러 캐릭터가 등장하는 대화에서 각각의 이미지 표시
- **태그 기반 매칭**: Danbooru 스타일 태그로 표정, 포즈, 배경 등 정밀 매칭
- **NSFW 레벨 자동 감지**: 대화 분위기에 맞는 적절한 이미지 선택

## 지원 플랫폼

- NoahChat (noahchat.kr)
- 루나톡 (lunatalk.co.kr)
- 추가 플랫폼은 PR 환영!

## 설치 방법

### 1. Extension 다운로드

```bash
git clone https://github.com/gaonprime-labs/masis-chrome-extension.git
```

또는 [Releases](https://github.com/gaonprime-labs/masis-chrome-extension/releases)에서 ZIP 다운로드

### 2. Chrome에 설치

1. Chrome에서 `chrome://extensions/` 열기
2. 우측 상단 **개발자 모드** 활성화
3. **압축해제된 확장 프로그램을 로드합니다** 클릭
4. 다운로드한 폴더 선택

### 3. MASIS 설정

1. [MASIS](https://ark.gaonprime.com)에 가입/로그인
2. 캐릭터 이미지 생성 및 폴더 정리
   - 부모 폴더 생성 (예: "내 캐릭터들")
   - 각 캐릭터별 하위 폴더 생성 (폴더 이름 = 캐릭터 이름)
   - 각 폴더에 캐릭터 이미지 저장
3. 부모 폴더 **공유 설정** 활성화

### 4. Extension 설정

1. Chrome 툴바에서 Extension 아이콘 클릭
2. **갤러리 폴더** 선택 (공유된 부모 폴더 목록에서)
3. **저장** 클릭
4. 지원 사이트에서 채팅 시작!

## 폴더 구조 예시

```
내 캐릭터들/          ← 부모 폴더 (공유 설정 필요)
├── 레이/            ← 캐릭터 폴더 (이름으로 매칭)
│   ├── smile.png
│   ├── angry.png
│   └── ...
├── 유나/
│   ├── happy.png
│   └── ...
└── 민수/
    └── ...
```

## 작동 원리

1. 채팅 사이트에서 새 메시지 감지
2. LLM이 대화 내용 분석 → 캐릭터 상태 추출 (표정, 포즈 등)
3. 추출된 태그로 MASIS 이미지 검색
4. 가장 적합한 이미지를 사이트에 표시

## 로그인 (선택사항)

Extension에서 Google 로그인 시:
- **무제한 사용** (로그인 안 하면 시간당 10회 제한)

## 기여하기

### 새 플랫폼 추가

1. `platforms/` 폴더에 새 플랫폼 파일 추가
2. `content/content-main.js`에 플랫폼 등록
3. PR 제출

### 플랫폼 파일 구조

```javascript
// platforms/example.js
export default {
  name: 'example',
  hostPatterns: ['example.com'],

  // 메시지 컨테이너 찾기
  getMessageContainer() { ... },

  // 이미지 삽입 위치 찾기
  getImageInsertPoint(message) { ... },

  // 새 메시지 감지
  observeNewMessages(callback) { ... },
}
```

## 라이선스

MIT License

## 관련 프로젝트

- [MASIS](https://ark.gaonprime.com) - AI 캐릭터 이미지 생성기
