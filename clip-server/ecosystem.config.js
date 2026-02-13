// PM2 설정 파일 - CLIP 서버 프로세스 관리
module.exports = {
  apps: [
    {
      name: 'clip-server',
      script: 'server.py',
      interpreter: 'python3',
      cwd: '/Users/MooSaeng/coding/gaon/character-generator/clip-server',

      // 인스턴스 수 (CPU 코어 수만큼)
      instances: 1,
      exec_mode: 'fork',

      // 자동 재시작
      autorestart: true,
      watch: false,
      max_memory_restart: '2G',

      // 환경 변수
      env: {
        PORT: 8000,
        NODE_ENV: 'production',
        PYTHONUNBUFFERED: '1'
      },

      // 로그 설정
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,

      // 재시작 정책
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 4000
    }
  ]
};
