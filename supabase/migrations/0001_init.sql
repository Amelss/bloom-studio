-- Bloom Studio — Milestone 3 schema: accounts + cloud designs.
-- Run this in the Supabase SQL editor (or via the Supabase CLI). Idempotent-ish:
-- safe to re-run in a fresh project.

-- ─────────────────────────────── profiles ───────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null,
  role         text not null default 'student'
               check (role in ('student', 'educator', 'professional', 'admin')),
  -- false until the user has confirmed name + role (OAuth sign-ups arrive
  -- without a role, so they're sent through onboarding first).
  onboarded    boolean not null default false,
  -- optional profile details, filled in from Account settings.
  organisation text,
  experience_level text
               check (experience_level in ('beginner', 'intermediate', 'advanced', 'professional')),
  avatar_url   text,
  created_at   timestamptz not null default now()
);

-- ──────────────────────────────── designs ────────────────────────────────
create table if not exists public.designs (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  name          text not null default 'Untitled design',
  doc           jsonb not null,          -- the versioned design document
  doc_version   int  not null,           -- denormalised for migration sweeps
  thumbnail_url text,                     -- data URL (MVP) or CDN path later
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists designs_owner_idx on public.designs (owner_id, updated_at desc);

-- ────────────────── auto-create a profile on sign-up ──────────────────────
-- Reads display_name + role from the sign-up metadata so the client never has
-- to do a second write. SECURITY DEFINER so it can insert past RLS.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role, onboarded)
  values (
    new.id,
    -- email/password sends 'display_name'; Google sends 'full_name'/'name';
    -- otherwise fall back to the email's local part.
    coalesce(
      nullif(new.raw_user_meta_data->>'display_name', ''),
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      split_part(new.email, '@', 1)
    ),
    coalesce(nullif(new.raw_user_meta_data->>'role', ''), 'student'),
    -- email sign-up supplies a role (already onboarded); OAuth does not.
    coalesce(new.raw_user_meta_data ? 'role', false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- keep designs.updated_at fresh on write
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists designs_touch_updated_at on public.designs;
create trigger designs_touch_updated_at
  before update on public.designs
  for each row execute function public.touch_updated_at();

-- ─────────────────────────── row-level security ───────────────────────────
alter table public.profiles enable row level security;
alter table public.designs  enable row level security;

-- profiles: a user sees and edits only their own row.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

-- designs: full CRUD, but only over rows the user owns.
drop policy if exists "designs_select_own" on public.designs;
create policy "designs_select_own" on public.designs
  for select using (owner_id = auth.uid());

drop policy if exists "designs_insert_own" on public.designs;
create policy "designs_insert_own" on public.designs
  for insert with check (owner_id = auth.uid());

drop policy if exists "designs_update_own" on public.designs;
create policy "designs_update_own" on public.designs
  for update using (owner_id = auth.uid());

drop policy if exists "designs_delete_own" on public.designs;
create policy "designs_delete_own" on public.designs
  for delete using (owner_id = auth.uid());

-- ─────────────────────────── avatars storage ──────────────────────────────
-- Public-read bucket; a user may only write files under a folder named after
-- their own id (we store avatars at `<user_id>/avatar.<ext>`).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars_read" on storage.objects;
create policy "avatars_read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_insert_own" on storage.objects;
create policy "avatars_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
