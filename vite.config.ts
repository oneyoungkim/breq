import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

// HTTPS=1 일 때만 자체서명 https 활성화 (폰 Safari에서 실제 GPS 테스트용).
// 기본(npm run dev)은 http 유지 — localhost·미리보기 도구 호환.
const https = process.env.HTTPS === '1'

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(https ? [basicSsl()] : [])],
})
