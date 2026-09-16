# 印刷物

当日ブースで使う紙。中身を直したら **かならず作り直して、QRが読めるか確かめる**こと。

| ファイル | 何 | 印刷 |
| --- | --- | --- |
| `poster.pdf` | ブースに貼るポスター（A4縦・QR大） | A4・フチなし（または「実際のサイズ」）。2〜3枚あると良い |
| `cards.pdf` | 持ち帰りカード（名刺サイズ8面付け） | A4・等倍。切って参加賞と一緒にわたす |
| `manual.pdf` | 当日の運用メモ（3ページ） | 1ページ目＝ブース担当用、2・3ページ目＝運営者用 |

`.html` はブラウザで開いてそのまま印刷してもよい（PDFと同じ）。

## 作り直す

```sh
pip install segno opencv-python-headless
python3 tools/print.py                    # 既定のイベントコード T2026-12
python3 tools/print.py --event T2027-06   # 別のイベントのとき
node tools/print_pdf.mjs                  # PDF にする（A4 に収まっているか見はる）
python3 tools/print_verify.py             # QR を実際に読んで URL を確かめる ← 省略しない
```

文面を直すときは `tools/_poster.tpl.html` / `_card.tpl.html` / `_cards.tpl.html` / `_manual.tpl.html`。
`print/` の中身は生成物なので、直接さわっても次回の生成で消える。

QR は誤り訂正レベル H（30%汚れても読める）。SVG は `viewBox` つきで出すこと
——`width`/`height` だけだと CSS で拡大したときに中身が切れて、見た目は QR なのに読めない紙ができる。
