-- 名簿の 取り出し（当日の おわりに つかう）
-- Supabase Dashboard → SQL Editor に 貼って Run → 結果の 右上「Download CSV」
-- イベントコードは 'T2026-12' の ところを 当日の ものに そろえる（4か所）。
--
-- 1人＝1番号で まとめる。同じ子が 2台で 遊んでも 1行、共用たんまつを 何人かで
-- 使っても 番号ごとに 分かれる。番号札を もらわなかった 人（seat_no = 0）だけは
-- 端末ごとに 分けて ならべる（まとめると 全員 1行に なってしまうため）。

-- ① 名簿（学年 → 番号の 順）。紙の 対応表と 突き合わせる
with e as (
  select *, case when seat_no = 0 then 'u:' || user_id else 'n:' || seat_no end as who
    from public.entries where event_code = 'T2026-12'
),
s as (
  select level,
         case when coalesce(seat_no, 0) = 0 then 'u:' || user_id else 'n:' || seat_no end as who,
         count(*) as plays, max(score) as best
    from public.scores where event_code = 'T2026-12'
   group by 1, 2
)
select
  e.level                                                   as "学年",
  case when e.seat_no = 0 then '（ふだなし）'
       else e.level || '-' || e.seat_no end                  as "受付番号",
  string_agg(distinct nullif(e.nickname, ''), ' / ')         as "画面の名前",
  case max(e.players) when 2 then '親子' when 1 then 'ひとり' end as "人数",
  to_char(min(e.first_at) + interval '9 hours', 'HH24:MI')   as "きた時刻",
  to_char(max(e.last_at)  + interval '9 hours', 'HH24:MI')   as "さいご",
  count(distinct e.user_id)                                  as "つかった端末",
  coalesce(max(s.plays), 0)                                  as "プレイ回数",
  max(s.best)                                                as "さいこう点"
from e
left join s on s.who = e.who and s.level = e.level
group by e.level, e.seat_no, case when e.seat_no = 0 then e.user_id::text else '' end
order by e.level, e.seat_no;

-- ② 学年ごとの 人数（配布物・表彰の 数を 決めるとき）
select
  level                                          as "学年",
  count(distinct case when seat_no = 0 then 'u:' || user_id else 'n:' || seat_no end) as "参加人数",
  count(distinct user_id) filter (where seat_no = 0) as "ふだなし",
  count(*) filter (where players = 2)            as "親子で来た",
  count(*) filter (where nickname is not null)   as "名前を入れた"
from public.entries
where event_code = 'T2026-12'
group by level
order by level;

-- ③ 遊んだのに 名簿に いない 人（取りこぼしの かくにん。ふつうは 0行）
select s.level as "学年", s.nickname as "画面の名前", s.seat_no as "番号", count(*) as "プレイ回数"
from public.scores s
where s.event_code = 'T2026-12'
  and not exists (
    select 1 from public.entries e
     where e.event_code = s.event_code and e.level = s.level
       and (e.user_id = s.user_id or (coalesce(s.seat_no, 0) > 0 and e.seat_no = s.seat_no)))
group by s.level, s.nickname, s.seat_no
order by s.level;

-- ④ 表彰の 前に：同じ 番号が 2台以上の 端末から 出ていないか（出ていても ①②は 正しく まとまる）
select level as "学年", seat_no as "番号", count(distinct user_id) as "端末の数"
from public.entries
where event_code = 'T2026-12' and seat_no > 0
group by level, seat_no
having count(distinct user_id) > 1
order by level, seat_no;
