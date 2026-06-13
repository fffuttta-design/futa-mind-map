# FutaMindMap — 開発ルール

> **このドキュメントは開発・改修を行う際に必ず参照すること。**

---

## 0. 仕様書（FutaMindMap仕様書.md）— 起動時に必ず読む

- **このプロジェクトで作業を始めるときは、必ず `FutaMindMap仕様書.md` を最初に読み込むこと。**
  アプリの全機能・データ構造・保存フロー・配信手順が網羅されている。実装の前提として常に参照する。
- **機能を変更・追加・削除したら、`FutaMindMap仕様書.md` も併せて更新すること。**
  仕様（画面・ノード機能・LINE/タグ機能・データモデル・保存方式・配信手順など）に変化が出た改修では、
  コードと同じコミットで仕様書を最新化する。仕様書が実態とずれた状態で放置しない。
- 更新時は本文先頭の「最終更新基準（バージョン）」も合わせて直す。

---

## 1. バージョン管理ルール

改修・機能追加・バグ修正を行ったら、**必ずバージョンを上げてからコミットすること。**

- バージョンファイル: `lib/version.ts`
- 形式: `MAJOR.MINOR.PATCH`（例: `1.0.60`）
- バグ修正 → PATCH を +1
- 機能追加 → MINOR を +1
- 破壊的変更 → MAJOR を +1

```ts
// lib/version.ts
export const APP_VERSION = "1.0.xx";
```

---

## 2. デプロイ対象

改修後は **以下の全プラットフォームへ配信** すること。

| プラットフォーム | 手順 |
|---|---|
| **Web** | `git push origin main` → Vercel が自動デプロイ |
| **デスクトップ** | 下記「デスクトップ版の配布」参照（NSIS + electron-updater / GitHub Release） |
| **Android** | APK / Play Store ビルド & 配布（手順は別途） |

### デスクトップ版の配布（NSIS + electron-updater）

デスクトップ版（`electron-app/`）は **Vercel の本番URLを読み込む薄いシェル**。
中身（機能改修）は Web と同じく `git push` で自動反映されるため、**シェル自体を直した時だけ**再配布すればよい。

配布方式は統括ルールの標準＝ **NSIS インストーラ + electron-updater + GitHub Release**：

- `futa-mind-map` は **public リポ**なので、Release は**同一リポ**へ出す（配信専用リポは不要。
  トークン同梱問題も起きない）。`publish.repo = futa-mind-map`。
- インストーラがアプリを Windows に登録するため、**白アイコン問題は原理的に発生しない**
  （旧ポータブル＋Drive方式の自己修復ハックは不要）。

配信手順:

1. `electron-app/package.json` の `version` を上げる（fix=PATCH / feat=MINOR）
2. タグを切って push：
   ```
   git tag desktop-v1.3.x && git push origin desktop-v1.3.x
   ```
3. GitHub Actions（`.github/workflows/desktop-release.yml`）が Windows で NSIS をビルドし、
   `FutaMindMap-setup.exe` と **`latest.yml`** をリリース `v{version}` へ公開する
   （`--publish always`。安全弁で exe/blockmap/latest.yml を `--clobber` 再アップロード＋draft解除）
4. 各PCのアプリは **electron-updater が起動時/3分ごとに `latest.yml` を読み、自動DL→
   「今すぐ再起動」で自動インストール**する（ユーザーの手動置き換えは不要）

- 成果物名は固定 `FutaMindMap-setup.exe`（`win.artifactName`）。
- ローカルでビルド確認だけ: `cd electron-app && npm run build`（`--publish never`）。
  実際に公開する場合は `npm run release`（`--publish always`、要 `GH_TOKEN`=contents:write）。
- ⚠️ `latest.yml` が無いと自動更新は一切効かない（安全弁で必ず再アップロードすること）。
- ⚠️ `nsis.installDir` は electron-builder@26 で存在せずビルドが落ちるので書かない。
- ⚠️ Web版（Vercel）には一切影響しない。`electron-app/` のみの変更。
- 📌 **旧ポータブル版（〜desktop-v1.2.1）のユーザーは、初回だけ手動で
  `FutaMindMap-setup.exe` をインストール**する必要がある（旧EXEには更新機能が無いため）。
  以降は自動更新に乗る。

---

## 3. プロジェクト概要

- **アプリ名**: FutaMindMap
- **フレームワーク**: Next.js (App Router) + React 19 + TypeScript + Tailwind CSS
- **DB / Auth**: Firebase Firestore + Google OAuth
- **描画**: カスタム SVG キャンバス（ReactFlow 不使用）
- **ホスティング**: Vercel（GitHub `main` ブランチへの push で自動デプロイ）

---

## 4. 主要ファイル

| ファイル | 役割 |
|---|---|
| `lib/version.ts` | アプリバージョン定数 |
| `types/index.ts` | 全型定義（`MindMapNode`, `CanvasArea`, etc.） |
| `components/MindMapCanvas.tsx` | キャンバス本体（SVG描画・操作ロジック） |
| `components/SettingsModal.tsx` | 設定・バージョン確認・更新モーダル |
| `app/maps/[id]/page.tsx` | マップページ（Firestore 読み書き・保存制御） |
| `app/api/version/route.ts` | バージョン確認 API |

---

## 5. 保存・状態管理の注意点

- **`localModifiedAt`**: ローカル編集後2.5秒以内はFirestoreスナップショットで `setNodes` を上書きしない。ノード・エリア・付箋の**全操作**で `localModifiedAt.current = Date.now()` を更新すること。
- **`pendingSave`**: `saveNodes` / `saveStickyNotes` / `saveAreas` は共通の `pendingSave` ref に蓄積し、800ms デバウンスで一括 Firestore 書き込み（`flushSaves`）。
- **リロード前**: `flushSaves()` を await してから `window.location.reload()` すること（データ消失防止）。

---

## 6. Undo / Redo

- `HistoryState = { nodes, stickyNotes, areas }`
- `updateNodes` は `pushUndo()` + `localModifiedAt` 更新を内包。
- エリア・付箋の操作も同様に `pushUndo()` を忘れずに。
- Ctrl+Z = Undo、Ctrl+Y / Ctrl+Shift+Z = Redo。

---

## 7. コミット規約

```
fix: 〇〇のバグを修正
feat: 〇〇機能を追加
refactor: 〇〇をリファクタリング
```

コミット後は `git push origin main` で Vercel デプロイを起動する。
