# Homeroom

A homeschool tracker: students see what to do and where to do it, parents check and verify the work, and an AI assistant helps new homeschooling parents build a plan.

"Homeroom" is a working title. Rename it in `index.html` and `src/components/Brand.tsx`.

## Run it

```bash
npm install
npm run dev
```

With no environment variables set, the app runs in **demo mode**: sample students and assignments stored in your browser, and a canned assistant answer. This is for exploring the UI. Nothing is saved to a server.

| Path | What it is |
| --- | --- |
| `/` | Student view: today's work, links out to each platform, "I finished this" |
| `/parent` | Parent overview: review queue (verify or send back), students |
| `/parent/assignments` | All assignments, filters, new assignment form with links |
| `/parent/assistant` | AI planning assistant; turns a plan into assignments |
| `/login` | Sign in / sign up (only used once Supabase is connected) |

## Connect Supabase

1. Create a project at supabase.com.
2. Copy `.env.example` to `.env.local` and fill in the project URL and anon key (Project Settings -> API).
3. Apply the schema and deploy the AI function:

```bash
npx supabase init          # creates supabase/config.toml; keeps the existing folders
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
npx supabase secrets set ANTHROPIC_API_KEY=<your key from console.anthropic.com>
npx supabase functions deploy ai-assistant
```

Restart `npm run dev`. The app now asks you to sign in and reads and writes real data.

## How it fits together

- **Accounts.** One Supabase Auth user per family (the parent). Students are rows owned by that parent, not separate logins.
- **Database** (`supabase/migrations`). `students`, `assignments`, `assignment_links`, `ai_conversations`, `ai_messages`. Every table has row-level security: a signed-in parent only sees their own family's rows.
- **Parent PIN** (`supabase/migrations/*_parent_pin.sql`, `src/components/ParentGate.tsx`). The parent portal asks for a 4-digit PIN, set the first time it is opened. It locks again on reload or when you go back to the student view. The PIN is hashed in the database and checked there; five wrong tries lock it for five minutes. Forgot it? Sign out, sign back in, and you can set a new one for 10 minutes. The PIN keeps students out of the parent screens; it is not a second login, so it does not stop someone using browser developer tools.
- **Assignment lifecycle.** `todo` -> `in_progress` -> `submitted` (student says it's done) -> `verified` or `needs_changes` (parent decides).
- **Data layer** (`src/lib/types.ts` -> `Api`). The UI talks to one interface with two implementations: `api.supabase.ts` and `api.demo.ts`.
- **AI assistant** (`supabase/functions/ai-assistant`). A Supabase Edge Function that calls the Claude API (`claude-opus-5-5`) with web search, streams the answer to the browser, and stores the conversation. A second mode returns the plan as structured JSON so it can be saved as assignments. The API key stays on the server. Each parent is limited to 40 questions a day (`AI_DAILY_MESSAGE_LIMIT` secret).
- **Design** (`src/index.css`). All colours are tokens at the top of that file, with light and dark themes that follow the system setting.

## Not built yet

- Editing an assignment or a student after creating it (assignments can be deleted).
- Reopening past assistant conversations (they are stored, but the screen only shows the current one).
- Password reset, and tests.
