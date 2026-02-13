# clip-server/server.py
"""
CLIP Embedding Server
완전 무료 로컬 CLIP 임베딩 서버

Features:
- Text/Image 임베딩 생성
- 배치 처리 지원
- GPU/MPS/CPU 자동 감지
- LRU 캐싱
- CORS 지원
"""

import torch
from transformers import CLIPProcessor, CLIPModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from PIL import Image
import requests
from io import BytesIO
from typing import List, Literal, Optional
from functools import lru_cache
import logging
import time

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI 앱 초기화
app = FastAPI(
    title="CLIP Embedding Server",
    description="로컬 CLIP 임베딩 서버 (완전 무료)",
    version="1.0.0"
)

# CORS 설정 (Next.js에서 접근 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://ark.gaonprime.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== 디바이스 설정 =====
def get_device():
    """최적의 디바이스 선택 (GPU > MPS > CPU)"""
    if torch.cuda.is_available():
        device = "cuda"
        gpu_name = torch.cuda.get_device_name(0)
        logger.info(f"🚀 Using NVIDIA GPU: {gpu_name}")
    elif torch.backends.mps.is_available():
        device = "mps"
        logger.info("🚀 Using Apple Silicon GPU (MPS)")
    else:
        device = "cpu"
        logger.warning("⚠️  Using CPU (느린 성능)")
    return device

device = get_device()

# ===== CLIP 모델 로드 =====
MODEL_NAME = "openai/clip-vit-large-patch14"  # ViT-L/14
logger.info(f"📦 Loading CLIP model: {MODEL_NAME}")

try:
    model = CLIPModel.from_pretrained(MODEL_NAME).to(device)
    processor = CLIPProcessor.from_pretrained(MODEL_NAME)
    model.eval()  # 평가 모드
    logger.info("✅ CLIP model loaded successfully")
except Exception as e:
    logger.error(f"❌ Failed to load CLIP model: {e}")
    raise

# ===== 요청/응답 스키마 =====
class EmbeddingRequest(BaseModel):
    """단일 임베딩 요청"""
    input: str = Field(..., description="텍스트 또는 이미지 URL")
    type: Literal["text", "image"] = Field(..., description="임베딩 타입")

class BatchEmbeddingRequest(BaseModel):
    """배치 임베딩 요청"""
    inputs: List[str] = Field(..., description="텍스트 또는 이미지 URL 목록")
    type: Literal["text", "image"] = Field(..., description="임베딩 타입")

class EmbeddingResponse(BaseModel):
    """단일 임베딩 응답"""
    success: bool
    embedding: Optional[List[float]] = None
    error: Optional[str] = None
    processing_time: Optional[float] = None

class BatchEmbeddingResponse(BaseModel):
    """배치 임베딩 응답"""
    success: bool
    embeddings: Optional[List[List[float]]] = None
    error: Optional[str] = None
    processing_time: Optional[float] = None

class HealthResponse(BaseModel):
    """헬스체크 응답"""
    status: str
    device: str
    model: str
    torch_version: str

# ===== 헬퍼 함수 =====
@lru_cache(maxsize=100)
def download_image(url: str) -> Image.Image:
    """이미지 다운로드 (LRU 캐싱)"""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        image = Image.open(BytesIO(response.content)).convert("RGB")
        return image
    except Exception as e:
        logger.error(f"❌ Image download failed: {url} - {e}")
        raise

def create_text_embedding(text: str) -> List[float]:
    """텍스트 임베딩 생성"""
    # CLIP 최대 토큰 길이는 77개 (truncation 필요)
    inputs = processor(text=[text], return_tensors="pt", padding=True, truncation=True, max_length=77).to(device)

    with torch.no_grad():
        text_features = model.get_text_features(**inputs)
        # L2 정규화
        text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)

    return text_features[0].cpu().numpy().tolist()

def create_image_embedding(image_url: str) -> List[float]:
    """이미지 임베딩 생성"""
    # 이미지 다운로드 (캐싱)
    image = download_image(image_url)

    # 이미지 임베딩
    inputs = processor(images=image, return_tensors="pt").to(device)

    with torch.no_grad():
        image_features = model.get_image_features(**inputs)
        # L2 정규화
        image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)

    return image_features[0].cpu().numpy().tolist()

def create_batch_text_embeddings(texts: List[str]) -> List[List[float]]:
    """배치 텍스트 임베딩 생성"""
    inputs = processor(text=texts, return_tensors="pt", padding=True, truncation=True, max_length=77).to(device)

    with torch.no_grad():
        text_features = model.get_text_features(**inputs)
        text_features = text_features / text_features.norm(p=2, dim=-1, keepdim=True)

    return text_features.cpu().numpy().tolist()

def create_batch_image_embeddings(image_urls: List[str]) -> List[List[float]]:
    """배치 이미지 임베딩 생성"""
    # 배치 이미지 다운로드
    images = [download_image(url) for url in image_urls]

    # 배치 이미지 임베딩
    inputs = processor(images=images, return_tensors="pt").to(device)

    with torch.no_grad():
        image_features = model.get_image_features(**inputs)
        image_features = image_features / image_features.norm(p=2, dim=-1, keepdim=True)

    return image_features.cpu().numpy().tolist()

# ===== API 엔드포인트 =====
@app.get("/", response_model=dict)
async def root():
    """루트 엔드포인트"""
    return {
        "message": "CLIP Embedding Server",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "embed": "/embed",
            "batch": "/embed/batch"
        }
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """헬스체크"""
    return HealthResponse(
        status="healthy",
        device=device,
        model=MODEL_NAME,
        torch_version=torch.__version__
    )

@app.post("/embed", response_model=EmbeddingResponse)
async def create_embedding(request: EmbeddingRequest):
    """단일 임베딩 생성"""
    start_time = time.time()

    try:
        logger.info(f"🔍 Processing {request.type} embedding request")

        if request.type == "text":
            embedding = create_text_embedding(request.input)
        elif request.type == "image":
            embedding = create_image_embedding(request.input)
        else:
            raise HTTPException(status_code=400, detail="Invalid type")

        processing_time = time.time() - start_time
        logger.info(f"✅ Embedding created in {processing_time:.2f}s")

        return EmbeddingResponse(
            success=True,
            embedding=embedding,
            processing_time=processing_time
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

@app.post("/embed/batch", response_model=BatchEmbeddingResponse)
async def create_batch_embeddings(request: BatchEmbeddingRequest):
    """배치 임베딩 생성 (성능 최적화)"""
    start_time = time.time()

    try:
        logger.info(f"🔍 Processing batch of {len(request.inputs)} {request.type} embeddings")

        if request.type == "text":
            embeddings = create_batch_text_embeddings(request.inputs)
        elif request.type == "image":
            embeddings = create_batch_image_embeddings(request.inputs)
        else:
            raise HTTPException(status_code=400, detail="Invalid type")

        processing_time = time.time() - start_time
        logger.info(f"✅ Batch embeddings created in {processing_time:.2f}s")

        return BatchEmbeddingResponse(
            success=True,
            embeddings=embeddings,
            processing_time=processing_time
        )

    except Exception as e:
        logger.error(f"❌ Batch embedding failed: {e}")
        return BatchEmbeddingResponse(
            success=False,
            error=f"Batch embedding generation failed: {str(e)}"
        )

# ===== 메인 실행 =====
if __name__ == "__main__":
    import uvicorn

    logger.info("🚀 Starting CLIP Embedding Server...")

    uvicorn.run(
        app,
        host="0.0.0.0",  # 외부 접근 허용
        port=8000,
        log_level="info"
    )
