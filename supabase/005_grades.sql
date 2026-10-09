-- 005: がくねんを 1〜6年に 分けた ぶんの 後始末
-- Supabase Dashboard → SQL Editor に はって Run
--
-- なぜ いるか：
--  ・001_init.sql では 学年が「低学年＝1／高学年＝2」の 2つしか なかったので、
--    level に check (level in (1,2)) が ついている。
--    1〜6年に 分けたあと、3〜6年生の 点数が ぜんぶ サーバーに はじかれていた
--    （23514 scores_level_check）。名前（profiles）も 同じ。
--  ・ランキングに 送る 数字を「正解数」から「とくてん」に 変えたので、
--    score の 上限 60 では 足りない（90秒で 3点×n もん とれる）。

-- 学年：1〜6年
alter table public.scores   drop constraint if exists scores_level_check;
alter table public.scores   add  constraint scores_level_check   check (level between 1 and 6);

alter table public.profiles drop constraint if exists profiles_level_check;
alter table public.profiles add  constraint profiles_level_check check (level between 1 and 6);

-- とくてん：0〜999（smallint の まま。正解数だったころの 60 では 足りない）
alter table public.scores   drop constraint if exists scores_score_check;
alter table public.scores   add  constraint scores_score_check   check (score between 0 and 999);

-- 動きを たしかめるのに 入れた 行を かたづける
delete from public.scores where event_code = '__test__';

-- かくにん：いまの 制約と、学年ごとの 行数
select conname, pg_get_constraintdef(oid) as def
  from pg_constraint
 where conrelid in ('public.scores'::regclass, 'public.profiles'::regclass)
   and contype = 'c'
 order by conname;

select event_code, mode, level, count(*) as rows
  from public.scores
 group by event_code, mode, level
 order by event_code, mode, level;
