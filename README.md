# 回転砲塔 (cym-shooting)

同じ種類の弾でしか壊せない3種の敵を捌く、1ラン3分の縦シューティング。
ラン中に稼いだ金でその場で強化を買い、手作業を段階的に自動化していく。

- 企画書: [`docs/game-spec.md`](docs/game-spec.md)
- Steam販売までの計画: [`docs/steam-roadmap.md`](docs/steam-roadmap.md)
- 元のプロトタイプ（単一HTML・参考用）: [`prototype/turret-prototype.html`](prototype/turret-prototype.html)

## 動かす

ES モジュールを使っているため `file://` では開けない。静的サーバ経由で開く。

```sh
npm run dev            # http://localhost:8080 （依存なし・Node標準ライブラリのみ）
```

デスクトップ版（Steam向けのシェル）を動かす場合:

```sh
npm install
npm start              # Electron ウィンドウで起動
npm run dist           # release/ に配布用の展開済みディレクトリを出力
```

## 操作

| | |
|---|---|
| 移動 | マウス追従 / ドラッグ / <kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd> |
| 砲塔を回す（●→▲→■→●） | クリック / タップ / <kbd>Space</kbd> / <kbd>W</kbd> / <kbd>↑</kbd> |
| 強化を買う | クリック / <kbd>1</kbd>〜<kbd>6</kbd> |
| 中断 | <kbd>Esc</kbd> / <kbd>P</kbd> |

射撃は常時オート。プレイヤーは撃たない。

回転は**一方向のみ**。`●` から `■` は1タップ、`▲` は2タップ。この切り替え距離が
手数コストになり「今どの敵を処理するか」の判断を生む。3種を直接指定する入力を
足すとこのコストが消えるので、追加しないこと（企画書 §3）。

## 構成

```
index.html            エントリ。ブラウザでもElectronでも同じものを読む
css/style.css         HUD・ショップ・オーバーレイ。盤面はCanvas側
js/config.js          全チューニング値。ロジック中に数値をベタ書きしない
js/core/view.js       キャンバス寸法とスケール（S = 画面高 / 640）
js/core/state.js      ラン状態の生成、ポッド同期、砲塔回転
js/core/input.js      ポインタ・キーボードを「移動」と「回転」に正規化
js/game/entities.js   敵・弾・粒子の生成
js/game/update.js     1フレームぶんの更新
js/game/render.js     Canvas描画（画像アセットは使わない）
js/game/shop.js       ラン中に買う強化
js/game/hud.js        DOM側の時間・所持金・突破ゲージ・リザルト
electron/main.js      デスクトップ用シェル（窓とライフサイクルのみ）
tools/serve.mjs       開発用の静的サーバ
```

## 設計上の約束

企画書から動かしてはいけないもの:

1. **画像アセットを使わない。** 円・三角・矩形・線・粒子だけで成立させる
2. **強化は必ず画面上の変化として現れる。** 数値だけ増える強化は追加しない
3. **色は装飾ではなく情報。** ●▲■ の3色は弾種と敵種の対応そのもので、他に流用しない
4. **チューニング値は `js/config.js` に集約する**

## デバッグ

実行中は `window.__G`（ラン状態）と `window.__CONFIG` がコンソールから見える。
バランス確認用の覗き窓で、ゲーム側からは参照していない。
