-- 007: 点数にも 受付番号を 持たせる（1人1番号で 数える）
-- Supabase Dashboard → SQL Editor に 貼って Run（006 のあと）
--
-- これまでは「端末ごとの 匿名ID」で 1人を 数えていたので、
--   ・同じ子が 自分のスマホと 親のスマホで 遊ぶ → ランキングに 2人として ならぶ
--   ・受付の 共用たんまつを 何人かで 使う     → 全員が 同じ1人に なって ベストが 上書きし合う
--   ・ブラウザの サイトデータを 消す           → その子の 記録が 別人に なる
-- 受付番号を 点数の 行にも つけて、番号が あるときは 番号で 1人と 数える。

alter table public.scores add column if not exists seat_no smallint;
alter table public.scores drop constraint if exists scores_seat_check;
alter table public.scores add  constraint scores_seat_check check (seat_no is null or seat_no between 0 and 999);
comment on column public.scores.seat_no is '受付番号。0 または null＝番号なし（そのときは 端末ごとに 数える）';

create index if not exists scores_seat_idx
  on public.scores (event_code, mode, level, seat_no, score desc, seconds asc);

-- ランキングの もと。番号が あれば 番号ごと、無ければ 端末ごとに「その人の ベスト 1行」
drop view if exists public.best_scores;
create view public.best_scores
with (security_invoker = true) as
select distinct on (event_code, mode, level, who)
  id, user_id, event_code, mode, level, seconds, score, rank_i, nickname, played_at, seat_no, who
from (
  select s.*,
         case when coalesce(s.seat_no, 0) > 0 then 'n:' || s.seat_no else 'u:' || s.user_id end as who
    from public.scores s
) t
order by event_code, mode, level, who,
         score desc, seconds asc, played_at asc;   -- 同点なら 速いほう、それも同じなら 先に出したほう
comment on view public.best_scores is 'ランキング表示用。1人1行（受付番号が あれば 番号ごと、無ければ 端末ごと）';
grant select on public.best_scores to anon, authenticated;

-- かくにん：番号ごとに まとまっているか
select event_code, mode, level, count(*) as 人, count(*) filter (where coalesce(seat_no,0) > 0) as 番号あり
  from public.best_scores group by event_code, mode, level order by event_code, mode, level;
