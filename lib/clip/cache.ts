// src/lib/clip/cache.ts
// 임베딩 결과 캐싱 (성능 최적화)

import type { Embedding, CacheKey, CacheEntry } from './types';

/**
 * LRU 캐시 옵션
 */
interface CacheOptions {
  /** 최대 캐시 크기 */
  maxSize?: number;
  /** 기본 TTL (초) */
  defaultTTL?: number;
}

/**
 * 캐시 키 생성
 *
 * @param key - 캐시 키 정보
 * @returns 문자열 캐시 키
 */
function createCacheKey(key: CacheKey): string {
  return `${key.type}:${key.value}`;
}

/**
 * 임베딩 캐시 클래스 (LRU)
 *
 * 이미지 URL → 임베딩 벡터 매핑을 캐시하여
 * 동일한 이미지에 대한 반복 API 호출을 방지합니다.
 *
 * @example
 * const cache = createEmbeddingCache({ maxSize: 1000 });
 * cache.set({ type: 'image', value: 'https://...' }, [0.1, 0.2, ...]);
 * const emb = cache.get({ type: 'image', value: 'https://...' });
 */
export class EmbeddingCache {
  private cache: Map<string, CacheEntry>;
  private readonly maxSize: number;
  private readonly defaultTTL: number;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 3600; // 1시간
  }

  /**
   * 캐시에서 임베딩 조회
   *
   * @param key - 캐시 키
   * @returns 임베딩 벡터 (없으면 null)
   */
  get(key: CacheKey): Embedding | null {
    const cacheKey = createCacheKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return null;
    }

    // TTL 확인
    const now = Date.now();
    const age = (now - entry.createdAt) / 1000; // 초 단위

    if (age > entry.ttl) {
      // 만료됨
      this.cache.delete(cacheKey);
      return null;
    }

    // LRU: 최근 사용한 항목을 맨 뒤로 이동
    this.cache.delete(cacheKey);
    this.cache.set(cacheKey, entry);

    return entry.embedding;
  }

  /**
   * 캐시에 임베딩 저장
   *
   * @param key - 캐시 키
   * @param embedding - 임베딩 벡터
   * @param ttl - TTL (초, 기본값: defaultTTL)
   */
  set(key: CacheKey, embedding: Embedding, ttl?: number): void {
    const cacheKey = createCacheKey(key);

    // LRU: 최대 크기 초과 시 가장 오래된 항목 제거
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const entry: CacheEntry = {
      embedding,
      createdAt: Date.now(),
      ttl: ttl ?? this.defaultTTL,
    };

    this.cache.set(cacheKey, entry);
  }

  /**
   * 특정 키 삭제
   *
   * @param key - 캐시 키
   * @returns 삭제 성공 여부
   */
  delete(key: CacheKey): boolean {
    const cacheKey = createCacheKey(key);
    return this.cache.delete(cacheKey);
  }

  /**
   * 캐시 전체 초기화
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 현재 캐시 크기
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 캐시 통계
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate?: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }
}

/**
 * 전역 임베딩 캐시 인스턴스
 */
let globalCache: EmbeddingCache | null = null;

/**
 * 임베딩 캐시 생성 (싱글톤)
 *
 * @param options - 캐시 옵션
 * @returns 캐시 인스턴스
 */
export function createEmbeddingCache(
  options?: CacheOptions
): EmbeddingCache {
  if (!globalCache) {
    globalCache = new EmbeddingCache(options);
  }
  return globalCache;
}

/**
 * 전역 캐시 초기화 (테스트용)
 */
export function resetGlobalCache(): void {
  globalCache = null;
}
