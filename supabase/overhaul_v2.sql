-- ========================================================================
-- overhaul_v2.sql — Test result ecosystem + Admin panel support
-- ========================================================================

-- 1. tests table — guarantee admin-panel columns exist
alter table public.tests add column if not exists provider           text;
alter table public.tests add column if not exists institute          text;
alter table public.tests add column if not exists program_name       text;
alter table public.tests add column if not exists question_count     integer default 0;
alter table public.tests add column if not exists default_minutes    integer default 60;

-- 2. test_attempts table — guarantee analytics columns exist
alter table public.test_attempts add column if not exists started_at      timestamptz;
alter table public.test_attempts add column if not exists submitted_at    timestamptz default now();
alter table public.test_attempts add column if not exists score           integer default 0;
alter table public.test_attempts add column if not exists attempt_payload jsonb;

-- 3. questions table — guarantee admin-panel columns exist
alter table public.questions add column if not exists explanation_markdown text;
alter table public.questions add column if not exists section_group        text;
alter table public.questions add column if not exists is_pyq               boolean default false;
alter table public.questions add column if not exists is_upsc_cse          boolean default false;
alter table public.questions add column if not exists is_allied            boolean default false;
alter table public.questions add column if not exists is_others            boolean default false;

-- 4. admin_users table for admin panel auth
create table if not exists public.admin_users (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  email       text not null,
  role        text not null default 'editor',
  created_at  timestamptz default now()
);

-- 5. RLS for admin_users
alter table public.admin_users enable row level security;

drop policy if exists "admin self read" on public.admin_users;
create policy "admin self read" on public.admin_users
  for select using (auth.uid() = user_id);

-- 6. Helper view for admin user-performance dashboard
create or replace view public.admin_user_performance as
select
  ta.id              as attempt_id,
  ta.user_id,
  ta.test_id,
  t.title            as test_title,
  ta.score,
  t.question_count,
  case when t.question_count > 0
       then round(ta.score::numeric / t.question_count * 100, 1)
       else 0 end    as accuracy_pct,
  ta.started_at,
  ta.submitted_at,
  extract(epoch from (ta.submitted_at - ta.started_at))::int as duration_seconds
from public.test_attempts ta
left join public.tests t on t.id = ta.test_id
order by ta.submitted_at desc;

grant select on public.admin_user_performance to authenticated;

comment on view public.admin_user_performance is
  'Joined view of test_attempts × tests for the admin User Performance dashboard.';
