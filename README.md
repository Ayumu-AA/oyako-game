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

`src/data/images.ts` の `IMAGES` にキーを足すと、その単語が出題に加わる。

## 記録

まちがい帳・出題きろく・ベストは端末内（localStorage）。キーは v1 と同じなので引きつがれる。
ランキング（Supabase）は v2 の次の段階で入れる。
