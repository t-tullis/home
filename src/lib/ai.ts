import { isSupabaseConfigured, supabase, supabaseAnonKey, supabaseUrl } from './supabase'

export interface Source {
  url: string
  title: string
}

/** One proposed assignment, as returned by the Edge Function's "plan" mode. */
export interface PlanItem {
  title: string
  subject: string
  instructions: string
  due_in_days: number
  links: Array<{ label: string; url: string }>
}

export type ChatEvent =
  | { type: 'start'; conversationId: string }
  | { type: 'status'; status: 'searching' | 'truncated' }
  | { type: 'text'; text: string }
  | { type: 'done'; sources: Source[] }
  | { type: 'error'; message: string }

interface ChatRequest {
  message: string
  conversationId: string | null
  gradeLevel: string | null
}

async function callFunction(body: unknown, signal?: AbortSignal): Promise<Response> {
  const { data } = await supabase!.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Please sign in again.')
  return fetch(`${supabaseUrl}/functions/v1/ai-assistant`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
    signal,
  })
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json()
    if (typeof body.error === 'string') return body.error
  } catch {
    // not JSON
  }
  return 'The assistant is unavailable right now. Please try again.'
}

/** Streams the assistant's reply, calling onEvent as text and status updates arrive. */
export async function streamChat(
  request: ChatRequest,
  onEvent: (event: ChatEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  if (!isSupabaseConfigured) return streamDemoChat(onEvent, signal)

  const response = await callFunction(
    {
      mode: 'chat',
      message: request.message,
      conversationId: request.conversationId,
      context: { gradeLevel: request.gradeLevel },
    },
    signal,
  )
  if (!response.ok || !response.body) {
    onEvent({ type: 'error', message: await errorMessage(response) })
    return
  }

  // Server-Sent Events: blocks separated by a blank line, payload on "data:" lines.
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()
  let buffer = ''
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += value
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() ?? ''
    for (const block of blocks) {
      for (const line of block.split('\n')) {
        if (!line.startsWith('data: ')) continue
        try {
          onEvent(JSON.parse(line.slice(6)) as ChatEvent)
        } catch {
          // ignore a malformed event rather than dropping the whole stream
        }
      }
    }
  }
}

/** Asks the assistant to turn the conversation's plan into assignments. */
export async function draftAssignments(conversationId: string): Promise<PlanItem[]> {
  if (!isSupabaseConfigured) return DEMO_PLAN
  const response = await callFunction({ mode: 'plan', conversationId })
  if (!response.ok) throw new Error(await errorMessage(response))
  const body = (await response.json()) as { assignments: PlanItem[] }
  return body.assignments
}

// ---------------------------------------------------------------------------
// Demo mode: a canned answer so the screen can be explored without a backend.
// ---------------------------------------------------------------------------
const DEMO_REPLY = `> **Sample answer.** Demo mode isn't connected to the AI yet. Once Supabase and the \`ai-assistant\` function are set up, answers here are live, tailored to your question, and backed by web search.

## A gentle 4-week start for 4th grade math

**Assuming** about 30 minutes a day, four days a week, and a student who is comfortable with basic multiplication facts.

| Week | Focus | What your student does |
| --- | --- | --- |
| 1 | Place value to 1,000,000 | Two short lessons, one practice set, one game day |
| 2 | Multi-digit multiplication | Area-model lessons, then daily 10-question practice |
| 3 | Division with remainders | Hands-on sharing problems, then a practice set |
| 4 | Fractions: equivalence | Fraction strips activity and a short quiz |

### Where I'd start
- **Khan Academy (free)**: complete, self-paced, and it tracks mastery for you.
- **A printed workbook** for one day a week away from the screen.

### How you'll know it's working
Ask your student to *teach* you one problem each Friday. If they can explain it, they own it.`

const DEMO_PLAN: PlanItem[] = [
  {
    title: 'Place value to 1,000,000',
    subject: 'Math',
    instructions: 'Complete the two place value lessons and the practice set.',
    due_in_days: 4,
    links: [{ label: 'Khan Academy', url: 'https://www.khanacademy.org' }],
  },
  {
    title: 'Multi-digit multiplication with area models',
    subject: 'Math',
    instructions: 'Watch the area-model lesson, then do 10 practice questions each day.',
    due_in_days: 11,
    links: [{ label: 'Khan Academy', url: 'https://www.khanacademy.org' }],
  },
  {
    title: 'Division with remainders',
    subject: 'Math',
    instructions: 'Solve the sharing problems with counters first, then finish the practice set.',
    due_in_days: 18,
    links: [],
  },
  {
    title: 'Equivalent fractions with fraction strips',
    subject: 'Math',
    instructions: 'Make fraction strips, find three pairs of equivalent fractions, then take the short quiz.',
    due_in_days: 25,
    links: [],
  },
]

async function streamDemoChat(onEvent: (event: ChatEvent) => void, signal: AbortSignal) {
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  onEvent({ type: 'start', conversationId: 'demo' })
  onEvent({ type: 'status', status: 'searching' })
  await wait(900)
  for (const chunk of DEMO_REPLY.match(/[\s\S]{1,14}/g) ?? []) {
    if (signal.aborted) return
    onEvent({ type: 'text', text: chunk })
    await wait(12)
  }
  onEvent({ type: 'done', sources: [{ url: 'https://www.khanacademy.org', title: 'Khan Academy' }] })
}
