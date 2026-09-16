#!/usr/bin/env python3
"""印刷用 PDF の QR が ほんとうに 読めるか 確かめる。

    pip install opencv-python-headless        （pdftoppm も 要る: poppler-utils）
    python3 tools/print_verify.py --event T2026-12

刷ってから「読めない」は 取り返しが つかないので、PDF を 画像に して
実際に デコードする。SVG の viewBox を 忘れて QR が 切れる事故が あったため。
"""
import argparse, pathlib, subprocess, sys, tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'print'
SITE = 'https://ayumu-aa.github.io/oyako-game/'

def png_of(pdf: pathlib.Path, d: str) -> pathlib.Path:
    subprocess.run(['pdftoppm', '-r', '200', '-png', '-f', '1', '-l', '1', str(pdf), d + '/p'],
                   check=True, capture_output=True)
    return sorted(pathlib.Path(d).glob('p*.png'))[0]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--event', default='T2026-12')
    a = ap.parse_args()
    try:
        import cv2
    except ImportError:
        sys.exit('opencv が 要ります:  pip install opencv-python-headless')

    ng = 0
    with tempfile.TemporaryDirectory() as d:
        # ポスター：ページ全体に QR は 1つ
        img = cv2.imread(str(png_of(OUT / 'poster.pdf', d)))
        got = cv2.QRCodeDetector().detectAndDecode(img)[0]
        want = f'{SITE}?e={a.event}'
        print('poster', 'OK' if got == want else 'NG', got or '(読めない)')
        ng += got != want

        # カード：8面付けなので 左上の 1枚だけ 切り出す（A4 上下38.5mm・左右14mm・1枚 91×55mm）
        img = cv2.imread(str(png_of(OUT / 'cards.pdf', d)))
        h, w = img.shape[:2]
        one = img[int(h * 38.5 / 297):int(h * 93.5 / 297), int(w * 14 / 210):int(w * 105 / 210)]
        got = cv2.QRCodeDetector().detectAndDecode(one)[0]
        print('cards ', 'OK' if got == SITE else 'NG', got or '(読めない)')
        ng += got != SITE
    sys.exit(1 if ng else 0)

if __name__ == '__main__':
    main()
