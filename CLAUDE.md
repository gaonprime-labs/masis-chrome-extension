# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## 💬 Communication Language
**IMPORTANT: Always communicate in Korean (한국어)**
- All responses, explanations, and messages must be in Korean
- Code comments can be in English for consistency
- Error messages and logs can remain in English

# masis Chrome Extension

캐릭터 이미지 자동 선택을 위한 크롬 확장 프로그램입니다.

## 기술 스택

- **Extension**: Chrome Manifest V3
- **API Server**: masis (Next.js API route)

## 프로젝트 구조

```
├── api/                    # API 서버 (Next.js → Express 변환 예정)
│   └── unified-select/
├── background/             # 크롬 확장 백그라운드 스크립트
├── content/                # 크롬 확장 컨텐츠 스크립트
├── platforms/              # 플랫폼별 핸들러
├── docs/                   # 문서
├── manifest.json           # 크롬 확장 매니페스트
├── background.js           # 메인 백그라운드 스크립트
├── popup.html / popup.js   # 팝업 UI
└── README.md
```

## 환경변수

```env
MASIS_API_URL=         # masis API 서버 URL
OPENROUTER_API_KEY=    # OpenRouter API 키
```

## TODO

- [ ] API 서버를 Express/Fastify로 변환
- [ ] 독립적인 package.json 생성
- [ ] TypeScript 빌드 설정
- [ ] 테스트 환경 구성
- [ ] 태그 기반 이미지 매칭 구현
