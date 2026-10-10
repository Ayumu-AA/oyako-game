-- 名簿の 取り出し（当日の おわりに つかう）
-- Supabase Dashboard → SQL Editor に 貼って Run → 結果の 右上「Download CSV」
-- イベントコードは 3か所の 'T2026-12' を 当日の ものに そろえる。

-- ① 名簿（学年 → 番号の 順）。これを CSV に 落として 紙の 対応表と 突き合わせる
select
  e.level                                                  as "学年",
  case when e.seat_no = 0 then '（ふだなし）'
       else e.level || '-' || e.seat_no end                 as "受付番号",
  case e.players when 2 then '親子' when 1 then 'ひとり' end as "人数",
  e.nickname                                               as "画面の名前",
  to_char(e.first_at + interval '9 hours', 'HH24:MI')      as "きた時刻",
  to_char(e.last_at  + interval '9 hours', 'HH24:MI')      as "さいご",
  coalesce(p.plays, 0)                                     as "プレイ回数",
  p.best                                                   as "さいこう点"
from public.entries e
left join (
  select user_id, level, count(*) as plays, max(score) as best
    from public.scores
   where event_code = 'T2026-12'
   group by user_id, level
) p on p.user_id = e.user_id and p.level = e.level
where e.event_code = 'T2026-12'
order by e.level, e.seat_no;

-- ② 学年ごとの 人数（配布物・表彰の 数を 決めるとき）
select
  level                                     as "学年",
  count(*)                                  as "参加人数",
  count(*) filter (where seat_no = 0)       as "ふだなし",
  count(*) filter (where players = 2)       as "親子で来た",
  count(*) filter (where nickname is not null) as "名前を入れた"
from public.entries
where event_code = 'T2026-12'
group by level
order by level;

-- ③ 遊んだのに 名簿に いない 人（番号を きく前の 行が あれば ここに 出る）
select s.level as "学年", s.nickname as "画面の名前", count(*) as "プレイ回数"
from public.scores s
where s.event_code = 'T2026-12'
  and not exists (select 1 from public.entries e where e.user_id = s.user_id and e.event_code = s.event_code)
group by s.level, s.nickname
order by s.level;
