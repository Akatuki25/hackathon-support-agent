export type Tool = {
  id: string;
  name: string;
  description: string;
  url: string;
  category: string;
  phase: string; // 開発フェーズ
};

export type Category = {
  id: string;
  name: string;
};

export const categories: Category[] = [
  { id: "all", name: "すべて" },
  { id: "design", name: "デザイン" },
  { id: "development", name: "開発" },
  { id: "communication", name: "コミュニケーション" },
  { id: "ai", name: "AI・生産性" },
  { id: "utility", name: "便利ツール" },
];

export const tools: Tool[] = [
  // デザイン・プロトタイピング
  {
    id: "figma",
    name: "Figma",
    description:
      "チームで共同編集できるUIデザインツール。プロトタイプ作成やデザインシステム管理に最適。",
    url: "https://www.figma.com/",
    category: "design",
    phase: "企画・設計フェーズ",
  },
  {
    id: "canva",
    name: "Canva",
    description:
      "テンプレートを使って簡単にグラフィックデザインが作成できる。プレゼン資料やロゴ作成、発表スライドに便利。",
    url: "https://www.canva.com/",
    category: "design",
    phase: "企画フェーズ・発表準備",
  },
  {
    id: "excalidraw",
    name: "Excalidraw",
    description:
      "手書き風のダイアグラムやワイヤーフレームを作成。アイデア出しやシステム構成図のブレストに最適。",
    url: "https://excalidraw.com/",
    category: "design",
    phase: "企画・設計フェーズ",
  },
  // 開発ツール
  {
    id: "github",
    name: "GitHub",
    description:
      "コード管理とチームコラボレーションのプラットフォーム。Issue管理やCI/CDも統合。チーム開発の必須ツール。",
    url: "https://github.com/",
    category: "development",
    phase: "開発フェーズ（全期間）",
  },
  {
    id: "vercel",
    name: "Vercel",
    description:
      "Next.jsに最適化されたデプロイメントプラットフォーム。プレビューデプロイで動作確認が簡単。",
    url: "https://vercel.com/",
    category: "development",
    phase: "開発・デプロイフェーズ",
  },
  {
    id: "replit",
    name: "Replit",
    description:
      "ブラウザ上で動作するオンラインIDE。環境構築なしですぐにコーディング開始。ペアプロにも便利。",
    url: "https://replit.com/",
    category: "development",
    phase: "プロトタイプ・開発フェーズ",
  },
  // コミュニケーション
  {
    id: "discord",
    name: "Discord",
    description:
      "音声・テキストチャットでチームコミュニケーション。チャンネル分けで話題を整理。ハッカソン中の連携に必須。",
    url: "https://discord.com/",
    category: "communication",
    phase: "全フェーズ",
  },
  {
    id: "notion",
    name: "Notion",
    description:
      "ドキュメント・タスク・データベースを一元管理。議事録、仕様書、進捗管理をまとめて管理できる。",
    url: "https://www.notion.so/",
    category: "communication",
    phase: "全フェーズ",
  },
  {
    id: "miro",
    name: "Miro",
    description:
      "オンラインホワイトボードツール。アイデア出し、ユーザーストーリーマッピング、フローチャート作成に最適。",
    url: "https://miro.com/",
    category: "communication",
    phase: "企画・設計フェーズ",
  },
  // AI・生産性
  {
    id: "chatgpt",
    name: "ChatGPT",
    description:
      "OpenAIのAIアシスタント。コード生成、文章作成、アイデア出し、デバッグ支援など幅広くサポート。",
    url: "https://chat.openai.com/",
    category: "ai",
    phase: "全フェーズ",
  },
  {
    id: "claude",
    name: "Claude",
    description:
      "AnthropicのAIアシスタント。長文理解に優れ、複雑なコードレビューや設計の相談に強い。",
    url: "https://claude.ai/",
    category: "ai",
    phase: "全フェーズ",
  },
  {
    id: "cursor",
    name: "Cursor",
    description:
      "AI搭載のコードエディタ。コード補完、リファクタリング、デバッグをAIがリアルタイムでサポート。",
    url: "https://cursor.sh/",
    category: "ai",
    phase: "開発フェーズ",
  },
  // 便利ツール
  {
    id: "postman",
    name: "Postman",
    description:
      "APIの開発・テスト・ドキュメント作成ツール。バックエンドとフロントエンドの連携確認に必須。",
    url: "https://www.postman.com/",
    category: "utility",
    phase: "開発・テストフェーズ",
  },
  {
    id: "carbon",
    name: "Carbon",
    description:
      "コードの美しいスクリーンショットを作成。発表スライドや資料にコードを載せる際に便利。",
    url: "https://carbon.now.sh/",
    category: "utility",
    phase: "発表準備フェーズ",
  },
  {
    id: "readme-so",
    name: "readme.so",
    description:
      "READMEファイルを簡単に作成できるエディタ。テンプレートからプロジェクト説明を素早く作成。",
    url: "https://readme.so/",
    category: "utility",
    phase: "開発・発表準備フェーズ",
  },
  {
    id: "qr-code-generator",
    name: "QRコード作成",
    description:
      "URLやテキストからQRコードを無料で作成。デモ用のURLを共有したり、発表時にアプリへ誘導するのに便利。",
    url: "https://www.qrcode-monkey.com/",
    category: "utility",
    phase: "発表準備フェーズ",
  },
  {
    id: "json-formatter",
    name: "JSON Formatter",
    description:
      "JSONデータを整形・検証するオンラインツール。APIレスポンスの確認やデバッグに役立つ。",
    url: "https://jsonformatter.org/",
    category: "utility",
    phase: "開発・テストフェーズ",
  },
  {
    id: "regex101",
    name: "regex101",
    description:
      "正規表現をリアルタイムでテスト・デバッグ。マッチ結果の可視化と詳しい解説付き。",
    url: "https://regex101.com/",
    category: "utility",
    phase: "開発フェーズ",
  },
  {
    id: "coolors",
    name: "Coolors",
    description:
      "カラーパレットを自動生成。スペースキーで次々と配色を提案。UIデザインの色選びに最適。",
    url: "https://coolors.co/",
    category: "design",
    phase: "企画・設計フェーズ",
  },
  {
    id: "squoosh",
    name: "Squoosh",
    description:
      "Googleが提供する画像圧縮ツール。画質を保ちながらファイルサイズを大幅削減。Web最適化に。",
    url: "https://squoosh.app/",
    category: "utility",
    phase: "開発・デプロイフェーズ",
  },
  {
    id: "remove-bg",
    name: "remove.bg",
    description:
      "画像の背景を自動で削除。ロゴやアイコンの背景透過処理がワンクリックで完了。",
    url: "https://www.remove.bg/",
    category: "utility",
    phase: "デザイン・発表準備フェーズ",
  },
  {
    id: "tldraw",
    name: "tldraw",
    description:
      "シンプルで軽量なオンラインホワイトボード。図解やメモをサクッと作成して共有できる。",
    url: "https://www.tldraw.com/",
    category: "design",
    phase: "企画・設計フェーズ",
  },
  {
    id: "codeium",
    name: "Codeium",
    description:
      "無料のAIコード補完ツール。VS Codeなど主要エディタに対応。Copilotの無料代替として人気。",
    url: "https://codeium.com/",
    category: "ai",
    phase: "開発フェーズ",
  },
  {
    id: "lottiefiles",
    name: "LottieFiles",
    description:
      "軽量なアニメーションを検索・編集・実装。ローディングやマイクロインタラクションに最適。",
    url: "https://lottiefiles.com/",
    category: "design",
    phase: "開発フェーズ",
  },
  {
    id: "favicon-io",
    name: "favicon.io",
    description:
      "テキストや画像からファビコンを簡単作成。PWAに必要な各サイズのアイコンも一括生成。",
    url: "https://favicon.io/",
    category: "utility",
    phase: "開発・デプロイフェーズ",
  },
  {
    id: "devdocs",
    name: "DevDocs",
    description:
      "複数の技術ドキュメントを統合検索。オフライン対応でサクサク調べられる開発者必携ツール。",
    url: "https://devdocs.io/",
    category: "development",
    phase: "開発フェーズ（全期間）",
  },
  {
    id: "ngrok",
    name: "ngrok",
    description:
      "ローカル環境を一時的に外部公開。Webhookのテストやデモ共有に便利。トンネリングツール。",
    url: "https://ngrok.com/",
    category: "development",
    phase: "開発・テストフェーズ",
  },
];
