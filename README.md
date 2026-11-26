# 261126a

にじのみち系 新作15本（D01〜D15）。写実3D、指1本、画面に文字なし。

- `briefs/` … 各ゲームの実装指示文（ChatGPT 作成）
- `site/games/dNN/index.html` … ゲーム本体（Claude Code Cloud / Opus 5.5 実装）

- `site/games/g1` `g2` `g3` … Hydrogen 並列A/Bバッチ1の最終版（雲の駅と小さな蒸気機関車 / 熱気球と花の谷の郵便 / 帆船と星明かりの島めぐり）
- `site/thumbs/dNN.jpg|svg` … 一覧用のサムネイル
- `logs/dNN/` … クラウド実装の記録（作業メモ・テスト結果・スクリーンショット）
- Three.js r0.187.0 を `site/vendor/three/` に同梱（MIT, LICENSE 同梱）。importmap:
  `{"three":"../../vendor/three/build/three.module.min.js","three/addons/":"../../vendor/three/examples/jsm/"}`
