#!/usr/bin/env python3
"""ブース用の 印刷物を 作る（ポスター・持ち帰りカード・運用メモ）。

    pip install segno
    python3 tools/print.py                 # 既定の イベントコード T2026-12
    python3 tools/print.py --event T2027-06

作られるもの（print/ の中）:
    poster.html / cards.html / manual.html   … ブラウザで開いて そのまま 印刷できる
PDF にするなら ブラウザの「印刷 → PDFに保存」（余白なし・A4）。
Playwright があれば  node tools/print_pdf.mjs  でも 作れる。

QR は 誤り訂正レベル H（30%まで 汚れても 読める）。SVG は viewBox つきで 出す
（width/height だけだと CSS で 拡大したときに 中身が 切れる）。
"""
import argparse, pathlib, re, sys

try:
    import segno
except ImportError:
    sys.exit('segno が 要ります:  pip install segno')

ROOT = pathlib.Path(__file__).resolve().parent.parent
TPL = ROOT / 'tools'
OUT = ROOT / 'print'
SITE = 'https://ayumu-aa.github.io/oyako-game/'
SEA = '#1B4965'

def qr_svg(url: str) -> str:
    import io
    q = segno.make(url, error='h')
    buf = io.BytesIO()   # segno は バイト列で 書く
    q.save(buf, kind='svg', scale=10, border=2, dark=SEA, omitsize=True, xmldecl=False)
    return buf.getvalue().decode('utf-8').strip()

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--event', default='T2026-12', help='イベントコード（QR と 掲示URL に入る）')
    ap.add_argument('--cards', type=int, default=8, help='1枚に 並べる カードの数')
    a = ap.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,20}', a.event):
        sys.exit('イベントコードは 英数字と - _ で 20文字まで')
    booth, home = f'{SITE}?e={a.event}', SITE
    OUT.mkdir(exist_ok=True)

    poster = (TPL / '_poster.tpl.html').read_text().replace('{QR_BOOTH}', qr_svg(booth))
    (OUT / 'poster.html').write_text(poster)

    card = (TPL / '_card.tpl.html').read_text().replace('{QR_HOME}', qr_svg(home))
    cards = (TPL / '_cards.tpl.html').read_text().replace('{CARDS}', card * a.cards)
    (OUT / 'cards.html').write_text(cards)

    manual = (TPL / '_manual.tpl.html').read_text().replace('T2026-12', a.event)
    (OUT / 'manual.html').write_text(manual)

    print(f'print/poster.html  {booth}')
    print(f'print/cards.html   {home} × {a.cards}')
    print(f'print/manual.html  イベントコード {a.event}')

if __name__ == '__main__':
    main()
