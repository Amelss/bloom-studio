-- Bloom Studio — Milestone 3: read-only share links + client feedback.
-- A design can be published behind an unguessable `share_id`. Anyone with the
-- link can view it (no account) and leave one approve / request-changes
-- response. Anonymous access is granted ONLY through two SECURITY DEFINER
-- functions — the tables themselves stay locked down by RLS.

-- ─────────────────────── shareable link on designs ────────────────────────
alter table public.designs
  add column if not exists share_id   text unique,   -- null = not shared
  add column if not exists shared_at  timestamptz;

-- ─────────────────────────── client feedback ──────────────────────────────
create table if not exists public.design_feedback (
  id            uuid primary key default gen_random_uuid(),
  design_id     uuid not null references public.designs(id) on delete cascade,
  verdict       text not null check (verdict in ('approved', 'changes_requested')),
  note          text,
  reviewer_name text,
  created_at    timestamptz not null default now()
);

create index if not exists design_feedback_design_idx
  on public.design_feedback (design_id, created_at desc);

alter table public.design_feedback enable row level security;

-- The owner of the design reads its feedback; nobody selects it anonymously
-- (the public page never lists prior feedback). Inserts happen only through the
-- SECURITY DEFINER function below, which bypasses RLS.
drop policy if exists "feedback_select_owner" on public.design_feedback;
create policy "feedback_select_owner" on public.design_feedback
  for select using (
    exists (
      select 1 from public.designs d
      where d.id = design_feedback.design_id and d.owner_id = auth.uid()
    )
  );

-- ─────────────────── anonymous read of a shared design ─────────────────────
-- Returns the design document for a valid, currently-shared link. SECURITY
-- DEFINER so it can read past the owner-only RLS on `designs`, but it only ever
-- exposes rows whose share_id matches — never anything else.
create or replace function public.get_shared_design(p_share_id text)
returns table (id uuid, name text, doc jsonb, updated_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select d.id, d.name, d.doc, d.updated_at
  from public.designs d
  where d.share_id = p_share_id
  limit 1;
$$;

-- Records a single client response against a shared design. Resolves the design
-- from its share_id so the caller never learns the internal id, and validates
-- the verdict. SECURITY DEFINER to insert past RLS.
create or replace function public.submit_design_feedback(
  p_share_id text,
  p_verdict  text,
  p_note     text default null,
  p_reviewer text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_design_id uuid;
begin
  if p_verdict not in ('approved', 'changes_requested') then
    raise exception 'invalid verdict';
  end if;

  select id into v_design_id
  from public.designs
  where share_id = p_share_id
  limit 1;

  if v_design_id is null then
    raise exception 'share link not found';
  end if;

  insert into public.design_feedback (design_id, verdict, note, reviewer_name)
  values (v_design_id, p_verdict, nullif(p_note, ''), nullif(p_reviewer, ''));
end;
$$;

-- Lock down, then grant only the two entry points to anonymous callers.
revoke all on function public.get_shared_design(text) from public;
revoke all on function public.submit_design_feedback(text, text, text, text) from public;
grant execute on function public.get_shared_design(text) to anon, authenticated;
grant execute on function public.submit_design_feedback(text, text, text, text) to anon, authenticated;
