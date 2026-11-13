// AI assistant for parents. Runs on Supabase Edge Functions (Deno).
//
//   POST { mode: "chat", message, conversationId?, context? }  -> Server-Sent Events
//   POST { mode: "plan", conversationId }                      -> { assignments: [...] }
//
// The Anthropic API key lives here (ANTHROPIC_API_KEY secret) and never reaches
// the browser. Every request must carry the signed-in parent's Supabase JWT;
// all database access goes through that JWT, so row-level security applies.

import Anthropic from "npm:@anthropic-ai/sdk@1.8.0";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";

const MODEL = "claude-opus-5-5";
// If a safety classifier declines a request, the API re-runs it on a fallback
// model inside the same call instead of failing the parent's question.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";
const DAILY_MESSAGE_LIMIT = Number(Deno.env.get("AI_DAILY_MESSAGE_LIMIT") ?? "40");
const HISTORY_LIMIT = 30;
const MAX_MESSAGE_CHARS = 4000;

// Keep in sync with src/lib/subjects.ts
const SUBJECTS = [
  "Math", "Reading", "Writing", "Science", "History", "Geography",
  "Art", "Music", "Languages", "Coding", "PE", "Other",
];

const SYSTEM_PROMPT = `You are the planning assistant inside Homeroom, an app families use to run their homeschool. You are talking with a parent, often one who is new to homeschooling and unsure where to start.

Help them in two ways:
- Build structured learning plans: a clear path for a subject or a whole term, broken into weeks, with concrete things the student does each week.
- Recommend resources: curricula, websites, books, videos and practice platforms that fit the child's level, with a sentence on why each fits and whether it is free or paid.

How to work:
- If the request is too vague to plan from (no age or grade, no subject), ask one or two short questions first. Otherwise make reasonable assumptions, state them in a line, and get on with the plan.
- Use web search when recommending specific resources, so links are real and current. Only give a URL you actually found. Never invent one.
- Prefer a small number of well-chosen options over a long list. Say which one you would start with.
- Homeschooling rules differ by state and country. When legal requirements matter (notification, required subjects, testing), say so and point the parent to their state or national education authority instead of guessing.
- You are not a substitute for a professional evaluation. If a parent describes a possible learning difficulty, be supportive and suggest who can assess it.

Format replies in Markdown: short headings, bullet lists, and a table when laying out a weekly schedule. Write for a busy parent: warm, plain, and specific. No filler.`;

const PLAN_PROMPT = `Turn the learning plan from this conversation into a list of assignments a parent can add to their student's task list.

Rules:
- One assignment per concrete piece of work a student can finish and a parent can check. Aim for 4 to 12.
- "instructions" tells the student exactly what to do, in one to three sentences.
- "due_in_days" is the number of days from today the work should be due. Spread the work out the way the plan does.
- "links" may only contain URLs that appear word for word in the conversation. If there are none for an assignment, use an empty list.
- If the conversation contains no plan yet, return an empty list.`;

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["assignments"],
  properties: {
    assignments: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "subject", "instructions", "due_in_days", "links"],
        properties: {
          title: { type: "string" },
          subject: { type: "string", enum: SUBJECTS },
          instructions: { type: "string" },
          due_in_days: { type: "integer" },
          links: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "url"],
              properties: { label: { type: "string" }, url: { type: "string" } },
            },
          },
        },
      },
    },
  },
};

type Source = { url: string; title: string };
type StoredMessage = { role: "user" | "assistant"; content: string };

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Not signed in" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) return json({ error: "Not signed in" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  try {
    if (body.mode === "plan") return await handlePlan(supabase, body);
    if (body.mode === "chat") return await handleChat(supabase, body, req.signal);
    return json({ error: "Unknown mode" }, 400);
  } catch (error) {
    console.error(error);
    return json({ error: describeError(error) }, 500);
  }
});

// ---------------------------------------------------------------------------
// Chat: streamed answer with live web search
// ---------------------------------------------------------------------------
async function handleChat(
  supabase: SupabaseClient,
  body: Record<string, unknown>,
  signal: AbortSignal,
): Promise<Response> {
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return json({ error: "Message is empty" }, 400);
  if (message.length > MAX_MESSAGE_CHARS) return json({ error: "Message is too long" }, 400);

  // Daily cap, counted from the messages table (resets at midnight UTC).
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count, error: countError } = await supabase
    .from("ai_messages")
    .select("id", { count: "exact", head: true })
    .eq("role", "user")
    .gte("created_at", dayStart.toISOString());
  if (countError) throw countError;
  if ((count ?? 0) >= DAILY_MESSAGE_LIMIT) {
    return json({ error: `You've reached today's limit of ${DAILY_MESSAGE_LIMIT} questions. It resets tomorrow.` }, 429);
  }

  let conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
  let history: StoredMessage[] = [];
  if (conversationId) {
    history = await loadHistory(supabase, conversationId);
  } else {
    const { data, error } = await supabase
      .from("ai_conversations")
      .insert({ title: message.slice(0, 80) })
      .select("id")
      .single();
    if (error) throw error;
    conversationId = data.id as string;
  }

  const { error: insertError } = await supabase
    .from("ai_messages")
    .insert({ conversation_id: conversationId, role: "user", content: message });
  if (insertError) throw insertError;

  // Only non-identifying context is sent to the model: no student names.
  const context = (body.context ?? {}) as Record<string, unknown>;
  const contextLines = [`Today's date: ${new Date().toISOString().slice(0, 10)}`];
  if (typeof context.gradeLevel === "string" && context.gradeLevel) {
    contextLines.push(`Student grade level: ${context.gradeLevel.slice(0, 40)}`);
  }

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: `<context>\n${contextLines.join("\n")}\n</context>\n\n${message}` },
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (event: Record<string, unknown>) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          open = false;
        }
      };
      // The model can think and search for a while before any text arrives;
      // comment lines keep the connection from being treated as idle.
      const keepAlive = setInterval(() => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        } catch {
          open = false;
        }
      }, 15_000);

      send({ type: "start", conversationId });

      let fullText = "";
      const sources = new Map<string, Source>();
      try {
        // A long search turn can stop with "pause_turn"; sending the partial
        // turn back lets the server pick up where it left off.
        for (let round = 0; round < 4; round++) {
          const run = anthropic.beta.messages.stream(
            {
              model: MODEL,
              max_tokens: 64000,
              betas: [FALLBACK_BETA],
              fallbacks: "default",
              output_config: { effort: "medium" },
              system: SYSTEM_PROMPT,
              tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
              messages,
            },
            { signal },
          );

          for await (const event of run) {
            if (event.type === "content_block_start" && event.content_block.type === "server_tool_use") {
              send({ type: "status", status: "searching" });
            } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              fullText += event.delta.text;
              send({ type: "text", text: event.delta.text });
            }
          }

          const final = await run.finalMessage();
          for (const block of final.content) {
            if (block.type !== "text") continue;
            for (const citation of block.citations ?? []) {
              if (citation.type === "web_search_result_location" && !sources.has(citation.url)) {
                sources.set(citation.url, { url: citation.url, title: citation.title ?? citation.url });
              }
            }
          }

          if (final.stop_reason === "refusal") {
            send({ type: "error", message: "The assistant couldn't help with that request. Try rephrasing it." });
            return;
          }
          if (final.stop_reason === "max_tokens") {
            send({ type: "status", status: "truncated" });
          }
          if (final.stop_reason !== "pause_turn") break;
          messages.push({ role: "assistant", content: final.content });
        }

        const sourceList = [...sources.values()];
        if (fullText) {
          const { error } = await supabase.from("ai_messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: fullText,
            sources: sourceList,
          });
          if (error) console.error("Could not save assistant message", error);
        }
        send({ type: "done", sources: sourceList });
      } catch (error) {
        if (!signal.aborted) {
          console.error(error);
          send({ type: "error", message: describeError(error) });
        }
      } finally {
        clearInterval(keepAlive);
        open = false;
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// ---------------------------------------------------------------------------
// Plan: turn a conversation into structured assignments the app can save
// ---------------------------------------------------------------------------
async function handlePlan(supabase: SupabaseClient, body: Record<string, unknown>): Promise<Response> {
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : null;
  if (!conversationId) return json({ error: "conversationId is required" }, 400);

  const history = await loadHistory(supabase, conversationId);
  if (history.length === 0) return json({ error: "Conversation not found" }, 404);

  const transcript = history
    .map((m) => `${m.role === "user" ? "Parent" : "Assistant"}:\n${m.content}`)
    .join("\n\n---\n\n");

  const response = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: PLAN_SCHEMA },
    },
    system: PLAN_PROMPT,
    messages: [{ role: "user", content: `<conversation>\n${transcript}\n</conversation>` }],
  });

  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") {
    return json({ error: "Couldn't turn this conversation into assignments. Try again." }, 502);
  }
  const text = response.content.find((block) => block.type === "text")?.text ?? "";
  let parsed: { assignments: unknown[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    return json({ error: "Couldn't turn this conversation into assignments. Try again." }, 502);
  }
  return json({ assignments: parsed.assignments ?? [] });
}

async function loadHistory(supabase: SupabaseClient, conversationId: string): Promise<StoredMessage[]> {
  const { data, error } = await supabase
    .from("ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (error) throw error;
  const messages = (data as StoredMessage[]).reverse();
  // The API requires the first message to come from the user.
  while (messages.length > 0 && messages[0].role !== "user") messages.shift();
  return messages;
}

function describeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError) return "The AI service isn't configured correctly (check ANTHROPIC_API_KEY).";
  if (error instanceof Anthropic.RateLimitError) return "The assistant is busy right now. Try again in a minute.";
  if (error instanceof Anthropic.APIError) return "The assistant ran into a problem. Please try again.";
  return "Something went wrong. Please try again.";
}
