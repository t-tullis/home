-- Parent PIN: gates the parent portal on a shared family account.
--
-- The hash lives in a table the browser cannot read at all (row-level security
-- on, no policies, no grants). The only way in is through the three functions
-- below, which always act on the signed-in user's own row.
--
-- Scope: this keeps a student out of the parent screens. It is not a second
-- login. Someone with developer tools and the family session could still call
-- the data API directly.

create extension if not exists pgcrypto with schema extensions;

create table public.parent_locks (
  parent_id       uuid primary key references auth.users (id) on delete cascade,
  pin_hash        text not null,
  failed_attempts int not null default 0,
  locked_until    timestamptz,
  updated_at      timestamptz not null default now()
);

alter table public.parent_locks enable row level security;
revoke all on public.parent_locks from anon, authenticated;

create function public.has_parent_pin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.parent_locks where parent_id = (select auth.uid()));
$$;

-- Returns 'ok', 'wrong' or 'locked'. Five wrong tries locks the PIN for five
-- minutes, so four digits can't simply be guessed through.
create function public.verify_parent_pin(pin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  lock_row public.parent_locks%rowtype;
begin
  select * into lock_row from public.parent_locks where parent_id = auth.uid() for update;
  if not found then
    return 'wrong';
  end if;
  if lock_row.locked_until is not null and lock_row.locked_until > now() then
    return 'locked';
  end if;

  if lock_row.pin_hash = extensions.crypt(coalesce(pin, ''), lock_row.pin_hash) then
    update public.parent_locks
      set failed_attempts = 0, locked_until = null
      where parent_id = auth.uid();
    return 'ok';
  end if;

  if lock_row.failed_attempts + 1 >= 5 then
    update public.parent_locks
      set failed_attempts = 0, locked_until = now() + interval '5 minutes'
      where parent_id = auth.uid();
    return 'locked';
  end if;

  update public.parent_locks
    set failed_attempts = lock_row.failed_attempts + 1, locked_until = null
    where parent_id = auth.uid();
  return 'wrong';
end;
$$;

-- True if this session was started with a fresh sign-in (password, magic link,
-- ...) in the last 10 minutes, read from the token's "amr" claim. This is the
-- forgot-my-PIN route: sign out, sign back in, set a new PIN. If the claim is
-- missing or shaped differently this returns false, so it fails closed.
create function public.signed_in_recently()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (
      select max((entry ->> 'timestamp')::bigint)
      from jsonb_array_elements(
        case when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then auth.jwt() -> 'amr' else '[]'::jsonb end
      ) as entry
      where jsonb_typeof(entry) = 'object' and (entry ->> 'timestamp') ~ '^[0-9]+$'
    ) > extract(epoch from now()) - 600,
    false
  );
$$;

-- Sets or changes the PIN. Returns 'ok', 'wrong' or 'locked'.
-- The first PIN needs nothing; changing it needs the current PIN or a fresh sign-in.
create function public.set_parent_pin(new_pin text, current_pin text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  outcome text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if new_pin is null or new_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;

  if exists (select 1 from public.parent_locks where parent_id = auth.uid())
     and not public.signed_in_recently() then
    outcome := public.verify_parent_pin(current_pin);
    if outcome <> 'ok' then
      return outcome;
    end if;
  end if;

  insert into public.parent_locks (parent_id, pin_hash)
  values (auth.uid(), extensions.crypt(new_pin, extensions.gen_salt('bf')))
  on conflict (parent_id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null, updated_at = now();
  return 'ok';
end;
$$;

revoke execute on function public.has_parent_pin() from public, anon;
revoke execute on function public.verify_parent_pin(text) from public, anon;
revoke execute on function public.set_parent_pin(text, text) from public, anon;
grant execute on function public.has_parent_pin() to authenticated;
grant execute on function public.verify_parent_pin(text) to authenticated;
grant execute on function public.set_parent_pin(text, text) to authenticated;
