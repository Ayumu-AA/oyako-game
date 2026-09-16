-- oyako-game  初期スキーマ（spec-v2 §4.2 / §4.3）
-- Supabase Dashboard → SQL Editor に貼って Run

-- 匿名ユーザーの 見た目の情報
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 6),
  level smallint check (level in (1,2)),
  created_at timestamptz default now()
);

-- まちがい帳・出題きろく（localStorage と同じ形）
create table if not exists public.question_stats (
  user_id uuid references auth.users(id) on delete cascade,
  subject text not null,            -- pref / flag / kokugo / rika / rekishi / eigo
  name text not null,
  miss_count smallint default 0,
  last_seen_at timestamptz,
  last_missed_at timestamptz,
  primary key (user_id, subject, name)
);

-- ランキングの 元になる 1プレイ
create table if not exists public.scores (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  event_code text not null,          -- 'T2026-12' など。家で遊んだ分は 'home'
  mode text not null,                -- pref / flag / ... / battle / math / geopref ...
  level smallint not null check (level in (1,2)),
  seconds smallint not null check (seconds between 1 and 300),
  score smallint not null check (score between 0 and 60),
  rank_i smallint not null check (rank_i between 0 and 5),
  nickname text not null,            -- 表示用に その時点の名前を コピー
  played_at timestamptz default now()
);
create index if not exists scores_rank_idx
  on public.scores (event_code, mode, level, score desc, seconds asc);

-- RLS
alter table public.profiles       enable row level security;
alter table public.question_stats enable row level security;
alter table public.scores         enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own stats" on public.question_stats
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "insert own" on public.scores
  for insert with check (auth.uid() = user_id);
create policy "read all" on public.scores
  for select using (true);
