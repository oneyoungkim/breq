// ESM("type":"module") 런타임이라 상대경로에 .js 확장자 필수 (소스는 .ts, 컴파일 후 .js 참조)
import { handleCoach, type CoachRequestBody } from './_coach.js'

/* Vercel 서버리스 함수 — POST /api/coach
   ANTHROPIC_API_KEY 는 Vercel 프로젝트 환경변수(서버 전용)에서 읽는다. */

interface Req {
  method?: string
  body?: unknown
}
interface Res {
  status(code: number): Res
  json(body: unknown): void
  setHeader(k: string, v: string): void
  end(): void
}

export default async function handler(req: Req, res: Res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }
  // Vercel 은 JSON 본문을 파싱해 req.body 로 준다(문자열일 수도 있어 방어).
  let body = req.body as CoachRequestBody
  if (typeof req.body === 'string') {
    try {
      body = JSON.parse(req.body) as CoachRequestBody
    } catch {
      res.status(400).json({ error: 'invalid_json' })
      return
    }
  }
  const { status, json } = await handleCoach(body, process.env.ANTHROPIC_API_KEY)
  res.status(status).json(json)
}
