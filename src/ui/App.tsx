/* 画面の切りかえ。ゲームの中身は 各画面が持つ */
import { useCallback, useEffect, useRef, useState } from 'react';
import { missCount } from '../game/records';
import { store } from '../lib/storage';
import { startSync, enqueueScore, type ScoreRow } from '../lib/sync';
import { getNick } from '../lib/nickname';
import { rankable } from '../lib/ranking';
import { eventCode } from '../lib/config';
import { rankOf } from '../game/rank';
import { SOLO_SECONDS } from '../game/battle';
import { NameSheet, RankingScreen } from './Ranking';
import type { Mode } from '../game/types';
import { TitleScreen, LevelScreen, GamesScreen, SettingsOverlay, SubScreen, HowScreen, CountScreen, type Tile } from './menus';
import { PlayScreen } from './PlayScreen';
import { ResultScreen } from './ResultScreen';
import { GeoScreen } from './GeoScreen';
import { BattleScreen, BResultScreen } from './BattleScreen';
import { CrossScreen, NumCrossScreen, CResultScreen } from './CrossScreen';
import { bestKey, isGeo, loadSettings, type BattleResult, type CrossResult, type Group, type PlayResult, type Screen, type Settings } from './state';

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [mode, setMode] = useState<Mode>('pref');
  const [group, setGroup] = useState<Group>('relay');
  const [s, setS] = useState<Settings>(loadSettings);
  const [setOpen, setSetOpen] = useState(false);
  const [round, setRound] = useState(0);          // key を変えて ゲーム画面を 作りなおす
  const [pr, setPr] = useState<PlayResult | null>(null);
  const [br, setBr] = useState<BattleResult | null>(null);
  const [cr, setCr] = useState<CrossResult | null>(null);
  const [cwIdx, setCwIdx] = useState<number | null>(null);      // 前回 とき終えた 問題（つぎは 別の問題）
  const [cwForce, setCwForce] = useState<number | null>(null);  // 「さいしょから やりなおす」は 同じ問題
  const cwCur = useRef<number | null>(null);                    // いま 出ている 問題
  const [missN, setMissN] = useState(missCount());
  const [nick, setNick] = useState<string | null>(getNick());
  const [nameOpen, setNameOpen] = useState(false);
  const nameThen = useRef<(() => void) | null>(null);        // 名前が 決まったあとに すること
  const pendingScore = useRef<ScoreRow | null>(null);        // 名前が 無くて 送れなかった 今回の点数
  const [rankMode, setRankMode] = useState<Mode>('pref');
  const howGroup = useRef<Group | null>(null);   // あそびかた画面へ どこから来たか（もどる先）

  const change = useCallback((p: Partial<Settings>) => setS((x) => ({ ...x, ...p })), []);
  const go = useCallback((sc: Screen) => { setScreen(sc); window.scrollTo(0, 0); if (sc === 'title' || sc === 'games') setMissN(missCount()); }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);
  /* サーバーの記録を 取りこむ（取りこめたら まちがい帳の数を 出しなおす） */
  useEffect(() => { startSync(() => setMissN(missCount()), (n) => setNick(n)); }, []);

  /* 点数を ランキングに 送る。名前が 無ければ 取っておいて、名前が 決まったら 送る */
  const submitScore = (row: ScoreRow | null) => {
    if (!row) return;
    if (getNick()) { enqueueScore({ ...row, nickname: getNick()! }); pendingScore.current = null; }
    else pendingScore.current = row;
  };
  const askName = (then: () => void) => { nameThen.current = then; setNameOpen(true); };
  const onNamed = (n: string) => {
    setNick(n); setNameOpen(false);
    if (pendingScore.current) { enqueueScore({ ...pendingScore.current, nickname: n }); pendingScore.current = null; }
    const f = nameThen.current; nameThen.current = null; if (f) f();
  };
  const openRank = (m: Mode) => { setRankMode(rankable(m) ? m : 'pref'); go('rank'); };
  /* 結果画面の「ランキングを 見る」：名前が 無ければ 先に 決めてもらう */
  const rankFromResult = (m: Mode) => { if (getNick()) openRank(m); else askName(() => openRank(m)); };

  /* ホームの 入口は 3つとも 'battle' に 読みかえる（人数は もう 1画面目で 決まっている）。
     battle1 = 1人の はやおし、miss1 = 1人の まちがい直し（はやおしの きょうか＝まちがい） */
  const openHow = (m: Mode) => {
    const hasMiss = missCount() > 0;
    if (m === 'miss1') { setS((x) => ({ ...x, bsubj: 'miss' })); setMode('battle'); }
    else if (m === 'battle1' || m === 'battle') { setS((x) => ({ ...x, bsubj: (x.bsubj === 'miss' && !hasMiss) ? 'mix' : x.bsubj })); setMode('battle'); }
    else setMode(m);
    go('how');
  };
  /* ゲーム一覧で えらんだとき。教科が ある ゲーム（ヒントリレー・ちずクイズ）は もう1画面はさむ */
  const pickGame = (t: Tile) => {
    if (t.g) { howGroup.current = t.g; setGroup(t.g); go('sub'); return; }
    howGroup.current = null;
    openHow(t.m!);
  };
  const backFromHow = () => {
    if (howGroup.current) { setGroup(howGroup.current); go('sub'); } else go('games');
  };
  const start = (same = false) => {
    if (mode === 'miss' && missCount() === 0) { go('title'); return; }
    setRound((r) => r + 1);
    if (mode === 'cross') { setCwForce(same ? cwCur.current : null); go('cross'); return; }
    if (mode === 'numcross') { go('numcross'); return; }
    go('count');
  };
  const afterCount = () => {
    setRound((r) => r + 1);
    if (isGeo(mode)) go('geo');
    else if (mode === 'battle') go('battle');
    else go('play');
  };
  const restart = () => { setRound((r) => r + 1); start(true); };
  const quit = () => go('title');

  const finishPlay = (r: Omit<PlayResult, 'newBest'>) => {
    const key = bestKey(r.mode, s.level, s.seconds);
    const prev = Number(store(key) || 0);
    let newBest = false;
    if (r.score > prev) { store(key, String(r.score)); newBest = !(prev === 0 && r.score === 0); }
    setPr({ ...r, newBest }); setMissN(missCount()); go('result');
    if (rankable(r.mode)) {
      const kind = r.mode === 'math' ? 'math' : 'relay';
      submitScore({ event_code: eventCode(), mode: r.mode, level: s.level, seconds: r.seconds, score: r.score, rank_i: rankOf(kind, r.score, r.seconds).i, nickname: '' });
    } else pendingScore.current = null;
  };
  const finishBattle = (r: BattleResult) => {
    setBr(r); setMissN(missCount()); go('bresult');
    /* ランキングは「ひとりの はやおし・ふつうの出題」だけ。
       2人バトルは 勝ち負けを 楽しむもの（参加賞）で、2人ぶんの 合計点なので 同じ表に まぜない。
       まちがい直しは 人によって 出る問題が ちがうので くらべられない */
    if (r.players === 1 && !r.miss) {
      submitScore({ event_code: eventCode(), mode: 'battle1', level: s.level, seconds: r.seconds, score: r.child, rank_i: rankOf('relay', r.child, r.seconds).i, nickname: '' });
      const key = bestKey('battle1', s.level, r.seconds);
      if (r.child > Number(store(key) || 0)) store(key, String(r.child));
    } else pendingScore.current = null;
  };

  return (
    <div className="wrap">
      {screen === 'title' && <>
        <TitleScreen onPlayers={(p) => { change({ players: p }); go('level'); }} onSettings={() => setSetOpen(true)} onRank={() => openRank(mode)} />
        <SettingsOverlay open={setOpen} seconds={s.seconds} onSeconds={(v) => change({ seconds: v })} onClose={() => setSetOpen(false)} onCleared={() => setMissN(0)} nick={nick} onName={() => askName(() => undefined)} />
      </>}
      {screen === 'level' && <LevelScreen players={s.players} onLevel={(l) => { change({ level: l }); go('games'); }} onBack={() => go('title')} />}
      {screen === 'games' && <GamesScreen players={s.players} level={s.level} missN={missN} onPick={pickGame} onBack={() => go('level')} />}
      {screen === 'sub' && <SubScreen group={group} onMode={(m) => { howGroup.current = group; openHow(m); }} onBack={() => go('games')} />}
      {screen === 'how' && <HowScreen mode={mode} s={s} onChange={change} onStart={() => start()} onBack={backFromHow} />}
      {screen === 'count' && <CountScreen mode={mode} role={s.role} players={s.players} onDone={afterCount} />}
      {screen === 'play' && <PlayScreen key={round} mode={mode} level={s.level} seconds={s.seconds} role={s.role} onFinish={finishPlay} onRestart={restart} onQuit={quit} onEmpty={() => go('title')} />}
      {screen === 'geo' && <GeoScreen key={round} mode={mode} level={s.level} seconds={s.seconds} onFinish={finishPlay} onRestart={restart} onQuit={quit} />}
      {screen === 'battle' && <BattleScreen key={round} level={s.level} bsubj={s.bsubj} handi={s.handi} goal={s.players === 1 ? 0 : s.goal} players={s.players}
        seconds={s.players === 1 ? SOLO_SECONDS : s.seconds} onFinish={finishBattle} onRestart={restart} onQuit={quit} />}
      {screen === 'cross' && <CrossScreen key={round} level={s.level} kana={s.kana} players={s.players} prevIdx={cwIdx} forceIdx={cwForce} onIdx={(i) => { cwCur.current = i; }} onFinish={(r) => { setCr(r); if (r.idx !== undefined) setCwIdx(r.idx); go('cresult'); }} onRestart={restart} onQuit={quit} />}
      {screen === 'numcross' && <NumCrossScreen key={round} level={s.level} onFinish={(r) => { setCr(r); go('cresult'); }} onRestart={restart} onQuit={quit} />}
      {screen === 'result' && pr && <ResultScreen r={pr} onAgain={() => go('how')} onMiss={() => { if (missCount()) openHow('miss'); }} onTitle={() => go('title')} onRank={rankable(pr.mode) ? () => rankFromResult(pr.mode) : undefined} />}
      {screen === 'bresult' && br && <BResultScreen r={br} onAgain={() => go('how')} onMiss={() => { if (missCount()) openHow('miss'); }} onTitle={() => go('title')} onRank={() => rankFromResult('battle1')} />}
      {screen === 'rank' && <RankingScreen mode0={rankMode} level0={s.level} nick={nick} onBack={() => go('title')} onName={() => askName(() => undefined)} />}
      <NameSheet open={nameOpen} level={s.level} onDone={onNamed} onCancel={() => { setNameOpen(false); nameThen.current = null; }} />
      {screen === 'cresult' && cr && <CResultScreen r={cr} onAgain={() => { setRound((r) => r + 1); go(mode === 'numcross' ? 'numcross' : 'cross'); }} onTitle={() => go('title')} />}
    </div>
  );
}
