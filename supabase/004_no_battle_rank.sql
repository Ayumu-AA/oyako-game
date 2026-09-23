-- 2人の はやおし親子バトルは ランキングを やめて 参加賞だけに する、と 決めたので、
-- これまでに たまった mode='battle' の 記録を 消す。
--
-- ・アプリは もう mode='battle' を 送らない（ひとりの はやおしは 'battle1'）。
-- ・best_scores は scores から 作る view なので、scores を 消せば
--   ランキング画面も 掲示ページも そろって きれいに なる。
-- ・消すのは 2人バトルの 記録だけ。ほかの ゲームの 記録は さわらない。

-- ① まず どれだけ あるか 見る（消す前の 確認用。ここだけ 先に 実行しても よい）
select event_code, level, count(*) as rows, count(distinct user_id) as people
from public.scores
where mode = 'battle'
group by event_code, level
order by event_code, level;

-- ② 消す
delete from public.scores where mode = 'battle';

-- ③ のこりを 確かめる（0 件に なっていれば OK）
select count(*) as battle_rows_left from public.scores where mode = 'battle';
