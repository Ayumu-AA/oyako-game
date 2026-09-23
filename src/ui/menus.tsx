/* ホーム3ステップ（何人で → がくねん → ゲーム）・教科えらび・あそびかた・カウントダウン・せってい・ルール */
import { useEffect, useRef, useState } from 'react';
import { CONFIG, MODE_NAME, MODE_SUB, MODE_TAG, MODE_LABEL, GROUPS, HOW_LEDE, STEPS_MISS, STEPS_HINT, STEPS_GEO, STEPS_NUM, STEPS_CROSS, STEPS_CROSS1, STEPS_BATTLE, STEPS_BATTLE1, STEPS_MATH } from '../data/texts';
import { ICON, GROUP_ICON, TILE_ICON } from '../data/icons';
import { missCount, seenCount, clearRecords } from '../game/records';
import { store } from '../lib/storage';
import { soundOn, setSound } from '../lib/sound';
import type { Level, Mode } from '../game/types';
import { PickGrid, Raw } from './parts';
import { plowMark } from '../data/logo';
import { bestKey, isGeo, type Group, type Settings } from './state';

const MN = MODE_NAME as Record<string, string>;
const G = GROUPS as Record<Group, { eyebrow: string; title: string; lede: string; note: string; modes: string[] }>;
/* はやおし（ひとり）は 教科アイコンが ないので、ホームの タイルと 同じ絵を つかう */
const ICONS: Record<string, string> = { ...(ICON as Record<string, string>), battle1: (GROUP_ICON as Record<string, string>).battle };
const TI = TILE_ICON as Record<string, string>;

/* タイルの絵。TILE_ICON に 無いものだけ ここで 作る（線の色は currentColor＝文字と同じ） */
const svgText = (t: string, size: number) =>
  '<svg viewBox="0 0 24 24" aria-hidden="true"><text x="12" y="17" text-anchor="middle" font-size="' + size +
  '" font-weight="900" font-family="system-ui,sans-serif" fill="currentColor">' + t + '</text></svg>';
const LINE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const TILE_SVG: Record<string, string> = {
  p2: TI.relay, p1: TI.solo,
  lv1: svgText('1-3', 11), lv2: svgText('4-6', 11),
  relay: TI.relay, battle: TI.battle, battle1: TI.battle, cross: TI.cross, geo: TI.geo,
  math: svgText('=10', 12),
  numcross: LINE + '<rect x="3.2" y="3.2" width="7.6" height="7.6"/><rect x="13.2" y="3.2" width="7.6" height="7.6"/><rect x="3.2" y="13.2" width="7.6" height="7.6"/><rect x="13.2" y="13.2" width="7.6" height="7.6"/></svg>',
  miss: TI.miss, miss1: TI.miss,
};

/** ホームの タイル1つぶん。g（教科えらびへ）か m（あそびかたへ）の どちらかを 持つ */
export interface Tile { k: string; g?: Group; m?: Mode; b: string; s: string }
export const GAMES: Record<1 | 2, Tile[]> = {
  2: [
    { k: 'relay', g: 'relay', b: '親子ヒントリレー', s: '6つの きょうか' },
    { k: 'battle', m: 'battle', b: 'はやおしバトル', s: '向かい合って 対戦' },
    { k: 'cross', m: 'cross', b: '親子クロスワード', s: '力を合わせて 完成' },
    { k: 'geo', g: 'geo', b: 'ちずクイズ', s: '地図で 場所さがし' },
  ],
  1: [
    { k: 'battle1', m: 'battle1', b: 'はやおしクイズ', s: '4たくで 早おし' },
    { k: 'geo', g: 'geo', b: 'ちずクイズ', s: '地図で 場所さがし' },
    { k: 'math', m: 'math', b: '10を作る', s: '数で 10を つくる' },
    { k: 'numcross', m: 'numcross', b: 'けいさんクロス', s: '計算を そろえる' },
    { k: 'cross', m: 'cross', b: 'クロスワード', s: 'ことばで マスうめ' },
  ],
};

function TileBtn({ t, wide, onClick }: { t: Tile; wide?: boolean; onClick: () => void }) {
  return (
    <button className={'mode' + (wide ? ' wide' : '')} data-tile={t.k} data-group={t.g} data-mode={t.m} onClick={onClick}>
      <Raw className="icon" html={TILE_SVG[t.k]} />
      <span><b>{t.b}</b><small>{t.s}</small></span>
    </button>
  );
}

/* ===== 1．何人で あそぶ ===== */
export function TitleScreen({ onPlayers, onSettings, onRank }: {
  onPlayers: (p: 1 | 2) => void; onSettings: () => void; onRank: () => void;
}) {
  return (
    <section className="screen on colortiles" id="s-title">
      <div className="howhead">
        <div className="brandmark">
          <Raw as="div" className="pin" html={plowMark(22)} />
          <span id="brand-title">{[CONFIG.schoolName, CONFIG.eventName].filter(Boolean).join('\u3000')}</span>
        </div>
        <button type="button" className="rulesbtn" id="btn-rank-title" onClick={onRank}>
          <span className="qm" aria-hidden="true">👑</span>ランキング
        </button>
        <button type="button" className="rulesbtn" id="btn-settings" onClick={onSettings}>
          <span className="qm" aria-hidden="true">⚙</span>せってい
        </button>
      </div>
      <div className="titlelede">
        <h1 className="display">親子ゲーム</h1>
      </div>
      <p className="lede" id="title-q">何人で あそぶ？</p>

      <div className="modes" id="players-modes">
        <button className="mode tall" data-tile="p1" data-players="1" id="btn-p1" onClick={() => onPlayers(1)}>
          <Raw className="icon" html={TILE_SVG.p1} />
          <span><b>1人で あそぶ</b><small>じぶんの ペースで</small></span>
        </button>
        <button className="mode tall" data-tile="p2" data-players="2" id="btn-p2" onClick={() => onPlayers(2)}>
          <Raw className="icon" html={TILE_SVG.p2} />
          <span><b>2人で あそぶ</b><small>おとなと こども</small></span>
        </button>
      </div>

      <div className="spacer"></div>
      <p className="foot" id="brand-foot"><Raw as="span" className="footmark" html={plowMark(14)} />presented by {CONFIG.schoolName}</p>
    </section>
  );
}

/* ===== 2．がくねん ===== */
export function LevelScreen({ players, onLevel, onBack }: { players: 1 | 2; onLevel: (l: Level) => void; onBack: () => void }) {
  return (
    <section className="screen on colortiles" id="s-level">
      <p className="eyebrow" id="level-eyebrow">{players === 2 ? '2人で あそぶ' : '1人で あそぶ'}</p>
      <h1 className="display">がくねんは？</h1>
      <p className="lede">がくねんで 問題の むずかしさが かわります。</p>
      <div className="modes" id="level-modes">
        <button className="mode wide" data-tile="lv1" data-level="1" id="btn-lv1" onClick={() => onLevel(1)}>
          <Raw className="icon" html={TILE_SVG.lv1} />
          <span><b>ていがくねん</b><small>1〜3年生</small></span>
        </button>
        <button className="mode wide" data-tile="lv2" data-level="2" id="btn-lv2" onClick={() => onLevel(2)}>
          <Raw className="icon" html={TILE_SVG.lv2} />
          <span><b>こうがくねん</b><small>4〜6年生</small></span>
        </button>
      </div>
      <div className="spacer"></div>
      <button className="btn btn-ghost" id="btn-level-back" onClick={onBack}>もどる</button>
    </section>
  );
}

/* ===== 3．あそぶ ゲーム ===== */
export function GamesScreen({ players, level, missN, onPick, onBack }: {
  players: 1 | 2; level: Level; missN: number; onPick: (t: Tile) => void; onBack: () => void;
}) {
  const list = GAMES[players];
  /* まちがい直しは 2人なら ヒントリレー方式、1人なら はやおしの「まちがい」で 出す */
  const miss: Tile = players === 2
    ? { k: 'miss', m: 'miss', b: 'まちがい直し', s: 'のこり ' + missN + 'もん' }
    : { k: 'miss1', m: 'miss1', b: 'まちがい直し', s: 'のこり ' + missN + 'もん・はやおしで' };
  return (
    <section className="screen on colortiles" id="s-games">
      <p className="eyebrow" id="games-eyebrow">{(players === 2 ? '2人で あそぶ' : '1人で あそぶ') + '・' + (level === 1 ? 'ていがくねん' : 'こうがくねん')}</p>
      <h1 className="display">どれで あそぶ？</h1>
      <div className="modes" id="game-modes">
        {list.map((t, i) => (
          /* 数が 奇数のときは 最後の1つを 横いっぱいにして すき間を 作らない */
          <TileBtn key={t.k} t={t} wide={list.length % 2 === 1 && i === list.length - 1} onClick={() => onPick(t)} />
        ))}
        {missN > 0 && <TileBtn t={miss} wide onClick={() => onPick(miss)} />}
      </div>
      <div className="spacer"></div>
      <button className="btn btn-ghost" id="btn-games-back" onClick={onBack}>もどる</button>
    </section>
  );
}

/* ===== せってい ===== */
export function SettingsOverlay({ open, seconds, onSeconds, onClose, onCleared, nick, onName }: { open: boolean; seconds: number; onSeconds: (s: number) => void; onClose: () => void; onCleared: () => void; nick: string | null; onName: () => void }) {
  const [snd, setSnd] = useState(soundOn());
  const [rec, setRec] = useState({ miss: 0, seen: 0 });
  const [sure, setSure] = useState<0 | 1 | 2>(0);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose); onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    setRec({ miss: missCount(), seen: seenCount() }); setSure(0);
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  const clearLabel = sure === 0 ? 'まちがい帳と 出題きろくを 消す' : sure === 1 ? '本当に 消す？（もう一度 おす）' : '消しました';
  return (
    <div className="overlay" id="set-ov" hidden={!open} role="dialog" aria-modal="true" aria-labelledby="set-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sheet setsheet">
        <h2 className="display" id="set-title">せってい</h2>
        <PickGrid id="seg-sound" label="おと" cols={2} value={snd ? '1' : '0'} onPick={(v) => { setSound(v === '1'); setSnd(v === '1'); }}
          options={[{ v: '1', b: 'あり' }, { v: '0', b: 'なし' }]} />
        <PickGrid id="seg-time" label="せいげん時間" cols={3} value={seconds} onPick={onSeconds}
          options={[{ v: 60, b: '60秒' }, { v: 90, b: '90秒' }, { v: 120, b: '120秒' }]} />
        <div className="pickrow">
          <span className="picklabel">ランキングの なまえ</span>
          <button type="button" className="btn btn-ghost" id="btn-set-name" style={{ fontSize: 14, padding: '11px 14px' }} onClick={onName}>{nick ? nick + '　（かえる）' : 'なまえを きめる'}</button>
        </div>
        <div className="pickrow">
          <span className="picklabel">きろく（この端末だけ）</span>
          <p className="setnote" id="set-rec">まちがい帳 {rec.miss}もん ／ 出題きろく {rec.seen}もん</p>
          <button type="button" className="btn btn-ghost" id="btn-clear-rec" style={{ fontSize: 14, padding: '11px 14px' }}
            onClick={() => {
              if (sure === 0) { setSure(1); return; }
              if (sure === 1) { clearRecords(); setRec({ miss: 0, seen: 0 }); setSure(2); onCleared(); setTimeout(() => setSure(0), 1600); }
            }}>{clearLabel}</button>
        </div>
        <p className="setnote" id="build-id" style={{ textAlign: 'center', opacity: .7 }}>ばんごう {__BUILD__}</p>
        <button className="btn btn-ok" id="btn-set-close" style={{ fontSize: 18, padding: '15px 18px' }} ref={closeBtn} onClick={onClose}>とじる</button>
      </div>
    </div>
  );
}

/* ===== グループの中身 ===== */
export function SubScreen({ group, onMode, onBack }: { group: Group; onMode: (m: Mode) => void; onBack: () => void }) {
  const g = G[group];
  return (
    <section className="screen on" id="s-sub">
      <p className="eyebrow" id="sub-eyebrow">{g.eyebrow}</p>
      <h1 className="display" id="sub-title">{g.title}</h1>
      <Raw as="p" className="lede" id="sub-lede" html={g.lede} />
      <div className="modes" id="sub-modes">
        {g.modes.map((m) => (
          <button className="mode" data-mode={m} key={m} onClick={() => onMode(m as Mode)}>
            <Raw className="icon" html={ICONS[m]} />
            <span><b>{(MODE_LABEL as Record<string, string>)[m]}</b><small>{(MODE_TAG as Record<string, string>)[m] || (MODE_SUB as Record<string, string>)[m]}</small></span>
          </button>
        ))}
      </div>
      <p className="best" id="sub-note">{g.note}</p>
      <div className="spacer"></div>
      <button className="btn btn-ghost" data-back="s-title" onClick={onBack}>もどる</button>
    </section>
  );
}

/* ===== あそびかた＋やくわり ===== */
function stepsFor(mode: Mode, players: 1 | 2): string[] {
  const S = (x: unknown) => x as string[];
  if (mode === 'battle' && players === 1) return S(STEPS_BATTLE1);
  if (mode === 'cross' && players === 1) return S(STEPS_CROSS1);
  if (mode === 'miss') return S(STEPS_MISS);
  if (isGeo(mode)) return S(STEPS_GEO);
  if (mode === 'numcross') return S(STEPS_NUM);
  if (mode === 'cross') return S(STEPS_CROSS);
  if (mode === 'battle') return S(STEPS_BATTLE);
  if (mode === 'math') return S(STEPS_MATH);
  return S(STEPS_HINT);
}
export function bestLine(mode: Mode, s: Settings): string {
  if (mode === 'battle' && s.bsubj === 'miss') return 'まちがい帳に ' + missCount() + 'もん たまっています';
  /* はやおし（ひとり）は いつも せいげん時間。この端末の ベストを 出す */
  if (mode === 'battle' && s.players === 1) {
    const b = store(bestKey('battle1', s.level, s.seconds));
    return b ? 'この端末のベスト　' + s.seconds + '秒で ' + b + 'もん' : 'この端末にはまだ記録がありません';
  }
  if (mode === 'battle' || mode === 'cross' || mode === 'numcross' || mode === 'miss') {
    return mode === 'miss' ? 'まちがい帳に ' + missCount() + 'もん たまっています' : '';
  }
  const v = store(bestKey(mode, s.level, s.seconds));
  return v ? 'この端末のベスト　' + s.seconds + '秒で ' + v + 'もん' : 'この端末にはまだ記録がありません';
}

export function HowScreen({ mode, s, onChange, onStart, onBack }: { mode: Mode; s: Settings; onChange: (p: Partial<Settings>) => void; onStart: () => void; onBack: () => void }) {
  const [rules, setRules] = useState(false);
  const isBattle = mode === 'battle', isCross = mode === 'cross', isNum = mode === 'numcross', isMath = mode === 'math', geo = isGeo(mode);
  const solo = isBattle && s.players === 1;
  const soloCross = isCross && s.players === 1;   /* 1人の クロスワード：役わりの わりふりは 出さない */
  const missN = missCount();
  const showRole = !(isMath || isBattle || isCross || isNum || geo);
  const closeBtn = useRef<HTMLButtonElement>(null);
  useEffect(() => { setRules(false); }, [mode]);
  useEffect(() => {
    if (!rules) return;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setRules(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [rules]);
  return (
    <>
      <section className="screen on" id="s-how">
        <div className="howhead">
          <div className="howttl">
            <p className="eyebrow">あそぶ ゲーム<span className="lvchip" id="how-lv">{s.level === 1 ? 'ていがくねん' : 'こうがくねん'}</span></p>
            <h2 id="how-title">{solo ? MN.battle1 : soloCross ? MN.cross1 : MN[mode]}</h2>
          </div>
          <button type="button" className="rulesbtn" id="btn-rules" onClick={() => setRules(true)}>
            <span className="qm" aria-hidden="true">?</span>ルールを見る
          </button>
        </div>

        <Raw as="p" className="howlede" id="how-lede" html={(HOW_LEDE as Record<string, string>)[solo ? 'battle1' : soloCross ? 'cross1' : mode] || (HOW_LEDE as Record<string, string>).pref} />

        <div className="spacer top"></div>

        <div className="rolesplit" id="cross-roles" hidden={!isCross || soloCross}>
          <div className="rs yoko"><b>ヨコのカギ</b><span className="arrow">→</span><span className="who">こども</span></div>
          <div className="rs tate"><b>タテのカギ</b><span className="arrow">↓</span><span className="who">おとな</span></div>
        </div>

        {isBattle && <PickGrid id="seg-subject" label="きょうか" cols={5} value={s.bsubj} onPick={(v) => onChange({ bsubj: v })}
          options={([{ v: 'mix', b: 'ミックス' }, { v: 'pref', b: '都道府県' }, { v: 'flag', b: '国旗' }, { v: 'kokugo', b: 'ことば' }, { v: 'rika', b: 'りか' }, { v: 'rekishi', b: 'れきし' }, { v: 'eigo', b: 'えいご' }, { v: 'calc', b: 'けいさん' }, { v: 'moji', b: 'もじあて' }] as { v: Settings['bsubj']; b: string }[])
            .concat(missN > 0 ? [{ v: 'miss' as Settings['bsubj'], b: 'まちがい' }] : [])} />}

        {/* ひとりモードは せいげん時間だけ。〇もん先取は 相手が いてこそ */}
        {isBattle && !solo && <PickGrid id="seg-goal" label="しょうぶの きめかた" cols={3} value={s.goal} onPick={(v) => { onChange({ goal: v }); store('oyako-goal', String(v)); }}
          options={[{ v: 5, b: '5もん', s: '先に とったら かち' }, { v: 10, b: '10もん', s: '先に とったら かち' }, { v: 0, b: 'じかん', s: 'せいげん時間まで' }]} />}

        {isBattle && !solo && <PickGrid id="seg-handi" label="おとなの ハンデ" cols={3} value={s.handi} onPick={(v) => onChange({ handi: v })}
          options={[{ v: 0, b: 'なし', s: '3たく・3たく' }, { v: 1, b: 'ふつう', s: '子2・親4' }, { v: 2, b: 'たっぷり', s: '子2・親6' }]} />}

        {isCross && <PickGrid id="seg-kana" label="もじの 入れかた" cols={3} value={s.kana} onPick={(v) => { onChange({ kana: v }); store('oyako-kana', v); }}
          options={[{ v: 'R' as const, b: 'みぎから', s: '五十音表と 同じ' }, { v: 'L' as const, b: 'ひだりから', s: 'あ か さ た な…' }, { v: 'F' as const, b: 'フリック', s: 'スマホと 同じ' }]} />}

        <div className="pickrow" id="row-role" hidden={!showRole}>
          <span className="picklabel" id="role-label">スマホを持つのは？（ヒントを出す人）</span>
          <div className="roles" id="roles">
            <button className="role" data-role="child" aria-pressed={s.role === 'child'} onClick={() => onChange({ role: 'child' })}>
              <div className="face" aria-hidden="true">🧒</div>
              <b>こども</b><small>こどもが出題する</small>
            </button>
            <button className="role" data-role="adult" aria-pressed={s.role === 'adult'} onClick={() => onChange({ role: 'adult' })}>
              <div className="face" aria-hidden="true">🧑</div>
              <b>おとな</b><small>おとなが出題する</small>
            </button>
          </div>
        </div>

        <p className="best" id="best-line">{bestLine(mode, s)}</p>
        <div className="spacer"></div>
        <button className="btn btn-go" id="btn-start" onClick={onStart}>はじめる</button>
        <button className="btn btn-ghost" id="btn-how-back" onClick={onBack}>もどる</button>
      </section>

      <div className="overlay" id="rules-ov" hidden={!rules} role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={(e) => { if (e.target === e.currentTarget) setRules(false); }}>
        <div className="sheet rulesheet">
          <h2 className="display" id="rules-title">あそびかた</h2>
          <p className="rulesmode" id="rules-mode">{solo ? MN.battle1 : soloCross ? MN.cross1 : MN[mode]}</p>
          <div className="steps" id="steps">
            {stepsFor(mode, s.players).map((t, i) => (
              <div className="step" key={i}><div className="num">{i + 1}</div><Raw as="p" html={t} /></div>
            ))}
          </div>
          <button className="btn btn-ok" id="btn-rules-close" style={{ fontSize: 18, padding: '15px 18px' }} ref={closeBtn} onClick={() => setRules(false)}>わかった</button>
        </div>
      </div>
    </>
  );
}

/* ===== カウントダウン ===== */
export function CountScreen({ mode, role, players, onDone }: { mode: Mode; role: 'child' | 'adult'; players: 1 | 2; onDone: () => void }) {
  const isB = mode === 'battle' && players === 2;   /* 向かい合う 案内は 2人のときだけ */
  const fast = mode === 'battle';
  const [n, setN] = useState(3);
  const done = useRef(onDone); done.current = onDone;
  useEffect(() => {
    let k = 3; setN(3);
    const iv = setInterval(() => {
      k--;
      if (k > 0) setN(k);
      else { clearInterval(iv); done.current(); }
    }, fast ? 1000 : 800);
    return () => clearInterval(iv);
  }, [fast]);
  const note = isB ? '' : mode === 'battle' ? 'できるだけ 早く こたえてね' : isGeo(mode) ? 'おとなが 名前を 読んであげてね' : mode === 'math' ? 'じぶんのペースで だいじょうぶ' : (role === 'child' ? 'こども' : 'おとな') + 'がスマホを持ってね';
  return (
    <section className="screen on" id="s-count">
      <div className="orient" id="count-orient" hidden={!isB}>
        <div className="o child"><b>こども</b><small>こちら側に すわる</small></div>
        <div className="mid"><span>スマホを 机に置いて 向かい合ってね</span><span className="n" id="count-num2">{n}</span></div>
        <div className="o adult"><b>おとな</b><small>こちら側に すわる</small></div>
      </div>
      <div className="count display" id="count-num" hidden={isB}>{n}</div>
      <p className="best" id="count-note" hidden={isB}>{note}</p>
    </section>
  );
}
