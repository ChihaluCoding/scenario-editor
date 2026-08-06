# GitHub Pages公開仕様

## スコープ

- `ChihaluCoding/scenario-editor` の `main` ブランチを公開元とする。
- GitHub Actionsで品質確認とViteビルドを実行し、成果物をPages Artifactとして直接公開する。
- 公開URLは `https://chihalucoding.github.io/scenario-editor/` とする。

## 制約

- バックエンドや有料サービスを使用しない。
- `dist` はリポジトリへコミットせず、Actions内で生成する。
- リポジトリ配下のサブパスでもCSS・JavaScript・画像参照が解決できるよう相対パスでビルドする。
- Pagesの公開元は「GitHub Actions」とし、`gh-pages` ブランチを介した旧式ビルドを起動しない。

## 受け入れ条件

- `npm run lint`、`npm test`、`npm run build` が成功する。
- `dist/index.html` のビルド済みアセット参照が相対パスになる。
- `main` へのpushで単一のPagesワークフローが実行される。
- ビルド成果物がPages Artifactとしてアップロードされ、`github-pages` Environmentへ公開される。
- 公開URLからエディターを表示できる。

## 非対象

- 独自ドメインの設定。
- サーバー側API、認証、共同編集機能の追加。
