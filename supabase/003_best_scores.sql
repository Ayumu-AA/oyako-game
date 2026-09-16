-- 003: ランキングは「人ごとに 一番いい記録」だけを 見る
-- Supabase Dashboard → SQL Editor に貼って Run（002 のあと）
--
-- それまでの問題：scores は 1プレイ 1行。ランキングは その行を 上から10件 並べていたので
--   ・同じ人が 10回 遊ぶと 10枠 ぜんぶ 取れてしまう
--   ・自分の順位も「自分より上の【行】の数＋1」なので、1人が5回 いい点を出すと 2位が 6位に 見える
-- 記録そのものは 残したいので（あとで 振り返れる）、表は そのままにして
-- 「人ごとの ベスト1行」を 出す view を かぶせる。アプリは この view を 読む。

create or replace view public.best_scores
with (security_invoker = true) as
select distinct on (event_code, mode, level, user_id)
  id, user_id, event_code, mode, level, seconds, score, rank_i, nickname, played_at
from public.scores
order by event_code, mode, level, user_id,
         score desc, seconds asc, played_at asc;   -- 同点なら 速いほう、それも同じなら 先に出したほう

comment on view public.best_scores is 'ランキング表示用。1人1行（その人の ベスト）。scores は 1プレイ1行のまま残る';

grant select on public.best_scores to anon, authenticated;

-- view の distinct on が 使う並び（行が増えたとき用）
create index if not exists scores_best_idx
  on public.scores (event_code, mode, level, user_id, score desc, seconds asc, played_at asc);
