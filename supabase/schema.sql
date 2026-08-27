-- Voice of YUHAN 설문조사 — Supabase 스키마
-- Supabase 대시보드 → SQL Editor 에서 전체를 한 번 실행하세요.

create extension if not exists pgcrypto;

-- 설문조사 (여러 개를 만들고 이력으로 남길 수 있습니다)
create table if not exists surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  subtitle text not null default '',
  choice_question_count int not null default 3,
  choices_per_question int not null default 4,
  text_question_count int not null default 1,
  questions jsonb not null default '[]'::jsonb,
  start_at timestamptz,
  end_at timestamptz,
  manual_status text not null default 'auto',       -- auto | forceOpen | forceClosed
  is_active boolean not null default false,          -- vote.ourclinic.kr/ 에 실제로 노출되는 설문인지
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 동시에 활성 설문은 하나만 존재하도록 강제
create unique index if not exists surveys_one_active
  on surveys ((is_active))
  where is_active = true;

-- 응답 (닉네임 포함)
create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  nickname text not null,
  submitted_at timestamptz not null default now(),
  answers jsonb not null default '{}'::jsonb
);

create index if not exists responses_survey_id_idx on responses (survey_id);

-- 당첨자 추첨 결과 (설문 1개당 최신 추첨 결과 1건 보관, 재추첨 시 덮어씀)
create table if not exists draws (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null unique references surveys(id) on delete cascade,
  winner_count int not null,
  winners jsonb not null default '[]'::jsonb,
  drawn_at timestamptz not null default now()
);

alter table surveys enable row level security;
alter table responses enable row level security;
alter table draws enable row level security;

-- 설문조사 페이지(익명 사용자)는 "활성" 설문만 읽을 수 있음
create policy "public can read active survey" on surveys
  for select using (is_active = true);

-- 익명 사용자는 활성 설문에 한해서만 응답을 제출할 수 있음 (읽기는 불가)
create policy "public can submit responses to active survey" on responses
  for insert with check (
    exists (select 1 from surveys s where s.id = survey_id and s.is_active = true)
  );

-- responses/draws 조회, surveys 생성·수정, 비활성 설문 조회 등은 전부
-- service role(=Edge Function `admin-api`)을 통해서만 가능합니다 (RLS 우회).
