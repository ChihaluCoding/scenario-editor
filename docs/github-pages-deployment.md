# GitHub Pages公開仕様

## スコープ

- `ChihaluCoding/scenario-editor` の `main` ブランチを公開元とする。
- GitHub Actionsで品質確認とViteビルドを実行し、成果物を `gh-pages` ブランチへ自動配置する。
- 公開URLは `https://chihalucoding.github.io/scenario-editor/` とする。

## 制約

- バックエンドや有料サービスを使用しない。
- `dist` はリポジトリへコミットせず、Actions内で生成する。
- リポジトリ配下のサブパスでもCSS・JavaScript・画像参照が解決できるよう相対パスでビルドする。

## 受け入れ条件

- `npm run lint`、`npm test`、`npm run build` が成功する。
- `dist/index.html` のビルド済みアセット参照が相対パスになる。
- `main` へのpushでPagesワークフローが実行され、`gh-pages` ブランチが更新される。
- 公開URLからエディターを表示できる。

## 非対象

- 独自ドメインの設定。
- サーバー側API、認証、共同編集機能の追加。
