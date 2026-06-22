import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { distillSeasonalProfile, type HistoryObservation } from '@/lib/forecast/distillHistory'

// The Anthropic SDK needs the Node.js runtime; never pre-render this handler.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Cap pasted history so a single request can't run up an unbounded token bill. */
const MAX_RAW_CHARS = 20_000
const MAX_OUTPUT_TOKENS = 4096
/** Override-able so a model-id rename is an env change, not a redeploy. */
const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'

const RequestSchema = z.object({
  billName: z.string().trim().min(1).max(120),
  rawText: z.string().trim().min(1).max(MAX_RAW_CHARS)
})

/** Shape Claude must return via the forced tool call. */
const ObservationSchema = z.object({
  year: z.number(),
  month: z.number(),
  amount: z.number()
})
const ToolInputSchema = z.object({
  observations: z.array(ObservationSchema),
  note: z.string().default(''),
  confidence: z.enum(['high', 'medium', 'low']).default('medium')
})

const EXTRACTION_TOOL: Anthropic.Tool = {
  name: 'record_history',
  description:
    'Record the per-month billing history you extracted from the user-provided text. ' +
    'Extract observed amounts only — do NOT compute averages or a forecast; the application does that deterministically.',
  input_schema: {
    type: 'object',
    properties: {
      observations: {
        type: 'array',
        description: 'One entry per observed month. Omit months you have no information about.',
        items: {
          type: 'object',
          properties: {
            year: { type: 'integer', description: 'Calendar year, e.g. 2024.' },
            month: { type: 'integer', description: 'Month number 1-12 (1 = January).' },
            amount: { type: 'number', description: 'Billed amount in dollars, positive.' }
          },
          required: ['year', 'month', 'amount']
        }
      },
      note: {
        type: 'string',
        description: 'One short sentence summarizing the history and any caveats (e.g. estimated values).'
      },
      confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'How confident you are that the observations reflect the source text.'
      }
    },
    required: ['observations', 'note', 'confidence']
  }
}

const SYSTEM_PROMPT = [
  'You convert a household member’s messy, free-form bill history into structured monthly observations.',
  'Rules:',
  '- Emit one observation per month you can infer, with its calendar year, month (1-12), and dollar amount.',
  '- Do NOT average, total, or forecast — only report observed/stated amounts. The app computes the seasonal profile itself.',
  '- If the text gives a typical monthly amount with no dates, emit 12 months for the most recent plausible year and set confidence to "low".',
  '- If amounts are approximate or ranges, use your best single estimate and lower the confidence.',
  '- Ignore late fees, credits, and non-bill noise. Amounts are positive dollars.',
  'Always call the record_history tool exactly once.'
].join('\n')

function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.RateLimitError) return 'The AI service is rate limited right now. Try again in a minute.'
  if (err instanceof Anthropic.AuthenticationError) return 'The AI service rejected the API key. Check ANTHROPIC_API_KEY.'
  if (err instanceof Anthropic.APIConnectionError) return 'Could not reach the AI service. Check your connection and retry.'
  if (err instanceof Anthropic.APIError) return `The AI service returned an error (${err.status ?? 'unknown'}).`
  return 'Could not analyze the history. Please try again.'
}

export async function POST(request: NextRequest) {
  // 1. Auth gate — this endpoint calls a paid API, so require a signed-in user.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Not authenticated.' }, { status: 401 })
  }

  // 2. Validate input at the boundary.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }
  const parsed = RequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Provide a bill name and history text (under 20k characters).' }, { status: 400 })
  }

  // 3. Require the API key explicitly so the failure is legible.
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: 'AI import is not configured (missing ANTHROPIC_API_KEY).' }, { status: 503 })
  }

  // 4. Ask Claude to extract observations (it reads; we count).
  let observations: HistoryObservation[]
  let note: string
  let confidence: 'high' | 'medium' | 'low'
  try {
    const client = new Anthropic({ apiKey })
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'record_history' },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Bill: ${parsed.data.billName}\n\nHistory:\n${parsed.data.rawText}`
        }
      ]
    })

    const toolUse = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'record_history'
    )
    if (!toolUse) {
      return NextResponse.json({ ok: false, error: 'The AI did not return structured history. Try rephrasing the input.' }, { status: 502 })
    }
    const toolParsed = ToolInputSchema.safeParse(toolUse.input)
    if (!toolParsed.success) {
      return NextResponse.json({ ok: false, error: 'The AI returned malformed history. Please try again.' }, { status: 502 })
    }
    observations = toolParsed.data.observations
    note = toolParsed.data.note
    confidence = toolParsed.data.confidence
  } catch (err) {
    return NextResponse.json({ ok: false, error: friendlyError(err) }, { status: 502 })
  }

  // 5. Distill deterministically — every number in the profile is computed here.
  const computedAt = new Date().toISOString().slice(0, 10)
  const result = distillSeasonalProfile(observations, { computedAt, note })
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 422 })
  }

  // Raw history is never persisted — only this distilled summary is returned.
  return NextResponse.json({
    ok: true,
    profile: result.profile,
    monthsCovered: result.monthsCovered,
    observationsUsed: result.observationsUsed,
    warnings: result.warnings,
    note,
    confidence
  })
}
