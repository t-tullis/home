-- Homeroom: initial schema
--
-- Model: one Supabase Auth user per family (the parent). Students are rows
-- owned by that parent, not separate logins. Every table carries parent_id so
-- row-level security is a single, uniform rule: you only see your own family.

create type public.assignment_status as enum (
  'todo',
  'in_progress',
  'submitted',      -- student says it's done; waiting on the parent
  'needs_changes',  -- parent sent it back
  'verified'        -- parent checked the work
);

-- ---------------------------------------------------------------------------
-- Students
-- ---------------------------------------------------------------------------
create table public.students (
  id          uuid primary key default gen_random_uuid(),
  parent_id   uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  grade_level text,
  color       text not null default 'iris',
  created_at  timestamptz not null default now(),
  unique (id, parent_id)
);

-- ---------------------------------------------------------------------------
-- Assignments
-- ---------------------------------------------------------------------------
create table public.assignments (
  id              uuid primary key default gen_random_uuid(),
  parent_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  student_id      uuid not null,
  title           text not null check (char_length(title) between 1 and 200),
  subject         text not null default 'Other',
  instructions    text,
  due_date        date,
  status          public.assignment_status not null default 'todo',
  student_note    text,
  submitted_at    timestamptz,
  parent_feedback text,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  unique (id, parent_id),
  -- Composite key: an assignment can only point at a student in the same family.
  foreign key (student_id, parent_id)
    references public.students (id, parent_id) on delete cascade
);

create index assignments_student_status_idx on public.assignments (student_id, status);
create index assignments_parent_due_idx on public.assignments (parent_id, due_date);

-- Links to wherever the work actually happens (Khan Academy, IXL, a PDF, ...).
create table public.assignment_links (
  id            uuid primary key default gen_random_uuid(),
  parent_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  assignment_id uuid not null,
  label         text,
  url           text not null check (url ~* '^https?://'),
  position      int not null default 0,
  foreign key (assignment_id, parent_id)
    references public.assignments (id, parent_id) on delete cascade
);

create index assignment_links_assignment_idx on public.assignment_links (assignment_id, position);

-- Keep the review timestamps honest regardless of what the client sends.
create function public.stamp_assignment_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'submitted' then
      new.submitted_at := now();
    elsif new.status in ('verified', 'needs_changes') then
      new.reviewed_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger assignments_stamp_status
  before update on public.assignments
  for each row execute function public.stamp_assignment_status();

-- ---------------------------------------------------------------------------
-- AI assistant history (also what the daily usage cap counts)
-- ---------------------------------------------------------------------------
create table public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title      text not null default 'New conversation',
  created_at timestamptz not null default now(),
  unique (id, parent_id)
);

create table public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  parent_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  conversation_id uuid not null,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  sources         jsonb not null default '[]'::jsonb, -- [{ "url": "...", "title": "..." }]
  created_at      timestamptz not null default now(),
  foreign key (conversation_id, parent_id)
    references public.ai_conversations (id, parent_id) on delete cascade
);

create index ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);
create index ai_messages_parent_day_idx on public.ai_messages (parent_id, created_at);

-- ---------------------------------------------------------------------------
-- Row-level security: a signed-in parent can only touch their own family's rows
-- ---------------------------------------------------------------------------
alter table public.students         enable row level security;
alter table public.assignments      enable row level security;
alter table public.assignment_links enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages      enable row level security;

create policy "family rows" on public.students
  for all to authenticated
  using ((select auth.uid()) = parent_id)
  with check ((select auth.uid()) = parent_id);

create policy "family rows" on public.assignments
  for all to authenticated
  using ((select auth.uid()) = parent_id)
  with check ((select auth.uid()) = parent_id);

create policy "family rows" on public.assignment_links
  for all to authenticated
  using ((select auth.uid()) = parent_id)
  with check ((select auth.uid()) = parent_id);

create policy "family rows" on public.ai_conversations
  for all to authenticated
  using ((select auth.uid()) = parent_id)
  with check ((select auth.uid()) = parent_id);

create policy "family rows" on public.ai_messages
  for all to authenticated
  using ((select auth.uid()) = parent_id)
  with check ((select auth.uid()) = parent_id);
