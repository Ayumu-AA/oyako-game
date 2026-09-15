# 親子ゲーム

小学生の親子で遊ぶ、ブラウザ学習ゲーム集。スマホ・タブレット用。
プラウ経験型教育塾

公開 URL: https://ayumu-aa.github.io/oyako-game/

## 中身

- **親子ヒントリレー**（2人）… 都道府県／世界の国旗／ことば／りか／れきし／えいご
- **はやおし親子バトル**（2人）… 画面を上下に分けて向かい合って対戦（けいさんはテンキー入力）
- **親子クロスワード**（2人）… ヨコのカギ＝こども、タテのカギ＝おとな
- **ちずクイズ**（2人）… 地図の赤いところを 4たくで答える
- **ひとりであそぶ**（1人）… 10を作る／けいさんクロス
- **まちがい直し** … まちがえた問題だけが出る（端末内に記録）

## 仕組み（v2）

React + Vite + TypeScript。`main` に push すると GitHub Actions が build して Pages に公開する。

```
src/
  game/   純ロジック（DOM に触らない。vitest で守る）
  ui/     React の画面（12画面）と app.css
  data/   問題・ヒント・地図・国旗・えいごの絵（tools/extract.py が v1 から切り出した生成物）
  lib/    端末まわり（保存・音・演出・ズーム防止）
board.html          ブース掲示用ページ（別エントリ）
legacy/index.html   v1（1ファイル版）。参照用
```

### 開発

```sh
npm ci
npm run dev          # http://localhost:5173/oyako-game/
npm run typecheck
npm run test:unit    # vitest
npm run build && npm run test:e2e   # Playwright（要 preview サーバー。config が自動で立てる）
```

### 塾名などの書きかえ

`src/data/texts.ts` の `CONFIG` の3行。

```ts
export const CONFIG = {
  schoolName: 'プラウ経験型教育塾',
  eventName : '',
  promoText : 'スコアを受付の先生に見せてね。参加賞をプレゼント！おうちでも遊べます。'
};
```

### 英語モードの絵

`public/eigo/<キー>.webp` を置いて、`src/data/images.ts` の `IMAGE_KEYS` にキーを足すと、その単語が出題に加わる。

## 記録と通信

- まちがい帳・出題きろくは まず端末内（localStorage、キーは v1 と同じ）に書き、送信キュー（`oyako-queue`）経由で Supabase の `question_stats` に送る。通信がなくてもゲームは止まらず、つながったときに流れる
- 起動時に匿名ログイン（`signInAnonymously`）し、サーバーの記録を取りこんで 新しいほうを採用する。端末の記録が消えてもサーバーから戻る
- Service Worker（vite-plugin-pwa）が build 資産と えいごの絵を先読みするので、一度開けば 機内モードでも遊べる。manifest は出さない（ホーム画面追加の誘導をしないため）
- 接続先は `src/lib/config.ts`。publishable key はブラウザに置いてよい鍵。secret key は絶対に書かない
- **ランキング**：結果画面の「ランキングを 見る」／タイトル右上の「ランキング」。ゲーム×学年ごとに上位10＋自分の順位。名前はひらがな2〜6文字（NGワードあり、「ほんとうの なまえは いれないでね」を常時表示）。名前は `profiles` に保存され、次回から入力不要（せっていで変更）
- イベントコードは URL の `?e=T2026-12` で渡す（QR に埋めこむ）。無ければ `home`。一度渡すと端末に残る
- **ブース掲示用**：`board.html?e=T2026-12`。全ゲームの上位5を8秒ごとに切りかえ、新しい点数が入った瞬間に Realtime で反映（`scores` を `supabase_realtime` publication に入れておくこと）
