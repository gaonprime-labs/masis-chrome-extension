#!/usr/bin/env python3
"""
CLIP 서버 테스트 스크립트

사용법:
    python3 test.py
    python3 test.py --endpoint http://localhost:8000
"""

import argparse
import requests
import time
import sys
from typing import List, Dict, Any

# 색상 코드 (터미널)
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def log_info(message: str):
    print(f"{BLUE}[INFO]{RESET} {message}")

def log_success(message: str):
    print(f"{GREEN}[SUCCESS]{RESET} {message}")

def log_error(message: str):
    print(f"{RED}[ERROR]{RESET} {message}")

def log_warning(message: str):
    print(f"{YELLOW}[WARN]{RESET} {message}")


class ClipServerTester:
    def __init__(self, endpoint: str):
        self.endpoint = endpoint.rstrip('/')
        self.session = requests.Session()
        self.passed = 0
        self.failed = 0

    def test_health_check(self) -> bool:
        """Health check 테스트"""
        log_info("테스트 1/5: Health Check")
        try:
            response = self.session.get(f"{self.endpoint}/health", timeout=5)
            if response.status_code == 200:
                data = response.json()
                log_success(f"서버 상태: {data.get('status')}")
                log_info(f"  모델: {data.get('model')}")
                log_info(f"  디바이스: {data.get('device')}")
                self.passed += 1
                return True
            else:
                log_error(f"Health check 실패: {response.status_code}")
                self.failed += 1
                return False
        except Exception as e:
            log_error(f"Health check 실패: {e}")
            self.failed += 1
            return False

    def test_text_embedding(self) -> bool:
        """텍스트 임베딩 생성 테스트"""
        log_info("테스트 2/5: 텍스트 임베딩 생성")
        try:
            payload = {
                "input": "a happy girl with beautiful smile",
                "type": "text"
            }

            start_time = time.time()
            response = self.session.post(
                f"{self.endpoint}/embed",
                json=payload,
                timeout=30
            )
            elapsed = time.time() - start_time

            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('embedding'):
                    embedding_length = len(data['embedding'])
                    log_success(f"텍스트 임베딩 생성 완료")
                    log_info(f"  임베딩 차원: {embedding_length}")
                    log_info(f"  처리 시간: {elapsed:.2f}초")

                    # 임베딩 차원 검증 (CLIP ViT-L/14는 768차원)
                    if embedding_length != 768:
                        log_warning(f"예상과 다른 임베딩 차원 (예상: 768, 실제: {embedding_length})")

                    self.passed += 1
                    return True
                else:
                    log_error(f"임베딩 생성 실패: {data.get('error', 'Unknown error')}")
                    self.failed += 1
                    return False
            else:
                log_error(f"요청 실패: {response.status_code}")
                self.failed += 1
                return False
        except Exception as e:
            log_error(f"텍스트 임베딩 테스트 실패: {e}")
            self.failed += 1
            return False

    def test_image_embedding(self) -> bool:
        """이미지 임베딩 생성 테스트"""
        log_info("테스트 3/5: 이미지 임베딩 생성")
        try:
            # 테스트용 공개 이미지 URL (Unsplash)
            test_image_url = "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400"

            payload = {
                "input": test_image_url,
                "type": "image"
            }

            start_time = time.time()
            response = self.session.post(
                f"{self.endpoint}/embed",
                json=payload,
                timeout=60  # 이미지 다운로드 시간 고려
            )
            elapsed = time.time() - start_time

            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('embedding'):
                    embedding_length = len(data['embedding'])
                    log_success(f"이미지 임베딩 생성 완료")
                    log_info(f"  임베딩 차원: {embedding_length}")
                    log_info(f"  처리 시간: {elapsed:.2f}초")
                    self.passed += 1
                    return True
                else:
                    log_error(f"임베딩 생성 실패: {data.get('error', 'Unknown error')}")
                    self.failed += 1
                    return False
            else:
                log_error(f"요청 실패: {response.status_code}")
                self.failed += 1
                return False
        except Exception as e:
            log_error(f"이미지 임베딩 테스트 실패: {e}")
            self.failed += 1
            return False

    def test_batch_text_embeddings(self) -> bool:
        """배치 텍스트 임베딩 생성 테스트"""
        log_info("테스트 4/5: 배치 텍스트 임베딩 생성")
        try:
            payload = {
                "inputs": [
                    "a happy girl with smile",
                    "a sad boy with tears",
                    "a peaceful landscape"
                ],
                "type": "text"
            }

            start_time = time.time()
            response = self.session.post(
                f"{self.endpoint}/embed/batch",
                json=payload,
                timeout=30
            )
            elapsed = time.time() - start_time

            if response.status_code == 200:
                data = response.json()
                if data.get('success') and data.get('embeddings'):
                    count = len(data['embeddings'])
                    log_success(f"배치 임베딩 생성 완료")
                    log_info(f"  생성 개수: {count}")
                    log_info(f"  총 처리 시간: {elapsed:.2f}초")
                    log_info(f"  평균 처리 시간: {elapsed/count:.2f}초/개")
                    self.passed += 1
                    return True
                else:
                    log_error(f"배치 생성 실패: {data.get('error', 'Unknown error')}")
                    self.failed += 1
                    return False
            else:
                log_error(f"요청 실패: {response.status_code}")
                self.failed += 1
                return False
        except Exception as e:
            log_error(f"배치 텍스트 임베딩 테스트 실패: {e}")
            self.failed += 1
            return False

    def test_similarity_calculation(self) -> bool:
        """시맨틱 유사도 계산 테스트"""
        log_info("테스트 5/5: 시맨틱 유사도 계산")
        try:
            # 두 개의 텍스트 임베딩 생성
            text1 = "a happy smiling girl"
            text2 = "a joyful woman with smile"

            # 첫 번째 임베딩
            response1 = self.session.post(
                f"{self.endpoint}/embed",
                json={"input": text1, "type": "text"},
                timeout=30
            )

            # 두 번째 임베딩
            response2 = self.session.post(
                f"{self.endpoint}/embed",
                json={"input": text2, "type": "text"},
                timeout=30
            )

            if response1.status_code == 200 and response2.status_code == 200:
                data1 = response1.json()
                data2 = response2.json()

                if data1.get('success') and data2.get('success'):
                    emb1 = data1['embedding']
                    emb2 = data2['embedding']

                    # 코사인 유사도 계산
                    similarity = self._cosine_similarity(emb1, emb2)

                    log_success(f"유사도 계산 완료")
                    log_info(f"  텍스트 1: '{text1}'")
                    log_info(f"  텍스트 2: '{text2}'")
                    log_info(f"  코사인 유사도: {similarity:.4f}")

                    # 유사도 검증 (의미적으로 비슷한 텍스트는 0.7 이상)
                    if similarity > 0.7:
                        log_success("유사도가 높습니다 (예상대로)")
                    elif similarity > 0.5:
                        log_warning(f"유사도가 중간입니다 (예상: >0.7, 실제: {similarity:.4f})")
                    else:
                        log_warning(f"유사도가 낮습니다 (예상: >0.7, 실제: {similarity:.4f})")

                    self.passed += 1
                    return True
                else:
                    log_error("임베딩 생성 실패")
                    self.failed += 1
                    return False
            else:
                log_error("요청 실패")
                self.failed += 1
                return False
        except Exception as e:
            log_error(f"유사도 계산 테스트 실패: {e}")
            self.failed += 1
            return False

    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """코사인 유사도 계산"""
        import math

        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        magnitude1 = math.sqrt(sum(a * a for a in vec1))
        magnitude2 = math.sqrt(sum(b * b for b in vec2))

        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0

        return dot_product / (magnitude1 * magnitude2)

    def run_all_tests(self):
        """모든 테스트 실행"""
        print("\n" + "="*60)
        print(f"{BLUE}CLIP 서버 테스트 시작{RESET}")
        print(f"엔드포인트: {self.endpoint}")
        print("="*60 + "\n")

        # 순차적으로 모든 테스트 실행
        self.test_health_check()
        print()

        self.test_text_embedding()
        print()

        self.test_image_embedding()
        print()

        self.test_batch_text_embeddings()
        print()

        self.test_similarity_calculation()
        print()

        # 결과 출력
        print("="*60)
        total = self.passed + self.failed
        if self.failed == 0:
            log_success(f"모든 테스트 통과! ({self.passed}/{total})")
            print("="*60)
            return 0
        else:
            log_error(f"일부 테스트 실패: {self.failed}/{total}")
            log_info(f"통과: {self.passed}/{total}")
            print("="*60)
            return 1


def main():
    parser = argparse.ArgumentParser(description='CLIP 서버 테스트')
    parser.add_argument(
        '--endpoint',
        type=str,
        default='http://localhost:8000',
        help='CLIP 서버 엔드포인트 (기본값: http://localhost:8000)'
    )

    args = parser.parse_args()

    tester = ClipServerTester(args.endpoint)
    exit_code = tester.run_all_tests()
    sys.exit(exit_code)


if __name__ == '__main__':
    main()
