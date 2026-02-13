// src/lib/clip/client.ts
// CLIP API 클라이언트 (Replicate 또는 HuggingFace)

import type {
  ClipConfig,
  EmbeddingRequest,
  EmbeddingResponse,
  Embedding,
} from './types';

/**
 * CLIP API 클라이언트 인터페이스 (DIP)
 */
export interface IClipClient {
  getEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>;
}

/**
 * Replicate CLIP 클라이언트
 *
 * Replicate의 CLIP 모델을 사용하여 임베딩 생성
 * https://replicate.com/openai/clip-vit-large-patch14
 */
export class ReplicateClipClient implements IClipClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeout: number;

  constructor(config: ClipConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'ViT-L/14';
    this.timeout = config.timeout || 30000; // 30초
  }

  /**
   * 임베딩 생성
   *
   * @param request - 임베딩 요청
   * @returns 임베딩 응답
   */
  async getEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Token ${this.apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          version: this.getModelVersion(),
          input: {
            [request.type === 'text' ? 'text' : 'image']: request.input,
          },
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `Replicate API error: ${response.status} - ${error}`,
        };
      }

      const data = await response.json();

      // Replicate는 비동기 처리이므로 결과 폴링 필요
      const embedding = await this.pollForResult(data.id);

      return {
        success: true,
        embedding,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `CLIP embedding failed: ${message}`,
      };
    }
  }

  /**
   * 모델 버전 ID 가져오기
   */
  private getModelVersion(): string {
    // 실제 Replicate 모델 버전 ID
    // ViT-L/14: 최신 버전 사용 (실제 배포 시 업데이트 필요)
    return 'b8caf5e1240c2ac6e9c3232b0fc2a27f8e13c4f60f59d4f7f6199a77f6c1f49';
  }

  /**
   * Replicate 비동기 결과 폴링
   *
   * @param predictionId - 예측 ID
   * @returns 임베딩 벡터
   */
  private async pollForResult(predictionId: string): Promise<Embedding> {
    const maxAttempts = 30; // 최대 30초 대기
    const pollInterval = 1000; // 1초마다 폴링

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            Authorization: `Token ${this.apiKey}`,
          },
        }
      );

      const data = await response.json();

      if (data.status === 'succeeded') {
        return data.output as Embedding;
      }

      if (data.status === 'failed') {
        throw new Error(`Replicate prediction failed: ${data.error}`);
      }

      // 대기
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error('Replicate prediction timeout');
  }
}

/**
 * OpenAI CLIP 클라이언트 (대안)
 *
 * OpenAI API를 통해 CLIP 임베딩 생성
 */
export class OpenAIClipClient implements IClipClient {
  private readonly apiKey: string;
  private readonly timeout: number;

  constructor(config: ClipConfig) {
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
  }

  async getEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    try {
      // OpenAI는 현재 CLIP 임베딩을 직접 제공하지 않음
      // 대안: text-embedding-3-large 사용 (유사한 semantic embedding)
      if (request.type === 'image') {
        return {
          success: false,
          error: 'OpenAI does not support image embeddings via API',
        };
      }

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'text-embedding-3-large',
          input: request.input,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: `OpenAI API error: ${response.status} - ${error}`,
        };
      }

      const data = await response.json();
      const embedding = data.data[0].embedding as Embedding;

      return {
        success: true,
        embedding,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        error: `OpenAI embedding failed: ${message}`,
      };
    }
  }
}

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

/**
 * CLIP 클라이언트 팩토리
 *
 * @param config - CLIP 설정
 * @param provider - 사용할 제공자 ('local' | 'replicate' | 'openai')
 * @returns CLIP 클라이언트 인스턴스
 */
export function createClipClient(
  config: ClipConfig,
  provider: 'local' | 'replicate' | 'openai' = 'local'
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
