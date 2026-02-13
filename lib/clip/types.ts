// src/lib/clip/types.ts
// CLIP 임베딩 시스템 타입 정의

/**
 * CLIP 임베딩 벡터
 * 일반적으로 512차원 또는 768차원
 */
export type Embedding = number[];

/**
 * CLIP API 설정
 */
export interface ClipConfig {
  /** API 키 (Replicate, HuggingFace 등) */
  apiKey: string;
  /** 사용할 CLIP 모델 */
  model?: 'ViT-B/32' | 'ViT-L/14' | 'ViT-H/14';
  /** API 엔드포인트 */
  endpoint?: string;
  /** 타임아웃 (ms) */
  timeout?: number;
}

/**
 * 임베딩 요청
 */
export interface EmbeddingRequest {
  /** 텍스트 또는 이미지 URL */
  input: string;
  /** 입력 타입 */
  type: 'text' | 'image';
}

/**
 * 임베딩 응답
 */
export interface EmbeddingResponse {
  /** 성공 여부 */
  success: boolean;
  /** 임베딩 벡터 */
  embedding?: Embedding;
  /** 에러 메시지 */
  error?: string;
}

/**
 * 이미지 유사도 결과
 */
export interface ImageSimilarity {
  /** 이미지 ID */
  imageId: string;
  /** 유사도 점수 (0-1) */
  similarity: number;
  /** 원본 이미지 데이터 */
  image: any;
}

/**
 * 필터링 옵션
 */
export interface FilterOptions {
  /** 반환할 최대 이미지 수 */
  topK?: number;
  /** 최소 유사도 임계값 (0-1) */
  minSimilarity?: number;
  /** 캐싱 사용 여부 */
  useCache?: boolean;
}

/**
 * 캐시 키
 */
export interface CacheKey {
  /** 입력 타입 */
  type: 'text' | 'image';
  /** 입력 값 (텍스트 또는 이미지 URL) */
  value: string;
}

/**
 * 캐시 엔트리
 */
export interface CacheEntry {
  /** 임베딩 벡터 */
  embedding: Embedding;
  /** 생성 시간 */
  createdAt: number;
  /** TTL (초) */
  ttl: number;
}
