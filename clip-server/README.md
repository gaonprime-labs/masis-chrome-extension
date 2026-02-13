# CLIP Server - 로컬 시맨틱 이미지 필터링 서버

NovelAI/Stable Diffusion 이미지 선택을 위한 CLIP 기반 시맨틱 유사도 서버입니다.

## 📋 개요

- **목적**: 대화 내용과 시맨틱하게 가장 유사한 이미지를 선택하기 위한 CLIP 임베딩 생성
- **모델**: OpenAI CLIP ViT-L/14 (가장 정확한 CLIP 모델)
- **프레임워크**: FastAPI + PyTorch + Transformers
- **비용**: 완전 무료 (로컬 실행)

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
cd clip-server

# Python 가상환경 생성 (권장)
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r requirements.txt
```

### 2. 서버 실행

#### 방법 1: 직접 실행 (개발/테스트)
```bash
# 기본 실행
python3 server.py

# 또는 uvicorn으로 실행
uvicorn server:app --host 0.0.0.0 --port 8000
```

#### 방법 2: PM2 (프로덕션 권장)
```bash
# PM2 설치 (Node.js 필요)
npm install -g pm2

# 서버 시작
pm2 start ecosystem.config.js

# 상태 확인
pm2 status

# 로그 확인
pm2 logs clip-server

# 서버 중지
pm2 stop clip-server

# 서버 재시작
pm2 restart clip-server
```

#### 방법 3: Docker
```bash
# CPU 버전 (대부분의 경우)
docker build -t clip-server .
docker run -p 8000:8000 clip-server

# GPU 버전 (NVIDIA GPU가 있는 경우)
docker build -f Dockerfile.gpu -t clip-server-gpu .
docker run --gpus all -p 8000:8000 clip-server-gpu
```

### 3. Next.js 환경변수 설정

프로젝트 루트의 `.env.local` 파일에 추가:

```bash
CLIP_PROVIDER=local
LOCAL_CLIP_ENDPOINT=http://localhost:8000
```

### 4. 테스트

```bash
# 테스트 스크립트 실행
python3 test.py

# 또는 수동 테스트
curl http://localhost:8000/health
```

## 📊 API 엔드포인트

### 1. Health Check
```http
GET /health
```

**응답**:
```json
{
  "status": "healthy",
  "model": "openai/clip-vit-large-patch14",
  "device": "cuda"
}
```

### 2. 단일 임베딩 생성
```http
POST /embed
Content-Type: application/json

{
  "input": "happy girl with smile",
  "type": "text"
}
```

**응답**:
```json
{
  "success": true,
  "embedding": [0.123, -0.456, ...],  // 768차원 벡터
  "processing_time": 0.15
}
```

### 3. 배치 임베딩 생성
```http
POST /embed/batch
Content-Type: application/json

{
  "inputs": ["text1", "text2", "text3"],
  "type": "text"
}
```

**응답**:
```json
{
  "success": true,
  "embeddings": [[...], [...], [...]],
  "count": 3,
  "processing_time": 0.35
}
```

## 🔧 성능 최적화

### GPU 사용 (권장)
- **NVIDIA GPU**: CUDA 자동 감지 및 사용
- **Apple Silicon**: MPS (Metal Performance Shaders) 자동 사용
- **CPU**: 폴백 옵션 (느림)

### 캐싱
- 이미지 다운로드: LRU 캐시 (최대 100개)
- 추가 캐싱: Redis 연동 가능 (선택 사항)

### 배치 처리
단일 요청 대신 `/embed/batch` 엔드포인트 사용 시 최대 3배 빠름

## 📁 파일 구조

```
clip-server/
├── server.py              # FastAPI 서버 메인 코드
├── requirements.txt       # Python 의존성
├── ecosystem.config.js    # PM2 설정
├── Dockerfile            # Docker 이미지 (CPU)
├── Dockerfile.gpu        # Docker 이미지 (GPU)
├── test.py               # 테스트 스크립트
├── start.sh              # 시작 스크립트
├── .gitignore           # Git 제외 파일
└── README.md            # 이 파일
```

## 🐛 트러블슈팅

### "CUDA out of memory" 오류
- 배치 크기 줄이기
- GPU 메모리 부족 시 CPU 모드로 전환

### "Connection refused" 오류
- 서버가 실행 중인지 확인: `curl http://localhost:8000/health`
- 포트 8000이 사용 중인지 확인: `lsof -i :8000`

### 느린 처리 속도
- GPU 사용 확인 (서버 로그에서 "Using NVIDIA GPU" 또는 "Using Apple Silicon GPU")
- 배치 처리 사용
- 이미지 해상도 낮추기 (필요 시)

## 📊 성능 벤치마크

| 하드웨어 | 단일 임베딩 | 배치 10개 | 배치 100개 |
|---------|-----------|---------|----------|
| NVIDIA RTX 3080 | ~50ms | ~150ms | ~1.2s |
| Apple M1 Max | ~100ms | ~300ms | ~2.5s |
| CPU (i7-12700) | ~500ms | ~4s | ~40s |

## 🔗 관련 문서

- [CLIP 전체 설정 가이드](../docs/LOCAL_CLIP_SETUP.md)
- [CLIP 논문](https://arxiv.org/abs/2103.00020)
- [Hugging Face Transformers](https://huggingface.co/docs/transformers)

## 📝 라이선스

MIT License
