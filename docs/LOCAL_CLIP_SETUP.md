# 로컬 CLIP 서버 구축 가이드

무료로 CLIP 임베딩 서버를 직접 호스팅하는 방법입니다.

## 📋 목차

1. [시스템 요구사항](#시스템-요구사항)
2. [Python 환경 설정](#python-환경-설정)
3. [CLIP 서버 구축](#clip-서버-구축)
4. [Next.js 통합](#nextjs-통합)
5. [배포 옵션](#배포-옵션)

---

## 시스템 요구사항

### 최소 사양
- **CPU**: 4코어 이상
- **RAM**: 8GB 이상
- **Storage**: 5GB (모델 캐시)
- **Python**: 3.9 이상

### 권장 사양 (GPU 사용)
- **GPU**: NVIDIA GPU (CUDA 지원)
- **VRAM**: 4GB 이상
- **CUDA**: 11.8 이상
- **cudNN**: 8.x

### 성능 비교
| 환경 | 이미지당 처리 시간 | 배치 처리 (10장) |
|------|------------------|-----------------|
| CPU (4코어) | ~2-3초 | ~20초 |
| GPU (RTX 3060) | ~0.1초 | ~0.5초 |
| GPU (RTX 4090) | ~0.05초 | ~0.2초 |

---

## Python 환경 설정

### 1. 프로젝트 디렉토리 생성

```bash
cd /Users/MooSaeng/coding/gaon/character-generator
mkdir clip-server
cd clip-server
```

### 2. 가상환경 생성

```bash
# Python venv 사용
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# venv\Scripts\activate   # Windows

# 또는 conda 사용
conda create -n clip-server python=3.10
conda activate clip-server
```

### 3. 의존성 설치

**CPU 버전** (macOS/일반 서버):
```bash
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install transformers pillow fastapi uvicorn pydantic python-multipart
```

**GPU 버전** (NVIDIA GPU):
```bash
# CUDA 11.8
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu118

# CUDA 12.1
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

pip install transformers pillow fastapi uvicorn pydantic python-multipart
```

**Apple Silicon (M1/M2/M3)** - MPS 가속:
```bash
pip install torch torchvision
pip install transformers pillow fastapi uvicorn pydantic python-multipart
```

---

## CLIP 서버 구축

### 1. 서버 코드 작성

`clip-server/server.py`:

```python
# clip-server/server.py
import torch
from transformers import CLIPProcessor, CLIPModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import requests
from io import BytesIO
from typing import List, Literal
import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# FastAPI 앱 초기화
app = FastAPI(title="CLIP Embedding Server", version="1.0.0")

# CORS 설정 (Next.js에서 접근 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://ark.gaonprime.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 디바이스 설정 (GPU > MPS > CPU)
if torch.cuda.is_available():
    device = "cuda"
    logger.info("🚀 Using NVIDIA GPU (CUDA)")
elif torch.backends.mps.is_available():
    device = "mps"
    logger.info("🚀 Using Apple Silicon GPU (MPS)")
else:
    device = "cpu"
    logger.warning("⚠️  Using CPU (slow performance)")

# CLIP 모델 로드 (서버 시작 시 한 번만)
MODEL_NAME = "openai/clip-vit-large-patch14"  # ViT-L/14
logger.info(f"📦 Loading CLIP model: {MODEL_NAME}")

model = CLIPModel.from_pretrained(MODEL_NAME).to(device)
processor = CLIPProcessor.from_pretrained(MODEL_NAME)

logger.info("✅ CLIP model loaded successfully")

# 요청 스키마
class EmbeddingRequest(BaseModel):
    input: str
    type: Literal["text", "image"]

class BatchEmbeddingRequest(BaseModel):
    inputs: List[str]
    type: Literal["text", "image"]

# 응답 스키마
class EmbeddingResponse(BaseModel):
    success: bool
    embedding: List[float] | None = None
    error: str | None = None

class BatchEmbeddingResponse(BaseModel):
    success: bool
    embeddings: List[List[float]] | None = None
    error: str | None = None

# 헬스체크
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "device": device,
        "model": MODEL_NAME,
    }

# 단일 임베딩 생성
@app.post("/embed", response_model=EmbeddingResponse)
async def create_embedding(request: EmbeddingRequest):
    try:
        logger.info(f"🔍 Processing {request.type} embedding request")

        if request.type == "text":
            # 텍스트 임베딩
            inputs = processor(text=[request.input], return_tensors="pt", padding=True).to(device)

            with torch.no_grad():
                text_features = model.get_text_features(**inputs)
                # L2 정규화
                text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)

            embedding = text_features[0].cpu().numpy().tolist()

        elif request.type == "image":
            # 이미지 URL에서 다운로드
            response = requests.get(request.input, timeout=10)
            response.raise_for_status()

            image = Image.open(BytesIO(response.content)).convert("RGB")

            # 이미지 임베딩
            inputs = processor(images=image, return_tensors="pt").to(device)

            with torch.no_grad():
                image_features = model.get_image_features(**inputs)
                # L2 정규화
                image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)

            embedding = image_features[0].cpu().numpy().tolist()

        else:
            raise HTTPException(status_code=400, detail="Invalid type")

        logger.info(f"✅ Embedding created: {len(embedding)} dimensions")

        return EmbeddingResponse(
            success=True,
            embedding=embedding
        )

    except requests.RequestException as e:
        logger.error(f"❌ Image download failed: {e}")
        return EmbeddingResponse(
            success=False,
            error=f"Failed to download image: {str(e)}"
        )
    except Exception as e:
        logger.error(f"❌ Embedding failed: {e}")
        return EmbeddingResponse(
            success=False,
            error=f"Embedding generation failed: {str(e)}"
        )

# 배치 임베딩 생성 (성능 최적화)
@app.post("/embed/batch", response_model=BatchEmbeddingResponse)
async def create_batch_embeddings(request: BatchEmbeddingRequest):
    try:
        logger.info(f"🔍 Processing batch of {len(request.inputs)} {request.type} embeddings")

        if request.type == "text":
            # 배치 텍스트 임베딩
            inputs = processor(text=request.inputs, return_tensors="pt", padding=True).to(device)

            with torch.no_grad():
                text_features = model.get_text_features(**inputs)
                text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)

            embeddings = text_features.cpu().numpy().tolist()

        elif request.type == "image":
            # 배치 이미지 다운로드
            images = []
            for url in request.inputs:
                response = requests.get(url, timeout=10)
                response.raise_for_status()
                image = Image.open(BytesIO(response.content)).convert("RGB")
                images.append(image)

            # 배치 이미지 임베딩
            inputs = processor(images=images, return_tensors="pt").to(device)

            with torch.no_grad():
                image_features = model.get_image_features(**inputs)
                image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)

            embeddings = image_features.cpu().numpy().tolist()

        else:
            raise HTTPException(status_code=400, detail="Invalid type")

        logger.info(f"✅ Batch embeddings created: {len(embeddings)} items")

        return BatchEmbeddingResponse(
            success=True,
            embeddings=embeddings
        )

    except Exception as e:
        logger.error(f"❌ Batch embedding failed: {e}")
        return BatchEmbeddingResponse(
            success=False,
            error=f"Batch embedding generation failed: {str(e)}"
        )

if __name__ == "__main__":
    import uvicorn

    # 서버 실행
    uvicorn.run(
        app,
        host="0.0.0.0",  # 외부 접근 허용
        port=8000,
        log_level="info"
    )
```

### 2. 서버 실행

```bash
cd clip-server
source venv/bin/activate  # 가상환경 활성화

# 개발 모드
python server.py

# 또는 uvicorn 직접 사용
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### 3. 테스트

```bash
# 헬스체크
curl http://localhost:8000/health

# 텍스트 임베딩
curl -X POST http://localhost:8000/embed \
  -H "Content-Type: application/json" \
  -d '{"input": "a happy smiling girl", "type": "text"}'

# 이미지 임베딩
curl -X POST http://localhost:8000/embed \
  -H "Content-Type: application/json" \
  -d '{"input": "https://example.com/image.jpg", "type": "image"}'
```

---

## Next.js 통합

### 1. Local CLIP Client 추가

`src/lib/clip/client.ts`에 LocalClipClient 추가:

```typescript
/**
 * Local CLIP 클라이언트
 *
 * 로컬 서버에서 실행되는 CLIP 모델 사용
 */
export class LocalClipClient implements IClipClient {
  private readonly endpoint: string;
  private readonly timeout: number;

  constructor(config: ClipConfig) {
    this.endpoint = config.endpoint || 'http://localhost:8000';
    this.timeout = config.timeout || 30000;
  }

  async getEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.endpoint}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
        body: JSON.stringify({
          input: request.input,
          type: request.type,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Local CLIP API error: ${response.status} - ${error}`,
        };
      }

      const data = await response.json();

      return {
        success: data.success,
        embedding: data.embedding,
        error: data.error,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `Local CLIP embedding failed: ${message}`,
      };
    }
  }
}
```

### 2. Factory 함수 수정

```typescript
export function createClipClient(
  config: ClipConfig,
  provider: 'replicate' | 'openai' | 'local' = 'local'
): IClipClient {
  switch (provider) {
    case 'local':
      return new LocalClipClient(config);
    case 'replicate':
      return new ReplicateClipClient(config);
    case 'openai':
      return new OpenAIClipClient(config);
    default:
      throw new Error(`Unknown CLIP provider: ${provider}`);
  }
}
```

### 3. 환경변수 설정

`.env.local`:
```bash
# Local CLIP Server
CLIP_PROVIDER=local
LOCAL_CLIP_ENDPOINT=http://localhost:8000

# Replicate는 주석 처리 (사용 안 함)
# REPLICATE_API_KEY=r8_xxx
```

### 4. unified-select API 수정

```typescript
// Stage 2.5에서 로컬 CLIP 사용
const clipProvider = process.env.CLIP_PROVIDER || 'local';
const clipEndpoint = process.env.LOCAL_CLIP_ENDPOINT || 'http://localhost:8000';

const clipFilter = new ClipFilter(
  {
    apiKey: '', // 로컬은 API 키 불필요
    endpoint: clipEndpoint,
    timeout: 60000
  },
  clipProvider as 'local' | 'replicate' | 'openai'
);
```

---

## 배포 옵션

### Option 1: 같은 서버에서 실행 (권장)

**장점**: 네트워크 지연 없음, 간단한 설정
**단점**: 서버 리소스 추가 사용

```bash
# PM2로 프로세스 관리
npm install -g pm2

# CLIP 서버 백그라운드 실행
cd clip-server
pm2 start server.py --name clip-server --interpreter python3

# Next.js와 함께 실행
pm2 start "yarn dev" --name nextjs
pm2 save
pm2 startup
```

### Option 2: Docker 컨테이너

`clip-server/Dockerfile`:
```dockerfile
FROM python:3.10-slim

# CUDA 지원 필요 시: FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

WORKDIR /app

# 의존성 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 서버 코드 복사
COPY server.py .

# 포트 노출
EXPOSE 8000

# 서버 실행
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
```

`clip-server/requirements.txt`:
```txt
torch==2.1.0
torchvision==0.16.0
transformers==4.35.0
pillow==10.1.0
fastapi==0.104.1
uvicorn==0.24.0
pydantic==2.5.0
python-multipart==0.0.6
requests==2.31.0
```

**빌드 및 실행**:
```bash
cd clip-server

# CPU 버전
docker build -t clip-server .
docker run -d -p 8000:8000 --name clip-server clip-server

# GPU 버전 (NVIDIA Docker 필요)
docker build -t clip-server-gpu -f Dockerfile.gpu .
docker run -d --gpus all -p 8000:8000 --name clip-server-gpu clip-server-gpu
```

### Option 3: 별도 서버 (분리 아키텍처)

**장점**: 리소스 분산, 독립적인 스케일링
**단점**: 네트워크 지연, 복잡한 설정

```bash
# CLIP 서버 (별도 서버)
server1:8000

# Next.js 서버 (기존 서버)
server2:3000
```

`.env.local`:
```bash
LOCAL_CLIP_ENDPOINT=http://server1:8000
```

### Option 4: Serverless (AWS Lambda)

**장점**: 오토스케일링, 사용한 만큼만 과금
**단점**: Cold start, 복잡한 설정

AWS Lambda는 모델 크기 제한으로 **권장하지 않음** (CLIP 모델 ~1.7GB)

---

## 성능 최적화

### 1. 모델 양자화 (4-bit/8-bit)

```python
from transformers import BitsAndBytesConfig

# 8-bit 양자화 (메모리 50% 절감)
quantization_config = BitsAndBytesConfig(load_in_8bit=True)

model = CLIPModel.from_pretrained(
    MODEL_NAME,
    quantization_config=quantization_config,
    device_map="auto"
)
```

### 2. 배치 처리 활용

```typescript
// 10개 이미지를 한 번에 처리
const clipResult = await clipFilter.filterImagesBySimilarity(
  sceneSummary,
  images,
  { topK: 10, batchSize: 10 }  // 배치 사이즈 지정
);
```

### 3. Redis 캐싱 추가

```python
import redis
import json

redis_client = redis.Redis(host='localhost', port=6379, db=0)

@app.post("/embed")
async def create_embedding(request: EmbeddingRequest):
    # 캐시 키 생성
    cache_key = f"clip:{request.type}:{hash(request.input)}"

    # 캐시 확인
    cached = redis_client.get(cache_key)
    if cached:
        return EmbeddingResponse(
            success=True,
            embedding=json.loads(cached)
        )

    # ... 임베딩 생성 ...

    # 캐시 저장 (1시간 TTL)
    redis_client.setex(cache_key, 3600, json.dumps(embedding))

    return EmbeddingResponse(success=True, embedding=embedding)
```

---

## 비용 비교

| 방식 | 초기 비용 | 월 운영 비용 | 이미지 1000장 처리 비용 |
|------|----------|-------------|----------------------|
| **로컬 서버 (CPU)** | $0 | $0 | $0 |
| **로컬 서버 (GPU)** | GPU 구매 비용 | 전기료 (~$10) | $0 |
| **AWS EC2 (g4dn.xlarge)** | $0 | ~$300/월 | $0 (무제한) |
| **Replicate** | $0 | $0 | ~$0.10 |

**추천**: 월 1000회 이상 사용 시 로컬 서버가 유리

---

## 문제 해결

### CUDA out of memory

```python
# 배치 사이즈 줄이기
BATCH_SIZE = 4  # 기본값: 8

# 또는 모델 양자화 사용
quantization_config = BitsAndBytesConfig(load_in_8bit=True)
```

### Apple Silicon (M1/M2) 성능 저하

```python
# MPS 백엔드 명시적 설정
if torch.backends.mps.is_available():
    device = torch.device("mps")
    model = model.to(device)
```

### 느린 이미지 다운로드

```python
# 타임아웃 설정
response = requests.get(url, timeout=5)

# 또는 비동기 다운로드 사용 (aiohttp)
```

---

## 다음 단계

1. ✅ Python CLIP 서버 구축
2. ✅ Next.js 통합
3. 🔄 성능 테스트 및 최적화
4. 🔄 프로덕션 배포 (PM2/Docker)
5. 🔄 모니터링 설정 (Prometheus/Grafana)

---

## 참고 자료

- [CLIP GitHub](https://github.com/openai/CLIP)
- [Hugging Face CLIP](https://huggingface.co/docs/transformers/model_doc/clip)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [PyTorch Installation](https://pytorch.org/get-started/locally/)
