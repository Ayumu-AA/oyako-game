/* 画面の切りかえ。ゲームの中身は 各画面が持つ */
import { useCallback, useEffect, useState } from 'react';
import { missCount } from '../game/records';
import { store } from '../lib/storage';
import { startSync } from '../lib/sync';
import type { Mode } from '../game/types';
import { TitleScreen, SettingsOverlay, SubScreen, HowScreen, CountScreen } from './menus';
import { PlayScreen } from './PlayScreen';
import { ResultScreen } from './ResultScreen';
import { GeoScreen } from './GeoScreen';
import { BattleScreen, BResultScreen } from './BattleScreen';
import { CrossScreen, NumCrossScreen, CResultScreen } from './CrossScreen';
import { bestKey, groupOfMode, isGeo, loadSettings, type BattleResult, type CrossResult, type Group, type PlayResult, type Screen, type Settings } from './state';

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
  const [cwIdx, setCwIdx] = useState<number | null>(null);
  const [missN, setMissN] = useState(missCount());

  const change = useCallback((p: Partial<Settings>) => setS((x) => ({ ...x, ...p })), []);
  const go = useCallback((sc: Screen) => { setScreen(sc); window.scrollTo(0, 0); if (sc === 'title') setMissN(missCount()); }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);
  /* サーバーの記録を 取りこむ（取りこめたら まちがい帳の数を 出しなおす） */
  useEffect(() => { startSync(() => setMissN(missCount())); }, []);

  const openHow = (m: Mode) => { setMode(m); go('how'); };
  const onGroup = (g: Group | 'battle' | 'cross') => {
    if (g === 'battle' || g === 'cross') { openHow(g); return; }
    setGroup(g); go('sub');
  };
  const backFromHow = () => {
    const g = groupOfMode(mode);
    if (!g) go('title'); else { setGroup(g); go('sub'); }
  };
  const start = () => {
    if (mode === 'miss' && missCount() === 0) { go('title'); return; }
    setRound((r) => r + 1);
    if (mode === 'cross') { go('cross'); return; }
    if (mode === 'numcross') { go('numcross'); return; }
    go('count');
  };
  const afterCount = () => {
    setRound((r) => r + 1);
    if (isGeo(mode)) go('geo');
    else if (mode === 'battle') go('battle');
    else go('play');
  };
  const restart = () => { setRound((r) => r + 1); start(); };
  const quit = () => go('title');

  const finishPlay = (r: Omit<PlayResult, 'newBest'>) => {
    const key = bestKey(r.mode, s.level, s.seconds);
    const prev = Number(store(key) || 0);
    let newBest = false;
    if (r.score > prev) { store(key, String(r.score)); newBest = !(prev === 0 && r.score === 0); }
    setPr({ ...r, newBest }); setMissN(missCount()); go('result');
  };

  return (
    <div className="wrap">
      {screen === 'title' && <>
        <TitleScreen level={s.level} onLevel={(l) => change({ level: l })} onGroup={onGroup} onMode={openHow} onSettings={() => setSetOpen(true)} missN={missN} />
        <SettingsOverlay open={setOpen} seconds={s.seconds} onSeconds={(v) => change({ seconds: v })} onClose={() => setSetOpen(false)} onCleared={() => setMissN(0)} />
      </>}
      {screen === 'sub' && <SubScreen group={group} onMode={openHow} onBack={() => go('title')} />}
      {screen === 'how' && <HowScreen mode={mode} s={s} onChange={change} onStart={start} onBack={backFromHow} />}
      {screen === 'count' && <CountScreen mode={mode} role={s.role} onDone={afterCount} />}
      {screen === 'play' && <PlayScreen key={round} mode={mode} level={s.level} seconds={s.seconds} role={s.role} onFinish={finishPlay} onRestart={restart} onQuit={quit} onEmpty={() => go('title')} />}
      {screen === 'geo' && <GeoScreen key={round} mode={mode} level={s.level} seconds={s.seconds} onFinish={finishPlay} onRestart={restart} onQuit={quit} />}
      {screen === 'battle' && <BattleScreen key={round} level={s.level} seconds={s.seconds} bsubj={s.bsubj} handi={s.handi} goal={s.goal} onFinish={(r) => { setBr(r); go('bresult'); }} onRestart={restart} onQuit={quit} />}
      {screen === 'cross' && <CrossScreen key={round} level={s.level} kana={s.kana} prevIdx={cwIdx} onFinish={(r) => { setCr(r); if (r.idx !== undefined) setCwIdx(r.idx); go('cresult'); }} onRestart={restart} onQuit={quit} />}
      {screen === 'numcross' && <NumCrossScreen key={round} level={s.level} onFinish={(r) => { setCr(r); go('cresult'); }} onRestart={restart} onQuit={quit} />}
      {screen === 'result' && pr && <ResultScreen r={pr} onAgain={() => go('how')} onMiss={() => { if (missCount()) openHow('miss'); }} onTitle={() => go('title')} />}
      {screen === 'bresult' && br && <BResultScreen r={br} onAgain={() => go('how')} onTitle={() => go('title')} />}
      {screen === 'cresult' && cr && <CResultScreen r={cr} onAgain={() => { setRound((r) => r + 1); go(mode === 'numcross' ? 'numcross' : 'cross'); }} onTitle={() => go('title')} />}
    </div>
  );
}
