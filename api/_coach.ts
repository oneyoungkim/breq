import Anthropic from '@anthropic-ai/sdk'

/* ──────────────────────────────────────────────────────────────
   BREQ AI 코치 — 서버 코어 (프레임워크 무관)

   Vercel 함수(api/coach.ts)와 Vite dev 미들웨어(vite.config.ts)가 함께 쓴다.
   ANTHROPIC_API_KEY 는 서버에서만 읽으며 프론트엔드 번들엔 절대 들어가지 않는다.
   파일명이 _ 로 시작해 Vercel이 엔드포인트로 취급하지 않는다.

   모델: 기본 Sonnet 4.6 (품질·가성비 sweet spot). 더 싸게: 'claude-haiku-4-5'.
   ────────────────────────────────────────────────────────────── */

const MODEL = 'claude-sonnet-4-6'

// RunReview 의 LLM 생성 필드(텍스트)만 — signals/tone 은 클라이언트가 계산해 병합
const SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    summary: { type: 'string' },
    good: { type: 'array', items: { type: 'string' } },
    watch: { type: 'array', items: { type: 'string' } },
    next: { type: 'string' },
    certLine: { type: 'string' },
    safetyNote: { type: 'string' },
  },
  required: ['headline', 'summary', 'good', 'watch', 'next', 'certLine'],
  additionalProperties: false,
} as const

const SYSTEM = [
  '너는 러닝앱 BREQ의 AI 코치다.',
  '철학: 최고의 러닝은 가장 빠른 기록이 아니라, 나에게 맞는 페이스를 찾는 질문이다.',
  '원칙:',
  '- 한국어 존댓말. 짧고 날카롭게. 군더더기·가짜 수치·이모지 금지.',
  '- 의학적 진단 금지. 통증·부상은 "무리하지 말고 쉬거나 전문가와 상담" 선에서만.',
  '- 체중/다이어트 자극 표현 금지. 비교보다 해석.',
  '- good/watch 는 각 1~3개의 짧은 항목. next 는 한 문장. summary 는 사실 기반 한 줄.',
  '- certLine 은 인증카드용 짧고 강한 한 줄.',
  'tone=care(느린·걷뛰 러너): 속도 대신 출석·꾸준함을 인정한다. 따뜻하지만 담백하게.',
  'tone=perform(기록러): 페이스·스플릿·분배를 날카롭게 짚되 과장 없이.',
].join('\n')

export interface CoachRequestBody {
  prompt: string
  tone?: 'care' | 'perform'
}

export interface CoachResult {
  status: number
  json: unknown
}

/** 본문 + 키를 받아 Claude 호출 → RunReview 텍스트 필드 JSON 반환 */
export async function handleCoach(body: CoachRequestBody, apiKey?: string): Promise<CoachResult> {
  if (!apiKey) {
    return { status: 500, json: { error: 'missing_api_key', message: 'ANTHROPIC_API_KEY 미설정' } }
  }
  if (!body || typeof body.prompt !== 'string' || body.prompt.length === 0) {
    return { status: 400, json: { error: 'bad_request', message: 'prompt 필요' } }
  }

  const client = new Anthropic({ apiKey })
  const toneNote =
    body.tone === 'care'
      ? '이 러너의 tone 은 care 다.'
      : body.tone === 'perform'
        ? '이 러너의 tone 은 perform 이다.'
        : ''

  try {
    // output_config(구조화 출력)는 SDK 타입에 아직 없을 수 있어 캐스팅으로 Vercel 빌드 호환 유지
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      thinking: { type: 'disabled' },
      system: toneNote ? `${SYSTEM}\n${toneNote}` : SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA }, effort: 'low' },
      messages: [{ role: 'user', content: body.prompt }],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    const text = (resp.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('')

    const data = JSON.parse(text || '{}')
    return { status: 200, json: data }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown'
    return { status: 502, json: { error: 'upstream', message } }
  }
}
