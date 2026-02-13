// background/cache.js - LRU 캐시 구현

/**
 * LRU (Least Recently Used) 캐시
 * 최근에 사용된 항목을 유지하고, 용량 초과 시 가장 오래된 항목을 제거
 */
export class LRUCache {
  /**
   * @param {number} capacity - 최대 저장 용량
   */
  constructor(capacity = 100) {
    this.capacity = capacity;
    this.cache = new Map();
  }

  /**
   * 캐시에서 값 가져오기
   * @param {string} key - 캐시 키
   * @returns {any|null} 캐시된 값 또는 null
   */
  get(key) {
    if (!this.cache.has(key)) return null;
    const value = this.cache.get(key);
    // 최근 사용으로 이동 (Map은 삽입 순서 유지)
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  /**
   * 캐시에 값 저장
   * @param {string} key - 캐시 키
   * @param {any} value - 저장할 값
   */
  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      // 가장 오래된 항목 제거 (Map의 첫 번째 키)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  /**
   * 캐시 전체 삭제
   */
  clear() {
    this.cache.clear();
  }

  /**
   * 현재 캐시 크기
   * @returns {number}
   */
  get size() {
    return this.cache.size;
  }

  /**
   * 특정 키가 존재하는지 확인
   * @param {string} key - 캐시 키
   * @returns {boolean}
   */
  has(key) {
    return this.cache.has(key);
  }

  /**
   * 특정 키 삭제
   * @param {string} key - 캐시 키
   * @returns {boolean} 삭제 성공 여부
   */
  delete(key) {
    return this.cache.delete(key);
  }
}
