import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { handleCoach } from './api/_coach'

// HTTPS=1 일 때만 자체서명 https 활성화 (폰 Safari에서 실제 GPS 테스트용).
// 기본(npm run dev)은 http 유지 — localhost·미리보기 도구 호환.
const https = process.env.HTTPS === '1'

// 로컬 개발용 /api/coach — Vercel 함수와 동일한 코어(handleCoach)를 재사용.
// 프로덕션에선 api/coach.ts(Vercel 서버리스)가 처리한다.
function devCoachApi(apiKey?: string): Plugin {
  return {
    name: 'breq-dev-coach-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/coach', (req, res, next) => {
        if (req.method !== 'POST') return next()
        let raw = ''
        req.on('data', (c) => (raw += c))
        req.on('end', async () => {
          let body
          try {
            body = JSON.parse(raw || '{}')
          } catch {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'invalid_json' }))
            return
          }
          const { status, json } = await handleCoach(body, apiKey)
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(json))
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // .env.local 등에서 ANTHROPIC_API_KEY 로드(접두사 '' = 모든 키). 서버 전용 — 클라엔 노출 안 됨.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      tailwindcss(),
      devCoachApi(env.ANTHROPIC_API_KEY),
      ...(https ? [basicSsl()] : []),
    ],
  }
})
