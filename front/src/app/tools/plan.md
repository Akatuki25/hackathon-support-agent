# Tools ページ実装プラン

## 概要
ハッカソン支援のための外部ツールや便利ツールを参照できるページを作成する。

## 実装内容

### 1. ページ構造
- 既存ページのスタイルに合わせたレイアウト（Header + メインコンテンツ）
- ダークモード対応
- レスポンシブなカードグリッドレイアウト

### 2. ツールカテゴリ（提案）
1. **デザイン・プロトタイピング**
   - Figma - UIデザインツール
   - Canva - グラフィックデザイン
   - Excalidraw - 手書き風ダイアグラム

2. **開発ツール**
   - GitHub - コード管理・コラボレーション
   - Vercel - デプロイメント
   - Replit - オンラインIDE

3. **コミュニケーション**
   - Discord - チームチャット
   - Notion - ドキュメント管理
   - Miro - オンラインホワイトボード

4. **AI・生産性**
   - ChatGPT - AIアシスタント
   - Claude - AIアシスタント
   - Cursor - AI搭載コードエディタ

5. **その他便利ツール**
   - Postman - API開発・テスト
   - Carbon - コードスクリーンショット
   - readme.so - README生成

### 3. データ構造
```typescript
type Tool = {
  id: string;
  name: string;
  description: string;
  url: string;
  category: string;
  icon?: string; // Lucide icon name
};
```

### 4. UI要素
- カテゴリフィルター（タブまたはボタン）
- 検索機能（オプション）
- ツールカード（名前、説明、外部リンク）
- ホバーエフェクト

### 5. ファイル構成
```
front/src/app/tools/
├── page.tsx          # メインページ
└── toolsData.ts      # ツールデータ（静的）
```

## 実装ステップ

1. `toolsData.ts` - ツールデータの定義
2. `page.tsx` - ページコンポーネントの作成
   - Header使用
   - カテゴリフィルタリング
   - カードグリッド表示
   - 外部リンク（新しいタブで開く）

## 技術的詳細
- Lucide React アイコン使用
- Tailwind CSS でスタイリング
- useDarkMode フックでダークモード対応
- 静的データ（APIなし、クライアントサイドのみ）
