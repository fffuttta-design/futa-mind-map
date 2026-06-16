# FutaMindMap 仕様書

> このドキュメントは **FutaMindMap（ふたマインドマップ）** の全機能・構成・データ構造を網羅した仕様書です。
> 開発・改修の前に必ず読み込み、機能を変更したら **この仕様書も併せて更新** すること（詳細は `CLAUDE.md`）。
>
> - 最終更新基準: アプリ v1.9.0 / デスクトップ v1.3.0（NSIS + electron-updater へ移行）
> - リポジトリ: `https://github.com/fffuttta-design/futa-mind-map`（ブランチ `main`）
> - 本番URL（Web）: `https://futa-mind-map.vercel.app`

---

## 1. アプリ概要

FutaMindMap は、**自由なマインドマップ作成** と **LINE構築（Lステップ風）シナリオ設計** の両方をこなす Web アプリ。
キャンバスは ReactFlow を使わない **自作の SVG キャンバス** で、ノード・付箋・エリア・リスト・ノートなどを自由に配置できる。

提供形態は3つ:

| 形態 | 中身 |
|---|---|
| **Web** | Vercel 本番（メイン） |
| **デスクトップ（Windows）** | 本番URLを読み込むだけの薄い Electron シェル（NSIS インストーラ + electron-updater で自動更新） |
| **PWA** | `manifest.ts` によりインストール可能（standalone 表示） |

主な用途:
1. **マインドマップ** — アイデア整理・企画・設計図。
2. **LINEシナリオ設計** — 友だち追加・ステップ配信・キーワード応答などの構成図を描き、各ノードに LINE 配信メッセージ（テキスト/ボタン/カルーセル）を紐付けてスマホ風プレビューする。
3. **Lステップ風タグ・友だち情報** — ノードに「タグ」「友だち情報項目」を付与し、構成図として可視化する（実際の友だちDBではなく提案図向け）。

---

## 2. 技術スタック

| 区分 | 採用技術 |
|---|---|
| フレームワーク | Next.js 16（App Router）+ React 19 + TypeScript |
| スタイル | Tailwind CSS v4（`@tailwindcss/postcss`） |
| 描画 | 自作 SVG キャンバス（`@xyflow/react`・`reactflow` は依存に入っているが本体描画には不使用） |
| 認証 | Firebase Authentication（Google OAuth） |
| DB | Firebase Firestore |
| 画像保存 | Firebase Storage |
| AI生成 | Firebase Cloud Functions（`asia-northeast1`）＋ Anthropic Claude Haiku |
| 状態管理 | React の `useState`/`useRef` 中心（`zustand` も依存にあり） |
| フォント | Geist（`next/font/google`） |
| ホスティング | Vercel（`main` への push で自動デプロイ） |
| デスクトップ | Electron 33 + electron-builder（portable） |

### Firebase プロジェクト
- プロジェクトID: `futa-mind-map`（`.firebaserc` の default）
- 環境変数（`.env.local`、すべて `NEXT_PUBLIC_` の公開鍵）:
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`
- Anthropic API キーは **Secret Manager**（`ANTHROPIC_API_KEY`）に保存し、フロントには出さない。

---

## 3. ディレクトリ構成

```
futa-mind-map/
├── app/                         # Next.js App Router
│   ├── page.tsx                 # トップ（未ログイン→Googleログイン、ログイン済→/mapsへ）
│   ├── layout.tsx               # ルートレイアウト（AuthProvider + UpdateToast）
│   ├── manifest.ts              # PWA マニフェスト
│   ├── icon.tsx                 # アプリアイコン（動的生成）
│   ├── globals.css
│   ├── maps/
│   │   ├── page.tsx             # マップ一覧（フォルダ/タグ/検索/新規作成）
│   │   └── [id]/page.tsx        # マップ編集画面（保存制御・履歴・各モーダル統括）
│   ├── share/[id]/page.tsx      # 公開マップの閲覧専用ページ
│   └── api/
│       ├── version/route.ts     # バージョン確認API（{ version }）
│       └── pwa-icon/[size]/route.tsx  # PWAアイコン画像生成
├── components/
│   ├── MindMapCanvas.tsx        # ★キャンバス本体（約3150行・描画/操作/エクスポート）
│   ├── NodeToolbar.tsx          # ノード選択時の浮遊ツールバー（形・色・画像・リンク・メモ等）
│   ├── NodeTagFieldPopup.tsx    # ノードのタグ/友だち情報の付与ポップアップ
│   ├── NodePropertiesPanel.tsx  # ノードのプロパティパネル
│   ├── NotePanel.tsx            # ノート編集パネル
│   ├── TagFieldMasterModal.tsx  # タグ/友だち情報マスタ管理モーダル
│   ├── PageSettingsModal.tsx    # ページ設定（接続線/デフォルト形状/枠線）
│   ├── SettingsModal.tsx        # アプリ設定（バージョン確認/更新/再起動）
│   ├── AiGenerateModal.tsx      # AIマインドマップ生成モーダル
│   ├── LineMessagePanel.tsx     # LINEモード: 配信メッセージ編集パネル
│   ├── LinePreviewModal.tsx     # LINEモード: スマホ風配信プレビュー
│   └── UpdateToast.tsx          # 更新後トースト通知
├── contexts/AuthContext.tsx     # 認証コンテキスト（user/loading/signIn/signOut）
├── hooks/
│   ├── useVersionCheck.ts       # 最新版チェック（/api/version 比較）
│   └── useAiUsage.ts            # 今月のAI利用料を購読（¥100超アラート用）
├── lib/
│   ├── version.ts               # APP_VERSION 定数（★改修ごとに更新）
│   ├── firebase.ts              # Firebase 初期化（auth/db/storage/functions）
│   ├── aiGenerate.ts            # AI生成呼び出し＋木構造→座標の自動レイアウト
│   └── uploadImage.ts           # 画像を Storage にアップロード（Firestore 1MiB回避）
├── types/index.ts               # 全型定義
├── functions/                   # Cloud Functions（generateMindMap）
│   ├── index.js
│   └── package.json             # Node 22 / @anthropic-ai/sdk
├── electron-app/                # デスクトップ版（薄いシェル）
│   ├── main.js                  # 本番URLを読み込む BrowserWindow
│   ├── preload.js
│   └── package.json             # portable / artifactName 固定 = FutaMindMap.exe
├── .github/workflows/desktop-release.yml  # desktop-v* タグでEXEをReleasesへ
├── storage.rules                # Storage セキュリティルール
├── firebase.json / .firebaserc
├── docs/タグ・友だち情報機能_要件定義.md
├── CLAUDE.md                    # 開発ルール
└── FutaMindMap仕様書.md         # 本ドキュメント
```

---

## 4. 画面（ルーティング）

### 4-1. `/`（トップ）
- 未ログイン: 「Googleでログイン」ボタンのみ。
- ログイン済: 自動で `/maps` へリダイレクト。

### 4-2. `/maps`（マップ一覧）
- 自分が owner のマップを Firestore からリアルタイム購読（`ownerId == user.uid`、更新日時の降順）。
- **左サイドバー**: フォルダ一覧（「すべて」＋各フォルダ）、タグ一覧（クリックで絞り込み）。
- **ヘッダー**: タイトル＋バージョン表示、マップ・ノードのテキスト横断検索。
- **マップカード**: タイトル、更新日、ノード数、公開バッジ、LINEバッジ、タグ（付け外し可）、フォルダ（その場で変更可）。カードの「×」で削除（確認あり）。
- **＋新しいマップ**: テンプレート選択ダイアログ → 「空白マップ」または「LINE構築設計」。**作成後にモード変更は不可**。
  - 空白: ルート1ノード（「中心テーマ」）。`mode: "mindmap"`。
  - LINE: あらかじめ用意した9ノードの LINE シナリオ雛形。`mode: "line"`、タグ `["LINE"]`。
- 左下に **アプリ設定ボタン**（更新があれば赤バッジ）。

### 4-3. `/maps/[id]`（マップ編集画面）
中核画面。Firestore のマップドキュメントと履歴サブコレクションをリアルタイム購読する。

- **ヘッダー**: 戻る／タイトル編集／SVG・PNG エクスポート／✨AIで生成／🏷️マスタ管理／🗺️ページ設定／🔒共有（公開トグル）／🕐履歴／**保存ステータス表示**（自動保存・保存待ち・保存中・保存済み・保存失敗）。
- **公開時**: 共有URL（`/share/[id]`）バナーを表示しコピー可能。
- **中央**: `MindMapCanvas`（編集可能）。履歴プレビュー中は閲覧専用キャンバスに切替＋復元バナー。
- **右サイドバー**:
  - LINEモード時: `LineMessagePanel`（選択ノードの配信設定）。
  - 履歴表示時: バージョン履歴（日付グルーピング、手動保存、復元、コピー作成）。
- 右下に **アプリ設定ボタン**。
- 各種モーダル: LINE プレビュー／アプリ設定／ページ設定／AI生成／タグ・友だち情報マスタ。

### 4-4. `/share/[id]`（公開閲覧）
- `isPublic === true` のマップのみ閲覧可能（それ以外は「公開されていません」表示）。
- 閲覧専用の `MindMapCanvas`（`readOnly`）。編集不可。未ログインでも閲覧可（画像も Storage 公開読み取りで表示）。

---

## 5. キャンバス機能（MindMapCanvas）

自作 SVG キャンバス。中心 `(0,0)` を基準にした座標系で、`pan`（平行移動）と `zoom`（拡大率）でビューを制御する。

### 5-1. ノード（MindMapNode）
- **形状（shape）**: `pill`（カプセル）/ `rect`（四角）/ `circle`（円）/ `diamond`（ダイヤ）/ `text`（テキストのみ）。
- **書式**: 背景色、文字色、太字、斜体、フォントサイズ（9〜28）。
- **付加要素**: 画像（imageUrl、ローカルアップロード or URL、リサイズ可）、リンク（url）、メモ（note、ホバー説明）、URL アイコン。
- **チェックボックスノード**: `isCheckbox` でチェック可能なノードに切替。
- **優先度（priority）**: 数字バッジ（赤）で重要度を表示。右クリックメニューで増減。
- **折りたたみ（collapsed）**: 子ノードの表示/非表示。
- **接続線（エッジ）**: 親子を曲線（curve）または直線（straight）で結ぶ（ページ設定で切替）。枠線太さもページ設定で 0/1/2/3px。

### 5-2. 特殊ノード
- **リストノード（listItems）**: ノードを「リスト」に変換。タイプは `checkbox`（チェックリスト）/ `numbered`（番号）/ `bullet`（箇条書き）。ネスト（子アイテム）対応、チェック・並び、項目追加・削除、折りたたみ可。
- **ノートノード（noteContent）**: 本文を持つ大きめのカード。**簡易 Markdown**（見出し h1/h2、箇条書き等）をパースして描画。ダブルクリック or ホバーポップアップ上でその場編集→自動保存。

### 5-3. 付箋（StickyNote）
- 背景でカラフルな付箋を配置（黄/ピンク/緑/青/紫/オレンジ）。テキスト編集、移動、リサイズ、色変更、削除。
- 背景の右クリックメニュー「📌 付箋」で追加。

### 5-3b. 関連線（Connection）
- **親子ツリーとは別**に、任意のノード同士を自由につなぐ線。枝をまたいだ「関連」を表現する。
- **作成**: ノードにホバー（または選択）すると四辺に **接続ハンドル（teal の ◦）** が出る。そこから**ドラッグして相手ノードの上で離す**と接続。空白で離すとキャンセル。
- **見た目**: グレーの**破線＋矢印**。`edgeStyle`（曲線/直線）に追従。
- **削除**: 線をクリックで選択（青くハイライト）→ 中点の **✕** をクリック、または Delete キー。
- **データ**: `MindMap.connections: Connection[]`（`{ id, from, to, color? }`）。ノード削除時は両端を参照する線も自動で掃除。Undo/Redo・SVG/PNG エクスポート・公開ページにも反映。

### 5-4. エリア（CanvasArea）
- ノードをグルーピングする矩形領域。タイトル・色付き。移動するとエリア内ノードも連動。リサイズ可。
- 背景の右クリックメニュー「🗂️ エリア」で追加。

### 5-5. 操作・インタラクション
- **ノード追加**: Tab（子ノード）/ Enter（兄弟ノード）。右クリックメニューから方向指定（右/左/上/下）でも追加可。
- **編集**: F2 / Space / ダブルクリックでインライン編集。
- **選択**: クリック選択、Ctrl+A で全選択、ドラッグで範囲選択（マーキー）。
- **移動**: ドラッグ。複数選択時はまとめて移動＋整列ツールバー。
- **整列ガイド（補助線）**: 単一ノードのドラッグ時、他ノードと中心が揃う位置で**水平/垂直の補助線**を表示し 8px 以内でスナップ。**エリアのドラッグ時も同様に補助線＋スナップ**（エリア中心を他ノード・他エリアの中心に合わせる）。
- **コピー/貼り付け**: Ctrl+C / Ctrl+V。**画像のペースト**（クリップボードからの画像→Storage アップロード）対応。
- **削除**: Delete。**選択ノードだけを削除し、その子ノードは削除されない最も近い祖先へ自動で繋ぎ替える**（中間ノードを消すと前後＝親と子がそのままつながる。子孫を巻き込んで一括削除はしない）。
- **Undo / Redo**: Ctrl+Z / Ctrl+Y（または Ctrl+Shift+Z）。`HistoryState = { nodes, stickyNotes, areas }` を一括管理。
- **整列**: 複数選択時の整列ツールバー、右クリック「⚡ 兄弟ノードを整列」。
- **右クリックメニュー**:
  - ノード上: **2段構成**。トップ階層はコンパクトな1列（名前を変更／ノート追加・編集・削除／削除＋カテゴリ入口）で、各カテゴリを選ぶと **同じパネル内で1段下のサブメニュー**（「← 戻る」で復帰）に切り替わる。
    - 🎨 **見た目**: 形状・ノード色・テキスト書式（B/i/サイズ）・文字色。
    - 🚩 **優先度**: 数字バッジの増減（単一選択時）。
    - ☰ **リスト**: リストへ変換／リストタイプ変更／通常ノードへ戻す。
    - ⚙️ **その他**: 兄弟ノードを整列・チェックボックス化。
    - ドラッグハンドルでパネル自体を移動可。複数選択時は適用個数を表示し、2ノード時は位置入れ替えも出る。
  - 付箋上: 色変更・削除。
  - エリア上: 色変更・削除。
  - 背景: 付箋・エリアの挿入。
- **ズーム/パン**: ホイール等でズーム、ドラッグで平行移動。

### 5-6. エクスポート
- **SVG**: ノード・付箋・エリア・タグ/情報バッジまで含めて SVG 文字列を生成しダウンロード。
- **PNG**: SVG を画像化して PNG 出力。
- ポップアップやマスタ管理の中身は画像に含めない。

---

## 6. LINE モード機能

`mode: "line"` のマップで有効。マインドマップでシナリオ構成を描きつつ、各ノードに配信メッセージを設計できる。

### 6-1. 配信メッセージ（LineMessageData）
右サイドバー `LineMessagePanel` で選択ノードに紐付ける。3タイプ:

| タイプ | 内容 |
|---|---|
| **text** | テキスト本文のみ |
| **button** | 画像＋タイトル＋テキスト＋ボタン（最大4） |
| **carousel** | 複数カード（最大10）。各カード = 画像＋タイトル＋テキスト＋ボタン（最大3） |

### 6-2. プレビュー（LinePreviewModal）
- **スマホ実機風の枠（375px、ステータスバー付き）** で LINE トーク画面を再現。
- LINE グリーン `#06C755`、吹き出し・カルーセルカード・ボタンを忠実に描画。

---

## 7. タグ・友だち情報機能（Lステップ風）

> 詳細は `docs/タグ・友だち情報機能_要件定義.md`。**提案図としての視覚表現**が目的（実際の友だち管理DBではない）。

### 7-1. マスタ（マップ単位で共通）
- **タグマスタ**: `TagGroup`（グループ）＋ `TagDef`（名前・色・所属グループ）。
- **友だち情報マスタ**: `FriendFieldDef`（項目名のみ）。
- マスタは `MindMap` ドキュメントに `tagGroups` / `tagDefs` / `friendFields` として保存。

### 7-2. ノードへの付与
- 各ノードは **マスタの id を参照**（`tagIds` / `friendFieldIds`）。名前・色はマスタが正。
- ツールバーの「🏷️」または `NodeTagFieldPopup` で付与/解除。新規タグ・項目はその場でマスタに追加→即付与。
- ノードに **🏷️N / 📝N バッジ** を常時表示（エクスポートにも反映）。

### 7-3. マスタ管理（TagFieldMasterModal）
- ヘッダー「🏷️マスタ管理」から開く。グループ/タグ/項目の追加・リネーム・色変更・グループ移動・削除。
- 削除時は使用ノード数を警告し、削除すると各ノードの参照からも掃除する（`cleanupNodeRefs`）。

---

## 8. AI マインドマップ生成

### 8-1. フロント（AiGenerateModal / lib/aiGenerate.ts）
- 設計書・企画書・箇条書き・議事録などのテキストを貼り付けると、AI が **たたき台のマインドマップ** を生成し既存マップに追加。
- AI は **木構造（id/text/parentId/color）のみ** を返し、**座標はフロントの自動レイアウト**（`layoutTree`：横型ツリー、世代ごとに右展開、兄弟が重ならないよう縦幅を計算）で決定。
- マップが空＆タイトル未設定なら AI のタイトルを採用。
- 今月の AI 利用料が **¥100 超** で警告表示（`useAiUsage`）。

### 8-2. バックエンド（functions/index.js: generateMindMap）
- callable 関数（`asia-northeast1`、認証必須、timeout 120s、512MiB）。
- モデル: **`claude-haiku-4-5-20251001`**（max_tokens 4096）。
- システムプロンプトで「JSONのみ・ルート1つ・2〜4階層・1ノード40字以内・10〜40ノード・パレットから配色」を厳守させる。
- 入力は 2万文字まで。コードフェンスが付いても剥がして JSON パース。
- **利用料を概算して Firestore `ai_usage/{YYYY-MM}` に月次積算**（input $1.0 / output $5.0 per Mtok、USD→JPY=160 の概算。アラート用で請求厳密値ではない）。
- エラーは 401/429/529 等を日本語メッセージにマッピング。

---

## 9. データモデル（types/index.ts）

### MindMap（`maps/{id}`）
```ts
interface MindMap {
  id: string;
  title: string;
  nodes: MindMapNode[];
  ownerId: string;
  createdAt: number;
  updatedAt: number;
  folder?: string;
  tags?: string[];                 // マップ分類用（機能用 tagDefs とは別物）
  isPublic?: boolean;
  edgeStyle?: "curve" | "straight";
  defaultShape?: "pill" | "rect" | "circle" | "diamond" | "text";
  nodeBorderWidth?: number;
  stickyNotes?: StickyNote[];
  areas?: CanvasArea[];
  connections?: Connection[];      // ノード同士の関連線（親子ツリーとは別）
  mode?: "mindmap" | "line";
  tagGroups?: TagGroup[];          // Lステップ風タグマスタ
  tagDefs?: TagDef[];
  friendFields?: FriendFieldDef[];
}
```

### MindMapNode
```ts
interface MindMapNode {
  id: string; text: string; x: number; y: number;
  parentId: string | null; color: string;
  icon?: string; note?: string; url?: string; imageUrl?: string;
  collapsed?: boolean;
  shape?: "pill" | "rect" | "circle" | "diamond" | "text";
  fontBold?: boolean; fontItalic?: boolean; fontSize?: number; textColor?: string;
  imageWidth?: number; imageHeight?: number; customWidth?: number; customHeight?: number;
  lineMessage?: LineMessageData;   // LINEモードの配信設定
  noteContent?: string;            // ノートノード本文（簡易Markdown）
  isCheckbox?: boolean; checked?: boolean; priority?: number;
  listItems?: ListItem[];          // リストノード
  listFontSize?: number;
  listType?: "checkbox" | "numbered" | "bullet";
  tagIds?: string[];               // 付与タグ（TagDef.id 参照）
  friendFieldIds?: string[];       // 付与友だち情報項目（FriendFieldDef.id 参照）
}
```

### その他
- `ListItem { id, text, checked, children? }`
- `TagGroup { id, name }` / `TagDef { id, name, color, groupId|null }` / `FriendFieldDef { id, name }`
- `LineMessageData`（type=text/button/carousel）/ `LineButton` / `LineCarouselCard`
- `CanvasArea { id, x, y, width, height, title, color }`
- `Connection { id, from, to, color? }` … ノード同士の関連線（from/to はノード id）
- `StickyNote { id, x, y, text, color, width, height }`
- `HistoryEntry { id, nodes, savedAt, name? }`

### サブコレクション
- `maps/{id}/history/{autoId}` … バージョン履歴（`{ nodes, savedAt, name? }`、最新50件購読）。

### グローバル
- `ai_usage/{YYYY-MM}` … AI 利用料の月次積算（`month, inputTokens, outputTokens, costJpy, calls, updatedAt`）。

---

## 10. 保存・状態管理（重要）

> 不用意に触るとデータ消失につながるため、改修時は要注意。

- **デバウンス一括保存**: `saveNodes` / `saveStickyNotes` / `saveAreas` は共通の `pendingSave` ref に種類別に蓄積し、**800ms デバウンス** で `flushSaves()` がまとめて Firestore へ書き込む（タイマーが上書きされてもデータが消えないよう蓄積方式）。
- **保存ステータス**: idle / pending / saving / ok / error をヘッダー表示。失敗時はエラー文を表示し `pendingSave` を戻す。
- **バージョン履歴**: ノード保存時、前回履歴から **60秒以上** 経過していれば履歴サブコレクションへ自動スナップショット。手動保存も可（名前付き）。
- **リロード前のフラッシュ**: コンポーネント unmount 時・`beforeunload`・設定モーダルからの再起動時に `flushSaves()` を await してからリロードする（データ消失防止）。
- **画像は Storage へ**: Firestore は 1ドキュメント 1MiB 上限のため、画像本体（data URL）はマップに保存せず Storage にアップロードして **URL だけ** を保存（`lib/uploadImage.ts`）。アップロード失敗時のみ 0.9MB 以下なら data URL でフォールバック。
- **マスタ更新**: `tagGroups/tagDefs/friendFields` はマップドキュメントを直接 `updateDoc`。

---

## 11. 認証・セキュリティ

- **認証**: Google OAuth（`signInWithPopup`）。`AuthContext` が `onAuthStateChanged` で user/loading を管理。
- **マップアクセス**: 一覧は `ownerId == user.uid` で自分のもののみ。公開マップは `isPublic` で `/share/[id]` から誰でも閲覧。
- **Storage ルール**（`storage.rules`）: `maps/{mapId}/images/` 配下は **読み取り誰でも可**（共有ページの未ログイン閲覧用）、**書き込みはログイン済み・画像のみ・5MBまで**。
- **AI 関数**: 認証必須（`request.auth` 無しは拒否）。API キーは Secret Manager。

---

## 12. バージョン管理・配信

### 12-1. バージョン
- バージョンファイル: `lib/version.ts`（`APP_VERSION`）。形式 `MAJOR.MINOR.PATCH`。
  - バグ修正 → PATCH、機能追加 → MINOR、破壊的変更 → MAJOR。
- `/api/version` が現行バージョンを返し、`useVersionCheck` が比較して「更新あり」を検知（設定ボタンに赤バッジ→`SettingsModal` で更新）。

### 12-2. Web（メイン）
- `git push origin main` → **Vercel が自動デプロイ**。

### 12-3. デスクトップ（Electron / NSIS + electron-updater）
- `electron-app/` は **本番URL（`https://futa-mind-map.vercel.app`）を読み込むだけの薄いシェル**。機能改修は Web と同じく push で自動反映されるため、**シェル自体を直したときだけ** 再配布する。
- 配布方式: **NSIS インストーラ + electron-updater + GitHub Release**（統括ルールの標準）。
  - `futa-mind-map` は **public リポ**なので Release は**同一リポ**へ出す（配信専用リポ不要・トークン同梱問題なし）。`publish` = `{ provider: github, owner: fffuttta-design, repo: futa-mind-map, releaseType: release }`。
  - **白アイコン問題は原理的に発生しない**（NSIS がアプリを Windows に登録するため）。
  1. `electron-app/package.json` の `version` を上げる。
  2. `git tag desktop-v1.3.x && git push origin desktop-v1.3.x`。
  3. GitHub Actions（`.github/workflows/desktop-release.yml`）が Windows で NSIS をビルドし、`FutaMindMap-setup.exe` と **`latest.yml`** をリリース `v{version}` に `--publish always` で公開（安全弁で exe/blockmap/latest.yml を `--clobber` 再アップロード＋draft 解除）。
  4. 各PCのアプリは **electron-updater が起動3秒後＋3分ごとに `latest.yml` を確認 → 自動DL → 「今すぐ再起動」ダイアログで自動インストール**（手動置き換え不要、`autoInstallOnAppQuit` で終了時にも適用）。
- 成果物ファイル名は固定 **`FutaMindMap-setup.exe`**（`win.artifactName`）。
- ローカルビルド確認: `cd electron-app && npm run build`（`--publish never`）。実公開は `npm run release`（`--publish always`、要 `GH_TOKEN`）。
- ⚠️ `latest.yml` が無いと自動更新は一切効かない。`nsis.installDir` は electron-builder@26 で書くとビルドが落ちる。
- 📌 旧ポータブル版（〜desktop-v1.2.1）のユーザーは初回だけ手動で `FutaMindMap-setup.exe` をインストールする必要がある（旧EXEに更新機能が無いため）。以降は自動更新に乗る。
- Electron 仕様: シングルインスタンス、メニューバー非表示、`setAppUserModelId`、Google/Firebase 認証ポップアップは内部・外部リンクは既定ブラウザで開く。

### 12-4. Android
- APK / Play Store ビルド＆配布（手順は別途）。

---

## 13. 開発コマンド

```bash
npm run dev      # 開発サーバ（localhost:3000）
npm run build    # 本番ビルド
npm run start    # 本番サーバ
npm run lint     # ESLint

# Cloud Functions（functions/ 配下）
npm run serve    # エミュレータ
npm run deploy   # firebase deploy --only functions
npm run logs     # functions ログ

# デスクトップ（electron-app/ 配下）
npm run start    # electron 起動
npm run build    # ポータブルEXEビルド
```

---

## 14. コミット規約

```
fix: 〇〇のバグを修正
feat: 〇〇機能を追加
refactor: 〇〇をリファクタリング
chore: 設定・雑務
```

改修したら **`lib/version.ts` を上げて** からコミットし、`git push origin main` で Vercel デプロイを起動する。

---

## 15. 既知の注意点・補足

- ノード・付箋・エリアのすべての操作で `localModifiedAt`（ローカル編集直後はスナップショットで上書きしない）・`pushUndo()` を忘れないこと。
- Firestore 1MiB 上限のため画像は必ず Storage 経由。
- AI 生成の座標はフロントの自動レイアウトに任せる（AI には座標を出させない）。
- `Next.js 16` は破壊的変更を含むため、不明点は `node_modules/next/dist/docs/` を参照（`AGENTS.md`）。
