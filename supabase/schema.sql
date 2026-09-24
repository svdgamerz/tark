-- Tark — Supabase schema (Phase 0)
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
--
-- Phase 0 is intentionally minimal: just enough to record that a session
-- happened. The full learner model and Row-Level Security come later.

create table if not exists public.sessions (
  id          uuid primary key default gen_random_uuid(),
  mode        text not null,                -- 'teacher' | 'socratic'
  created_at  timestamptz not null default now(),
  user_id     uuid                          -- nullable in Phase 0 (no auth yet)
);

-- TODO(Phase 2): full relational learner model —
--   learners(mastery per topic, known misconceptions),
--   review_schedule(spaced-repetition items + due dates).
--
-- TODO(Phase 4): enable Row-Level Security so a user can only read/write their
-- own rows (CLAUDE.md §12). The backend currently uses the service_role key,
-- which bypasses RLS — fine ONLY while there is no per-user auth. Before any
-- real users:
--   alter table public.sessions enable row level security;
--   create policy "own sessions" on public.sessions
--     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
