/* 音の テスト。ブラウザの 音の しくみ（Web Audio）を 偽物に 置きかえて、
   どんな音を 組み立てているかを 見る。耳では 聞けないので「形」で たしかめる */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setKV, memoryKV } from './storage';

/* ---- 偽の Web Audio ---- */
interface FakeOsc { type: string; freq: number; start: number; stop: number; gain: number; to: string }
function fakeAudio() {
  const oscs: FakeOsc[] = [];
  const gains: { id: string; vals: [number, number][]; to: string }[] = [];
  const filters: { type: string; freq: number }[] = [];
  let comp = 0;
  let n = 0;
  const mkGain = () => {
    const id = 'g' + (++n);
    const rec: { id: string; vals: [number, number][]; to: string } = { id, vals: [], to: '' };
    gains.push(rec);
    const node = {
      id,
      gain: {
        value: 0,
        setValueAtTime: (v: number, t: number) => rec.vals.push([v, t]),
        exponentialRampToValueAtTime: (v: number, t: number) => rec.vals.push([v, t]),
      },
      connect: (d: { id?: string; kind?: string }) => { rec.to = d.id || d.kind || 'dest'; },
    };
    return node;
  };
  const ctx = {
    currentTime: 0,
    state: 'running',
    resume: () => undefined,
    destination: { kind: 'dest' },
    createGain: mkGain,
    createBiquadFilter: () => {
      const f = { type: '', freq: 0 };
      filters.push(f);
      return {
        kind: 'filter',
        get type() { return f.type; }, set type(v: string) { f.type = v; },
        frequency: { setValueAtTime: (v: number) => { f.freq = v; } },
        Q: { setValueAtTime: () => undefined },
        connect: () => undefined,
      };
    },
    createDynamicsCompressor: () => {
      comp++;
      const p = () => ({ setValueAtTime: () => undefined });
      return { kind: 'comp', threshold: p(), knee: p(), ratio: p(), attack: p(), release: p(), connect: () => undefined };
    },
    createOscillator: () => {
      const o: FakeOsc = { type: '', freq: 0, start: -1, stop: -1, gain: 1, to: '' };
      oscs.push(o);
      return {
        get type() { return o.type; }, set type(v: string) { o.type = v; },
        frequency: { setValueAtTime: (v: number) => { o.freq = v; } },
        connect: (d: { id?: string }) => { o.to = d.id || ''; },
        start: (t: number) => { o.start = t; },
        stop: (t: number) => { o.stop = t; },
      };
    },
  };
  (globalThis as unknown as { window: unknown }).window = {
    AudioContext: function () { return ctx; },
    /* BGM は くりかえしの タイマーを つかう。鳴らす 中身だけ 見たいので 空まわりさせる */
    setInterval: () => 1, clearInterval: () => undefined,
  };
  return { oscs, gains, filters, compCount: () => comp };
}

/* ---- 毎回 まっさらな sound.ts を 読みこむ（AudioContext を 持ち回るため） ---- */
async function loadSound() {
  vi.resetModules();
  setKV(memoryKV());
  return await import('./sound');
}

beforeEach(() => { setKV(memoryKV()); });

describe('おてつきの 音（ブッブー）', () => {
  it('のこぎり波の ブザーで、「ブッ」と「ブー」の 2回 鳴る', async () => {
    const f = fakeAudio();
    const S = await loadSound();
    S.sndNG();
    expect(f.oscs.length, '音が 1つも 作られていない').toBeGreaterThan(0);
    /* きれいな ピー音（triangle / sine）では なく、ざらっとした のこぎり波 */
    expect(f.oscs.every((o) => o.type === 'sawtooth'), '波の形が のこぎりでない').toBe(true);
    /* 2回に 分かれている（NG_HITS の 時刻） */
    const starts = [...new Set(f.oscs.map((o) => Math.round(o.start * 1000)))].sort((a, b) => a - b);
    expect(starts).toEqual(S.NG_HITS.map(([at]) => Math.round(at * 1000)));
    /* 2回目のほうが 低い（ブッ→ブー） */
    const hi = Math.max(...f.oscs.filter((o) => o.start === S.NG_HITS[0][0]).map((o) => o.freq));
    const lo = Math.max(...f.oscs.filter((o) => o.start === S.NG_HITS[1][0]).map((o) => o.freq));
    expect(lo, '2回目が 低くなっていない').toBeLessThan(hi);
    /* 低い ブザーの 高さ（200Hzあたり）。高い ピー音に なっていない */
    expect(Math.max(...f.oscs.map((o) => o.freq))).toBeLessThan(260);
  });

  it('うなりと 太さの ために 1発あたり 3つ かさねる', async () => {
    const f = fakeAudio();
    const S = await loadSound();
    S.sndNG();
    expect(f.oscs.length).toBe(S.NG_HITS.length * 3);
    const first = f.oscs.filter((o) => o.start === S.NG_HITS[0][0]).map((o) => o.freq).sort((a, b) => a - b);
    expect(first.length).toBe(3);
    expect(first[0]).toBeCloseTo(first[1] / 2, 0);          /* 1オクターブ下が ある */
    expect(first[2] / first[1]).toBeGreaterThan(1.001);      /* すこし ずらした音が ある（うなり） */
    expect(first[2] / first[1]).toBeLessThan(1.02);
  });

  it('高い音を けずる フィルターを 通す（耳に ささらない）', async () => {
    const f = fakeAudio();
    const S = await loadSound();
    S.sndNG();
    expect(f.filters.length).toBe(S.NG_HITS.length);
    expect(f.filters.every((x) => x.type === 'lowpass')).toBe(true);
    expect(f.filters.every((x) => x.freq <= 2000)).toBe(true);
  });
});

describe('大きさ', () => {
  it('ぜんぶの 音が リミッターを 通る（かさなっても われない）', async () => {
    const f = fakeAudio();
    const S = await loadSound();
    S.sndOK(10);                      /* いちばん 音数の 多い お祝い */
    S.sndNG();
    expect(f.compCount(), 'リミッターが ない').toBe(1);   /* 1つを 使いまわす */
  });

  it('前より 大きい（BOOST が きいている）', async () => {
    const f = fakeAudio();
    const S = await loadSound();
    expect(S.BOOST).toBeGreaterThan(1.5);
    S.beep(880, 0, 0.1, 0.16);
    /* beep の 山の 大きさ。前は 0.16 だった */
    const peak = Math.max(...f.gains.flatMap((g) => g.vals.map(([v]) => v)));
    expect(peak).toBeGreaterThan(0.3);
    expect(peak, 'われるほど 大きい').toBeLessThanOrEqual(0.95);
  });

  it('大きくしすぎても 0.95 で 止める', async () => {
    const f = fakeAudio();
    const S = await loadSound();
    S.beep(440, 0, 0.1, 0.9);
    const peak = Math.max(...f.gains.flatMap((g) => g.vals.map(([v]) => v)));
    expect(peak).toBeLessThanOrEqual(0.95);
  });
});

describe('音の 大きさ（4だんかい・10/20）', () => {
  it('なし＝0、小＜ふつう＜大', async () => {
    const S = await loadSound();
    expect(S.VOL_MUL[0]).toBe(0);
    expect(S.VOL_MUL[1]).toBeLessThan(S.VOL_MUL[2]);
    expect(S.VOL_MUL[2]).toBeLessThan(S.VOL_MUL[3]);
  });
  it('こうかおんと BGM は べつべつに 決められる', async () => {
    fakeAudio();
    const S = await loadSound();
    S.setSfxVol(3); S.setBgmVol(1);
    expect(S.sfxVol()).toBe(3);
    expect(S.bgmVol()).toBe(1);
    S.setSfxVol(0);
    expect(S.sfxVol()).toBe(0);
    expect(S.bgmVol()).toBe(1);   /* かたほうを 0に しても もう一方は そのまま */
  });
  it('「なし」は 音を 1つも 作らない', async () => {
    const f = fakeAudio();
    const S = await loadSound();
    S.setSfxVol(0);
    const before = f.oscs.length;
    S.sndNG(); S.sndOK(1);
    expect(f.oscs.length, '音が 鳴っている').toBe(before);
  });
  it('大きいほど 音が 大きい（同じ音で くらべる）', async () => {
    const peak = async (v: 1 | 2 | 3) => {
      const f = fakeAudio();
      const S = await loadSound();
      S.setSfxVol(v);
      f.gains.length = 0;
      S.sndNG();
      return Math.max(...f.gains.flatMap((g) => g.vals.map(([v]) => v)));
    };
    const s1 = await peak(1), s2 = await peak(2), s3 = await peak(3);
    expect(s1).toBeLessThan(s2);
    expect(s2).toBeLessThanOrEqual(s3);
  });
  it('前の ばんの せってい（あり／なし）も そのまま つかえる', async () => {
    fakeAudio();
    const S = await loadSound();
    S.setBgm(true); expect(S.bgmVol()).toBe(2); expect(S.bgmOn()).toBe(true);
    S.setBgm(false); expect(S.bgmVol()).toBe(0); expect(S.bgmOn()).toBe(false);
    S.setSound(true); expect(S.soundOn()).toBe(true);
    S.setSound(false); expect(S.soundOn()).toBe(false);
  });
});

describe('はやおし中の 音楽（10/22）', () => {
  it('ふつうの BGM とは べつの つまみ', async () => {
    fakeAudio();
    const S = await loadSound();
    S.setBgmVol(0); S.setBattleVol(3);
    expect(S.bgmVol()).toBe(0);
    expect(S.battleVol()).toBe(3);
    S.setBattleVol(0);
    expect(S.battleVol()).toBe(0);
    expect(S.bgmVol()).toBe(0);
  });
  it('はじめから「ふつう」で 鳴る（たのまれて 入れたので）', async () => {
    const S = await loadSound();
    expect(S.battleVol()).toBe(2);
  });
  it('ふつうの BGM より 速く 刻む', async () => {
    const f = fakeAudio();
    const S = await loadSound();
    S.setBattleVol(2);
    S.startBattleBgm();
    expect(f.oscs.length, '音が 作られていない').toBeGreaterThan(0);
    S.stopBattleBgm();
  });
  it('低い刻みと 上の音の 2段がさね。短調（明るくしない）', async () => {
    const f = fakeAudio();
    const S = await loadSound();
    S.setBattleVol(2);
    S.startBattleBgm();
    const freqs = f.oscs.map((o) => o.freq);
    expect(Math.min(...freqs), '低い刻みが ない').toBeLessThan(200);
    expect(Math.max(...freqs), '上の音が ない').toBeGreaterThan(400);
    S.stopBattleBgm();
  });
  it('「なし」なら 音を 1つも 作らない', async () => {
    const f = fakeAudio();
    const S = await loadSound();
    S.setBattleVol(0);
    const before = f.oscs.length;
    S.startBattleBgm();
    expect(f.oscs.length).toBe(before);
    S.stopBattleBgm();
  });
  it('はやおしが おわったら ふつうの BGM に もどる', async () => {
    fakeAudio();
    const S = await loadSound();
    S.setBgmVol(2); S.setBattleVol(2);
    S.startBattleBgm();
    S.stopBattleBgm();
    expect(S.bgmVol()).toBe(2);   /* つまみは さわらない */
  });
});

describe('ふつうの BGM と はやおしの 音楽は 重ならない', () => {
  it('はやおし中は ふつうの BGM を 止める', async () => {
    fakeAudio();
    const S = await loadSound();
    S.setBgmVol(2); S.setBattleVol(2);
    S.startBattleBgm();
    S.startBgm();              /* よばれても 鳴らさない */
    S.stopBattleBgm();
    expect(S.bgmVol()).toBe(2);
    expect(S.battleVol()).toBe(2);
  });
});
