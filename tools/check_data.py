#!/usr/bin/env python3
"""問題データの 見はり。追加した問題が 画面で 壊れないかを 機械的に 調べる。

    python3 tools/check_data.py

見るところ:
  1. ヒント・例文・意味の 漢字に ふりがな（漢字{よみ}）が ついているか
     → バトル画面は furi() で ルビにするだけなので、書き忘れると 漢字が むき出しで 出る
     （Playwright の「ふりがな：漢字は かならず ruby の中」テストが 落ちる）
  2. 同じ名前が 2つ 入っていないか（選たく肢が かぶる）
  3. タグが 決まったものか（まちがいの選たく肢は 同じタグから えらぶので、
     知らないタグを 書くと そのグループが 1問だけに なる）
  4. 学年が 1 か 2 か
  5. よみが ひらがな・カタカナだけか
  6. KOKUGO は ぜんぶ KOKUGO_REI（例文と意味）を 持っているか
  7. EIGO は ぜんぶ 絵を 持っているか
"""
import json, pathlib, re, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
KANJI = re.compile(r'[一-鿿々〆ヶ]')
RUBY = re.compile(r'[一-鿿々〆ヶ]+\{[ぁ-ゟー]+\}')
YOMI_OK = re.compile(r'^[ぁ-ゟァ-ヿー・\s]+$')

TAGS = {
    'kokugo': {'ことわざ', '慣用句', '四字熟語'},
    'rika':   {'こん虫', '生きもの', '植物', 'からだ', '天気', '大地', '宇宙', '空気', '水', '電気', '光', '力'},
    'rekishi': {'人物', 'できごと', '時代', 'たてもの', 'いせき', 'むかしのどうぐ'},
}

def bare_kanji(t: str) -> str:
    """ふりがなが ついていない 漢字を 返す（無ければ 空）"""
    return ''.join(KANJI.findall(RUBY.sub('', t or '')))

def load():
    """TS を そのまま node で 読んで JSON に する（自前の パーサを 書かない）"""
    src = ROOT / 'src' / 'data'
    js = f"""
    import {{ PREF, FLAG, KOKUGO, RIKA, REKISHI, EIGO, LV1_PREF, LV1_FLAG, HINT2, ART }} from '{src / 'questions.ts'}';
    import {{ KOKUGO_REI }} from '{src / 'kokugo_rei.ts'}';
    import {{ IMAGE_KEYS }} from '{src / 'images.ts'}';
    console.log(JSON.stringify({{ PREF, FLAG, KOKUGO, RIKA, REKISHI, EIGO,
      LV1_PREF: [...LV1_PREF], LV1_FLAG: [...LV1_FLAG], HINT2, ART: Object.keys(ART),
      KOKUGO_REI, IMAGE_KEYS: [...IMAGE_KEYS] }}));
    """
    with tempfile.NamedTemporaryFile('w', suffix='.mts', dir=ROOT, delete=False) as f:
        f.write(js); tmp = pathlib.Path(f.name)
    try:
        r = subprocess.run(['npx', 'tsx', str(tmp)], cwd=ROOT, capture_output=True, text=True)
        if r.returncode:
            r = subprocess.run(['npx', 'vite-node', str(tmp)], cwd=ROOT, capture_output=True, text=True)
        if r.returncode:
            sys.exit('データを 読めませんでした:\n' + r.stderr[-2000:])
        return json.loads(r.stdout.strip().splitlines()[-1])
    finally:
        tmp.unlink(missing_ok=True)

def main():
    d = load()
    bad: list[str] = []
    def ng(m): bad.append(m)

    # 1〜5：ヒントのある 5教科
    for key, rows, hint_i, lv_i in [
        ('pref', d['PREF'], 3, None), ('flag', d['FLAG'], 4, None),
        ('kokugo', d['KOKUGO'], 3, 5), ('rika', d['RIKA'], 3, 5),
        ('rekishi', d['REKISHI'], 3, 5), ('eigo', d['EIGO'], 3, 5),
    ]:
        seen = {}
        for r in rows:
            name, yomi = r[0], r[1]
            if name in seen: ng(f'{key}: 「{name}」が 2つ ある')
            seen[name] = True
            if not YOMI_OK.match(yomi): ng(f'{key}/{name}: よみ「{yomi}」に かな以外が ある')
            for h in r[hint_i]:
                b = bare_kanji(h)
                if b: ng(f'{key}/{name}: ヒント「{h}」の {b} に ふりがなが ない')
            if lv_i is not None and r[lv_i] not in (1, 2): ng(f'{key}/{name}: 学年が {r[lv_i]}')
            if key in TAGS and r[2] not in TAGS[key]: ng(f'{key}/{name}: 知らないタグ「{r[2]}」')
        # HINT2（追加ヒント）も 同じ ものさしで
        for name, hs in (d['HINT2'].get(key) or {}).items():
            if name not in seen: ng(f'{key}: HINT2 の「{name}」が 本体に ない')
            for h in hs:
                b = bare_kanji(h)
                if b: ng(f'{key}/{name}: 追加ヒント「{h}」の {b} に ふりがなが ない')

    # 学年の 分かれ方
    pref_names = {r[0] for r in d['PREF']}
    for n in d['LV1_PREF']:
        if n not in pref_names: ng(f'LV1_PREF の「{n}」が PREF に ない')
    flag_names = {r[0] for r in d['FLAG']}
    for n in d['LV1_FLAG']:
        if n not in flag_names: ng(f'LV1_FLAG の「{n}」が FLAG に ない')

    # 6：ことばは 例文と意味を 持っているか
    rei = d['KOKUGO_REI']
    for r in d['KOKUGO']:
        e = rei.get(r[0])
        if not e: ng(f'kokugo/{r[0]}: 例文と意味（KOKUGO_REI）が ない'); continue
        for k in ('rei', 'imi'):
            b = bare_kanji(e[k])
            if b: ng(f'kokugo/{r[0]}: {k}「{e[k]}」の {b} に ふりがなが ない')
        if r[0].replace('{', '')[:2] not in re.sub(r'\{[^}]*\}', '', e['rei']):
            ng(f'kokugo/{r[0]}: 例文の中に そのことばが 見あたらない')
    for n in rei:
        if n not in {r[0] for r in d['KOKUGO']}: ng(f'KOKUGO_REI の「{n}」が KOKUGO に ない')

    # 7：えいごの 絵
    have = set(d['IMAGE_KEYS']) | set(d['ART'])
    for r in d['EIGO']:
        if len(r) < 7 or r[6] not in have: ng(f'eigo/{r[0]}: 絵が ない')

    n = {k: len(d[k]) for k in ('PREF', 'FLAG', 'KOKUGO', 'RIKA', 'REKISHI', 'EIGO')}
    lv1 = {'pref': len(d['LV1_PREF']), 'flag': len(d['LV1_FLAG'])}
    for k in ('KOKUGO', 'RIKA', 'REKISHI', 'EIGO'):
        lv1[k.lower()] = sum(1 for r in d[k] if r[5] == 1)
    print('問題数:', json.dumps(n, ensure_ascii=False))
    print('低学年:', json.dumps(lv1, ensure_ascii=False))
    if bad:
        by: dict[str, int] = {}
        for m in bad: by[m.split('/')[0].split(':')[0]] = by.get(m.split('/')[0].split(':')[0], 0) + 1
        print('\n直すところ', len(bad), '件:', json.dumps(by, ensure_ascii=False))
        only = sys.argv[1] if len(sys.argv) > 1 else None
        show = [m for m in bad if not only or m.startswith(only)]
        for m in show[:200]: print(' -', m)
        if len(show) > 200: print(f' … ほか {len(show) - 200} 件')
        sys.exit(1)
    print('\nぜんぶ OK')

if __name__ == '__main__':
    main()
