// src/lib/clip/filter.ts
// CLIP 기반 이미지 필터링 오케스트레이션

import type {
  ClipConfig,
  Embedding,
  FilterOptions,
  ImageSimilarity,
} from './types';
import { createClipClient } from './client';
import { createEmbeddingCache } from './cache';
import { computeCosineSimilarity, sortBySimilarity } from './similarity';

/**
 * CLIP 필터링 결과
 */
export interface ClipFilterResult {
  success: boolean;
  topImages: ImageSimilarity[];
  totalProcessed: number;
  cacheHits: number;
  error?: string;
}

/**
 * CLIP 기반 이미지 필터링 오케스트레이터
 *
 * 역할:
 * 1. 텍스트/이미지 임베딩 생성 (캐싱 지원)
 * 2. 코사인 유사도 계산
 * 3. Top-K 이미지 선택
 */
export class ClipFilter {
  private readonly client: ReturnType<typeof createClipClient>;
  private readonly cache: ReturnType<typeof createEmbeddingCache>;
  private readonly config: ClipConfig;

  constructor(
    config: ClipConfig,
    provider: 'replicate' | 'openai' = 'replicate'
  ) {
    this.config = config;
    this.client = createClipClient(config, provider);
    this.cache = createEmbeddingCache({
      maxSize: 1000,
      defaultTTL: 3600, // 1시간
    });
  }

  /**
   * 텍스트 임베딩 생성 (캐싱 지원)
   *
   * @param text - 임베딩할 텍스트
   * @returns 임베딩 벡터 또는 null
   */
  private async getTextEmbedding(text: string): Promise<Embedding | null> {
    // 캐시 확인
    const cached = this.cache.get({ type: 'text', value: text });
    if (cached) {
      console.log('[CLIP Filter] 📦 Text embedding cache HIT');
      return cached;
    }

    // API 호출
    console.log('[CLIP Filter] 🌐 Fetching text embedding from API...');
    const response = await this.client.getEmbedding({
      input: text,
      type: 'text',
    });

    if (!response.success || !response.embedding) {
      console.error('[CLIP Filter] ❌ Text embedding failed:', response.error);
      return null;
    }

    // 캐시 저장
    this.cache.set({ type: 'text', value: text }, response.embedding);
    return response.embedding;
  }

  /**
   * 이미지 임베딩 생성 (캐싱 지원)
   *
   * @param imageUrl - 이미지 URL
   * @returns 임베딩 벡터 또는 null
   */
  private async getImageEmbedding(imageUrl: string): Promise<Embedding | null> {
    // 캐시 확인
    const cached = this.cache.get({ type: 'image', value: imageUrl });
    if (cached) {
      return cached;
    }

    // API 호출
    const response = await this.client.getEmbedding({
      input: imageUrl,
      type: 'image',
    });

    if (!response.success || !response.embedding) {
      console.warn(
        `[CLIP Filter] ⚠️  Image embedding failed for ${imageUrl}:`,
        response.error
      );
      return null;
    }

    // 캐시 저장
    this.cache.set({ type: 'image', value: imageUrl }, response.embedding);
    return response.embedding;
  }

  /**
   * 이미지 목록을 시맨틱 유사도 기준으로 필터링
   *
   * @param sceneText - 씬 설명 텍스트 (대화 요약)
   * @param images - 필터링할 이미지 목록
   * @param options - 필터링 옵션
   * @returns CLIP 필터링 결과
   */
  async filterImagesBySimilarity(
    sceneText: string,
    images: any[],
    options: FilterOptions = {}
  ): Promise<ClipFilterResult> {
    const { topK = 10, minSimilarity = 0.0, useCache = true } = options;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[CLIP Filter] 🚀 Starting semantic similarity filtering');
    console.log(`[CLIP Filter] 📝 Scene text: "${sceneText}"`);
    console.log(`[CLIP Filter] 🖼️  Total images: ${images.length}`);
    console.log(`[CLIP Filter] 🎯 Parameters: topK=${topK}, minSimilarity=${minSimilarity}`);

    try {
      // 1. 텍스트 임베딩 생성
      const textEmbedding = await this.getTextEmbedding(sceneText);
      if (!textEmbedding) {
        return {
          success: false,
          topImages: [],
          totalProcessed: 0,
          cacheHits: 0,
          error: 'Failed to generate text embedding',
        };
      }

      // 2. 각 이미지의 임베딩 생성 및 유사도 계산
      const similarities: ImageSimilarity[] = [];
      let cacheHits = 0;

      for (const image of images) {
        const imageUrl = image.imageUrl || image.thumbnail;
        if (!imageUrl) {
          console.warn('[CLIP Filter] ⚠️  No image URL found, skipping:', image._id);
          continue;
        }

        // 이미지 임베딩 생성
        const imageEmbedding = await this.getImageEmbedding(imageUrl);
        if (!imageEmbedding) {
          continue; // 실패한 이미지는 건너뛰기
        }

        // 캐시 히트 여부 확인
        if (this.cache.get({ type: 'image', value: imageUrl })) {
          cacheHits++;
        }

        // 코사인 유사도 계산
        const similarity = computeCosineSimilarity(textEmbedding, imageEmbedding);

        // 최소 유사도 필터링
        if (similarity >= minSimilarity) {
          similarities.push({
            imageId: image._id,
            similarity,
            image,
          });
        }
      }

      // 3. 유사도 기준 정렬 및 Top-K 선택
      const sorted = sortBySimilarity(
        similarities.map((s) => s.image),
        similarities.map((s) => s.similarity)
      );

      const topImages = sorted
        .slice(0, topK)
        .map(({ item, score }) => ({
          imageId: item._id,
          similarity: score,
          image: item,
        }));

      console.log(`[CLIP Filter] ✅ Processed ${similarities.length} images`);
      console.log(`[CLIP Filter] 📦 Cache hits: ${cacheHits}/${images.length}`);
      console.log(`[CLIP Filter] 🏆 Top-${topK} similarity scores:`);
      topImages.forEach((img, idx) => {
        console.log(
          `[CLIP Filter]    ${idx + 1}. Score: ${img.similarity.toFixed(4)}`
        );
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      return {
        success: true,
        topImages,
        totalProcessed: similarities.length,
        cacheHits,
      };
    } catch (error) {
      console.error('[CLIP Filter] ❌ Filtering failed:', error);
      return {
        success: false,
        topImages: [],
        totalProcessed: 0,
        cacheHits: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 캐시 통계 조회
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * 캐시 초기화
   */
  clearCache() {
    this.cache.clear();
  }
}

/**
 * 편의 함수: CLIP 필터링 수행
 *
 * @param config - CLIP 설정
 * @param sceneText - 씬 설명 텍스트
 * @param images - 이미지 목록
 * @param options - 필터링 옵션
 * @returns 필터링 결과
 */
export async function filterImagesBySimilarity(
  config: ClipConfig,
  sceneText: string,
  images: any[],
  options?: FilterOptions
): Promise<ClipFilterResult> {
  const filter = new ClipFilter(config, 'replicate');
  return filter.filterImagesBySimilarity(sceneText, images, options);
}
