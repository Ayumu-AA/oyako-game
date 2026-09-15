/* 結果（親子ヒントリレー・10を作る・ちずクイズ・まちがい直し） */
import { useMemo } from 'react';
import { CONFIG, GEO_TIPS, GEO_TIPS_NAME, MATH_TIPS_T } from './texts';
import { rankOf, rankNext, rankLine, rankMsg } from '../game/rank';
import { missCount } from '../game/records';
import { capListHTML, geoNameOf, jpSVG, wSVG, type Marks } from '../game/geo';
import { Hee, Promo, Raw, useResultLock } from './parts';
import { isGeo, type PlayResult } from './state';

export function ResultScreen({ r, onAgain, onMiss, onTitle }: { r: PlayResult; onAgain: () => void; onMiss: () => void; onTitle: () => void }) {
  const geo = isGeo(r.mode), isMath = r.mode === 'math';
  const kind = isMath ? 'math' : 'relay';
  const n = r.score, sec = r.seconds;
  const rk = rankOf(kind, n, sec);
  const nx = rankNext(kind, n, sec);
  const lock = useResultLock(2000);
  const hee = useMemo(() => {
    if (geo) {
      return { name: GEO_TIPS_NAME, text: r.geoGot && r.geoGot.length ? 'あてられたのは ' + r.geoGot.map((k) => geoNameOf(r.geoKind!, k)).join('・') + '。' : GEO_TIPS[Math.floor(Math.random() * GEO_TIPS.length)] + '。' };
    }
    if (isMath) return { name: '10を作るコツ', text: MATH_TIPS_T[Math.floor(Math.random() * MATH_TIPS_T.length)] + '。' };
    const pick = r.got.length ? r.got[Math.floor(Math.random() * r.got.length)] : (r.firstName ? { name: r.firstName, fact: r.firstFact || '' } : null);
    return pick ? { name: pick.name, text: pick.fact + '。' } : { name: '', text: '' };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r]);
  const map = useMemo(() => resultMap(r), [r]);
  const missN = missCount();
  return (
    <section className={'screen on' + (lock > 0 ? ' reslock' : '')} id="s-result">
      <div className="rankcard">
        <span className="rankbadge" id="rank" style={{ background: rk.color }}>{rk.name}</span>
        <div className="bignum display"><span id="final">{n}</span><small id="final-unit">もん</small></div>
        <p className="rankpace" id="rank-pace">{rankLine(n, sec)}</p>
        <p className="lede" id="rank-msg" style={{ margin: 0 }}>{rankMsg(kind, rk.i)}</p>
        <p className="newbest" id="newbest" hidden={!r.newBest}>じこベスト こうしん！</p>
        <p className="ranknext" id="rank-next" hidden={!nx}>{nx ? 'あと ' + nx.more + 'もんで ' + nx.name : ''}</p>
      </div>

      <div className={'resmap' + (map && map.world ? ' world' : '')} id="resmap" hidden={!map}>
        <div className="rm-head"><b id="rm-title">{map?.title}</b><span id="rm-count">{map?.count}</span></div>
        <Raw as="div" className="rm-box" id="rm-box" html={map?.svg || ''} />
        <Raw as="p" className="rm-note" id="rm-note" html={map?.note || ''} />
        <p className="rm-brand" id="rm-brand">{CONFIG.schoolName}</p>
      </div>

      <Hee name={hee.name} text={hee.text} />

      <div className="recap" id="recap" hidden={geo || !r.got.length}>
        <h3>こたえられたもの</h3>
        <ul id="recap-list">{r.got.map((g, i) => <li key={i}>{g.name}</li>)}</ul>
      </div>

      <Promo />

      <button className="btn btn-go" id="btn-again" onClick={onAgain} disabled={lock > 0}>{lock > 0 ? 'けっかを 見てね… ' + lock : 'もういちど'}</button>
      <button className="btn btn-sea" id="btn-miss" hidden={missN === 0} onClick={onMiss}>まちがえた問題を もう一回</button>
      <button className="btn btn-ghost" data-back="s-title" onClick={onTitle}>さいしょの画面へ</button>
    </section>
  );
}

/* A-2：結果画面に「きょう まわった場所」を塗って出す */
function resultMap(r: PlayResult): { world: boolean; title: string; count: string; svg: string; note: string } | null {
  if (isGeo(r.mode)) {
    const world = r.geoKind === 'world';
    const got = r.geoGot || [];
    if (!got.length) return null;
    const marks: Marks = {}; got.forEach((k) => { marks[k] = 'got'; });
    const ks = Object.keys(marks);
    return {
      world, title: world ? 'あてられた国' : 'あてられた都道府県', count: ks.length + (world ? 'か国' : '県'),
      svg: world ? wSVG(marks) : jpSVG(marks, null, { caps: 'all', capLab: ks }),
      note: world ? '' : capListHTML(ks),
    };
  }
  if (!(r.mode === 'pref' || r.mode === 'flag') || !r.got.length) return null;
  const world = r.mode === 'flag';
  const marks: Marks = {};
  r.got.forEach((q) => { if (q.mk) marks[q.mk] = 'got'; });
  const got = Object.keys(marks);
  return {
    world, title: world ? 'きょう まわった国' : 'きょう まわった都道府県', count: got.length + (world ? 'か国' : '県') + ' ぬれた',
    svg: world ? wSVG(marks) : jpSVG(marks, null, { caps: 'all', capLab: got }),
    note: world ? '' : capListHTML(got),
  };
}
