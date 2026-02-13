// src/lib/clip/similarity.ts
// 코사인 유사도 계산 (순수 함수)

import type { Embedding } from './types';

/**
 * 벡터의 크기 (L2 Norm) 계산
 *
 * @param vector - 입력 벡터
 * @returns 벡터 크기
 *
 * @example
 * computeMagnitude([3, 4]) // → 5
 */
export function computeMagnitude(vector: Embedding): number {
  return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
}

/**
 * 두 벡터의 내적 (Dot Product) 계산
 *
 * @param vec1 - 첫 번째 벡터
 * @param vec2 - 두 번째 벡터
 * @returns 내적 값
 * @throws {Error} 벡터 차원이 다를 경우
 *
 * @example
 * computeDotProduct([1, 2], [3, 4]) // → 11
 */
export function computeDotProduct(vec1: Embedding, vec2: Embedding): number {
  if (vec1.length !== vec2.length) {
    throw new Error(
      `Vector dimensions must match: ${vec1.length} vs ${vec2.length}`
    );
  }

  return vec1.reduce((sum, val, idx) => sum + val * vec2[idx], 0);
}

/**
 * 코사인 유사도 계산
 *
 * 두 벡터 간의 방향 유사도를 측정합니다.
 * 결과값은 -1 ~ 1 사이이며, 1에 가까울수록 유사합니다.
 *
 * Formula: similarity = (A · B) / (||A|| * ||B||)
 *
 * @param embedding1 - 첫 번째 임베딩
 * @param embedding2 - 두 번째 임베딩
 * @returns 코사인 유사도 (0-1, 음수는 0으로 클램핑)
 * @throws {Error} 벡터 차원이 다를 경우
 *
 * @example
 * const textEmb = [0.1, 0.2, 0.3, ...];
 * const imageEmb = [0.15, 0.22, 0.28, ...];
 * const similarity = computeCosineSimilarity(textEmb, imageEmb);
 * // → 0.95 (매우 유사)
 */
export function computeCosineSimilarity(
  embedding1: Embedding,
  embedding2: Embedding
): number {
  // 차원 검증
  if (embedding1.length !== embedding2.length) {
    throw new Error(
      `Embedding dimensions must match: ${embedding1.length} vs ${embedding2.length}`
    );
  }

  // 영벡터 검증
  const mag1 = computeMagnitude(embedding1);
  const mag2 = computeMagnitude(embedding2);

  if (mag1 === 0 || mag2 === 0) {
    console.warn('[CLIP Similarity] Zero vector detected, returning 0');
    return 0;
  }

  // 코사인 유사도 계산
  const dotProduct = computeDotProduct(embedding1, embedding2);
  const similarity = dotProduct / (mag1 * mag2);

  // 음수 값은 0으로 클램핑 (방향이 완전 반대인 경우)
  return Math.max(0, similarity);
}

/**
 * 여러 임베딩과의 유사도를 일괄 계산
 *
 * @param queryEmbedding - 쿼리 임베딩 (대화 요약)
 * @param candidateEmbeddings - 후보 임베딩 배열 (이미지들)
 * @returns 유사도 점수 배열 (같은 인덱스 순서)
 *
 * @example
 * const scores = computeBatchSimilarity(textEmb, [img1Emb, img2Emb, img3Emb]);
 * // → [0.9, 0.7, 0.5]
 */
export function computeBatchSimilarity(
  queryEmbedding: Embedding,
  candidateEmbeddings: Embedding[]
): number[] {
  return candidateEmbeddings.map((candidateEmb) =>
    computeCosineSimilarity(queryEmbedding, candidateEmb)
  );
}

/**
 * 유사도 기반 정렬
 *
 * @param items - 정렬할 아이템 배열
 * @param scores - 각 아이템의 유사도 점수
 * @returns 유사도 높은 순으로 정렬된 { item, score } 배열
 *
 * @example
 * const sorted = sortBySimilarity(images, [0.5, 0.9, 0.7]);
 * // → [{ item: images[1], score: 0.9 }, { item: images[2], score: 0.7 }, ...]
 */
export function sortBySimilarity<T>(
  items: T[],
  scores: number[]
): Array<{ item: T; score: number }> {
  if (items.length !== scores.length) {
    throw new Error('Items and scores arrays must have the same length');
  }

  return items
    .map((item, idx) => ({ item, score: scores[idx] }))
    .sort((a, b) => b.score - a.score); // 내림차순 정렬
}
