-- 006: 参加名簿（受付番号）
-- Supabase Dashboard → SQL Editor に 貼って Run（005 のあと）
--
-- 考え方：実名は 1文字も サーバーに 入れない。
--   受付で「6-12」のような 番号札を 渡し、アプリには 学年と 番号だけ 入れてもらう。
--   番号と 実名の 対応表は 紙（または 学校の Excel）で PTA が 持つ。
--   あとで 番号で 突き合わせれば 名簿に なるが、この表だけ 見ても 誰かは 分からない。
--
-- scores と ちがうのは、学年ボタンを おした 時点で 1行 入ること。
-- ゲームを 最後まで やらなかった 子も 名簿に 残る。

create table if not exists public.entries (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  event_code text not null,                                     -- 'T2026-12' など。家で あそんだ ぶんは 入れない
  level      smallint not null check (level between 1 and 6),    -- 学年
  seat_no    smallint not null check (seat_no between 0 and 999),-- 受付番号。0 は「ふだを もっていない」
  players    smallint check (players in (1, 2)),                 -- 1人で来たか 親子で来たか
  nickname   text,                                               -- 画面の名前（決めていれば）
  first_at   timestamptz not null default now(),                  -- はじめて さわった 時刻
  last_at    timestamptz not null default now(),                  -- さいごに さわった 時刻
  constraint entries_once unique (event_code, level, seat_no, user_id)
);
create index if not exists entries_event_idx on public.entries (event_code, level, seat_no);

comment on table  public.entries  is '参加名簿。実名は入れない。seat_no（受付番号）と紙の対応表で突き合わせる';
comment on column public.entries.seat_no is '受付で渡した番号札の番号。0＝ふだなし（1台を何人かで つかうと 0 は 1行に まとまる）';

-- 名前に NGワードが 入っていたら 置きかえる ＋ さわった 時刻を つけなおす
create or replace function public.entries_before() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.nickname is not null then new.nickname := public.nick_clean(new.nickname); end if;
  new.last_at := now();
  return new;
end $$;
drop trigger if exists entries_before_trg on public.entries;
create trigger entries_before_trg before insert or update on public.entries
  for each row execute function public.entries_before();

-- RLS：自分の行だけ 入れる・直せる。
-- select は あえて 作らない → アプリからは 名簿を 1行も 読めない（Dashboard だけ）
alter table public.entries enable row level security;
drop policy if exists "insert own entry" on public.entries;
drop policy if exists "update own entry" on public.entries;
create policy "insert own entry" on public.entries
  for insert with check (auth.uid() = user_id);
create policy "update own entry" on public.entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- かくにん
select conname, pg_get_constraintdef(oid) as def
  from pg_constraint where conrelid = 'public.entries'::regclass order by conname;
