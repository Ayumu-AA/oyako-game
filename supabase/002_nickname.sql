-- 002: 名前の変更を ランキングに 反映する ＋ サーバー側の NGワード
-- Supabase Dashboard → SQL Editor に貼って Run（001 のあと）

-- NGワード（部分一致）。イベント中に 追加するときは
--   insert into public.ng_words(word) values ('ことば') on conflict do nothing;
--   select public.ng_apply();     -- すでに 入っている名前にも 適用
create table if not exists public.ng_words (
  word text primary key,
  created_at timestamptz default now()
);
alter table public.ng_words enable row level security;
drop policy if exists "read all ng" on public.ng_words;
create policy "read all ng" on public.ng_words for select using (true);   -- アプリが 起動時に 読む。書けるのは Dashboard だけ

-- 正規化：カタカナ→ひらがな、小書き→大きく、ー と 空白を 消す、のばす音を 消す（「りんびょー」「リンビョウ」「りんびよう」も 同じ語として 引っかかる）
-- src/lib/nickname.ts の normNick() と 同じ 手順（片方を 変えたら もう片方も）
create or replace function public.nick_norm(t text) returns text
language sql immutable as $$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(translate(coalesce(t, ''),
    'ァィゥェォャュョッヮアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポヴぁぃぅぇぉゃゅょっゎー 　',
    'あいうえおやゆよつわあいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽゔあいうえおやゆよつわ'), '([あかさたなはまやらわがざだばぱ])[あ]+', '\1', 'g'), '([いきしちにひみりぎじぢびぴ])[い]+', '\1', 'g'), '([うくすつぬふむゆるぐずづぶぷゔ])[う]+', '\1', 'g'), '([えけせてねへめれげぜでべぺ])[いえ]+', '\1', 'g'), '([おこそとのほもよろをごぞどぼぽ])[うお]+', '\1', 'g');
$$;

create or replace function public.nick_is_ng(t text) returns boolean
language sql stable as $$
  select exists (select 1 from public.ng_words w where public.nick_norm(t) like '%' || public.nick_norm(w.word) || '%');
$$;

-- NG なら「ななしさん」に 置きかえる（はじかない：点数は 落とさない）
create or replace function public.nick_clean(t text) returns text
language sql stable as $$
  select case when public.nick_is_ng(t) then 'ななしさん' else t end;
$$;

-- profiles：入る前に NG を 置きかえ、名前が 変わったら その人の scores の名前も 全部 書きかえる
create or replace function public.profiles_before() returns trigger
language plpgsql as $$
begin
  new.nickname := public.nick_clean(new.nickname);
  return new;
end $$;
drop trigger if exists profiles_before_trg on public.profiles;
create trigger profiles_before_trg before insert or update on public.profiles
  for each row execute function public.profiles_before();

create or replace function public.profiles_after() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.scores set nickname = new.nickname
    where user_id = new.id and nickname is distinct from new.nickname;
  return new;
end $$;
drop trigger if exists profiles_after_trg on public.profiles;
create trigger profiles_after_trg after insert or update of nickname on public.profiles
  for each row execute function public.profiles_after();

-- scores：入る前に、その人の profiles の名前に そろえる（無ければ 送られた名前）→ NG なら 置きかえ
create or replace function public.scores_before() returns trigger
language plpgsql security definer set search_path = public as $$
declare p text;
begin
  select nickname into p from public.profiles where id = new.user_id;
  new.nickname := public.nick_clean(coalesce(p, new.nickname));
  return new;
end $$;
drop trigger if exists scores_before_trg on public.scores;
create trigger scores_before_trg before insert on public.scores
  for each row execute function public.scores_before();

-- いま 入っている 名前に NGワードを 適用しなおす（Dashboard から 呼ぶ。アプリからは 呼べない）
create or replace function public.ng_apply() returns integer
language plpgsql security definer set search_path = public as $$
declare a integer; b integer;
begin
  update public.profiles set nickname = 'ななしさん' where public.nick_is_ng(nickname);   -- trigger が scores にも 流す
  get diagnostics a = row_count;
  update public.scores set nickname = 'ななしさん' where public.nick_is_ng(nickname);     -- profiles が 無い 行の ぶん
  get diagnostics b = row_count;
  return a + b;   -- 直した 合計。profiles の ぶんだけ 返すと 0 に 見えて「効いていない」と 誤解する
end $$;
revoke execute on function public.ng_apply() from public, anon, authenticated;

-- 特定の名前を 手で 直すとき（trigger が scores にも 流す）
--   update public.profiles set nickname = 'ななしさん' where nickname = 'よくないなまえ';

-- アプリ内の表（src/lib/nickname.ts NG_WORDS）と 同じものを 入れておく
insert into public.ng_words (word) values
  ('あいじん'),
  ('あなる'),
  ('あほ'),
  ('いんもう'),
  ('うざい'),
  ('うすのろ'),
  ('うぜえ'),
  ('うんこ'),
  ('うんち'),
  ('えいず'),
  ('えっち'),
  ('えぼら'),
  ('えろ'),
  ('おしっこ'),
  ('おっぱい'),
  ('おなに'),
  ('おなら'),
  ('かたわ'),
  ('きえろ'),
  ('きちがい'),
  ('きもい'),
  ('きもちわる'),
  ('きんたま'),
  ('くさい'),
  ('くず'),
  ('くそ'),
  ('くたばれ'),
  ('くろんぼ'),
  ('けつ'),
  ('げり'),
  ('げろ'),
  ('こうもん'),
  ('ころし'),
  ('ころす'),
  ('ころせ'),
  ('ころな'),
  ('ごうかん'),
  ('ごみ'),
  ('しっこ'),
  ('しにたい'),
  ('しね'),
  ('しょうがい'),
  ('じさつ'),
  ('せいしんびょう'),
  ('せいびょう'),
  ('せくす'),
  ('せっくす'),
  ('そーぷ'),
  ('ださい'),
  ('だっさ'),
  ('ちかん'),
  ('ちくび'),
  ('ちんかす'),
  ('ちんこ'),
  ('ちんちん'),
  ('ちんぽ'),
  ('つんぼ'),
  ('でぶ'),
  ('とうさつ'),
  ('どじん'),
  ('にんちしょう'),
  ('のろま'),
  ('はげ'),
  ('ばいどく'),
  ('ばか'),
  ('ぱいおつ'),
  ('ひとごろし'),
  ('びっこ'),
  ('びっち'),
  ('びょうき'),
  ('ふぁっく'),
  ('ふうぞく'),
  ('ふぇら'),
  ('ぶさ'),
  ('ぶさいく'),
  ('ぶす'),
  ('ぶた'),
  ('ぶっころ'),
  ('へたくそ'),
  ('ぺすと'),
  ('ぺにす'),
  ('ほうけい'),
  ('ぼけ'),
  ('ぼっき'),
  ('まぬけ'),
  ('まんこ'),
  ('めくら'),
  ('りんびょう'),
  ('れいぷ'),
  ('ろりこん')
on conflict do nothing;

-- いま 入っている 名前にも 適用
select public.ng_apply();
