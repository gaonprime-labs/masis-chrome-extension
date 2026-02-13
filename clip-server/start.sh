#!/bin/bash

# CLIP 서버 시작 스크립트
# 사용법: ./start.sh [mode]
# mode: dev (개발), prod (프로덕션), docker (Docker), docker-gpu (Docker GPU)

set -e  # 에러 발생 시 즉시 종료

# 색상 코드
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 로그 함수
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Python 버전 확인
check_python() {
    if ! command -v python3 &> /dev/null; then
        log_error "Python 3가 설치되지 않았습니다."
        exit 1
    fi

    PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    log_info "Python 버전: $PYTHON_VERSION"
}

# 가상환경 확인 및 생성
setup_venv() {
    if [ ! -d "venv" ]; then
        log_info "가상환경 생성 중..."
        python3 -m venv venv
    fi

    log_info "가상환경 활성화 중..."
    source venv/bin/activate
}

# 의존성 설치
install_dependencies() {
    log_info "의존성 설치 중..."
    pip install --upgrade pip
    pip install -r requirements.txt
}

# 로그 디렉토리 생성
create_log_dir() {
    if [ ! -d "logs" ]; then
        log_info "로그 디렉토리 생성 중..."
        mkdir -p logs
    fi
}

# 개발 모드 실행
start_dev() {
    log_info "개발 모드로 서버 시작..."
    check_python
    setup_venv
    install_dependencies
    create_log_dir

    log_info "서버 실행 중 (http://localhost:8000)"
    python3 server.py
}

# 프로덕션 모드 실행 (PM2)
start_prod() {
    log_info "프로덕션 모드로 서버 시작 (PM2)..."

    # PM2 설치 확인
    if ! command -v pm2 &> /dev/null; then
        log_error "PM2가 설치되지 않았습니다."
        log_info "설치 명령: npm install -g pm2"
        exit 1
    fi

    check_python
    setup_venv
    install_dependencies
    create_log_dir

    # PM2로 시작
    pm2 start ecosystem.config.js
    pm2 save

    log_info "서버가 PM2로 시작되었습니다."
    log_info "상태 확인: pm2 status"
    log_info "로그 확인: pm2 logs clip-server"
}

# Docker 모드 실행
start_docker() {
    log_info "Docker 컨테이너 시작 (CPU)..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker가 설치되지 않았습니다."
        exit 1
    fi

    # 이미지 빌드
    log_info "Docker 이미지 빌드 중..."
    docker build -t clip-server .

    # 컨테이너 실행
    log_info "컨테이너 실행 중..."
    docker run -d \
        --name clip-server \
        -p 8000:8000 \
        --restart unless-stopped \
        clip-server

    log_info "서버가 Docker 컨테이너로 시작되었습니다."
    log_info "상태 확인: docker ps | grep clip-server"
    log_info "로그 확인: docker logs -f clip-server"
}

# Docker GPU 모드 실행
start_docker_gpu() {
    log_info "Docker 컨테이너 시작 (GPU)..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker가 설치되지 않았습니다."
        exit 1
    fi

    # NVIDIA Docker 확인
    if ! docker run --rm --gpus all nvidia/cuda:11.8.0-base-ubuntu22.04 nvidia-smi &> /dev/null; then
        log_error "NVIDIA Docker가 설치되지 않았거나 GPU를 사용할 수 없습니다."
        log_info "NVIDIA Docker 설치: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html"
        exit 1
    fi

    # 이미지 빌드
    log_info "Docker 이미지 빌드 중 (GPU)..."
    docker build -f Dockerfile.gpu -t clip-server-gpu .

    # 컨테이너 실행
    log_info "컨테이너 실행 중 (GPU 사용)..."
    docker run -d \
        --name clip-server \
        --gpus all \
        -p 8000:8000 \
        --restart unless-stopped \
        clip-server-gpu

    log_info "서버가 Docker 컨테이너로 시작되었습니다 (GPU 사용)."
    log_info "상태 확인: docker ps | grep clip-server"
    log_info "로그 확인: docker logs -f clip-server"
}

# 서버 중지
stop_server() {
    log_info "서버 중지 중..."

    # PM2 확인
    if command -v pm2 &> /dev/null && pm2 list | grep -q "clip-server"; then
        pm2 stop clip-server
        pm2 delete clip-server
        log_info "PM2 서버 중지됨"
    fi

    # Docker 확인
    if command -v docker &> /dev/null && docker ps | grep -q "clip-server"; then
        docker stop clip-server
        docker rm clip-server
        log_info "Docker 컨테이너 중지됨"
    fi
}

# 메인 로직
MODE=${1:-dev}

case $MODE in
    dev)
        start_dev
        ;;
    prod)
        start_prod
        ;;
    docker)
        start_docker
        ;;
    docker-gpu)
        start_docker_gpu
        ;;
    stop)
        stop_server
        ;;
    *)
        log_error "알 수 없는 모드: $MODE"
        echo "사용법: ./start.sh [mode]"
        echo "mode:"
        echo "  dev        - 개발 모드 (기본값)"
        echo "  prod       - 프로덕션 모드 (PM2)"
        echo "  docker     - Docker 모드 (CPU)"
        echo "  docker-gpu - Docker 모드 (GPU)"
        echo "  stop       - 서버 중지"
        exit 1
        ;;
esac
