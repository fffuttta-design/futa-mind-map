# FutaMindMap — 開発ルール

> **このドキュメントは開発・改修を行う際に必ず参照すること。**

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
| **デスクトップ** | 下記「デスクトップ版の配布」参照（electron-updater + GitHub Releases） |
| **Android** | APK / Play Store ビルド & 配布（手順は別途） |

### デスクトップ版の配布（自動更新の仕組み）

デスクトップ版（`electron-app/`）は **Vercel の本番URLを読み込む薄いシェル**。
中身（機能改修）は Web と同じく `git push` で自動反映されるため、**シェル自体を直した時だけ**再配布すればよい。

更新方式は **electron-updater + GitHub Releases**：

1. `electron-app/package.json` の `version` を上げる（fix=PATCH / feat=MINOR）
2. タグを切って push：
   ```
   git tag desktop-v1.1.0 && git push origin desktop-v1.1.0
   ```
3. GitHub Actions（`.github/workflows/desktop-release.yml`）が Windows でビルドし、
   インストーラ + `latest.yml` を Release に自動添付する
4. 各PCのアプリは起動時／1時間ごとに更新を検知 → ダウンロード後にダイアログ → 再起動で適用

- 初回のみ Release ページからインストーラを落として手動インストール（以後は全自動）。
- ローカルでビルドだけ確認: `cd electron-app && npm run build`（`dist/` に生成）。
- ローカルから手動公開: `cd electron-app && set GH_TOKEN=... && npm run release`。
- ⚠️ Web版（Vercel）には一切影響しない。`electron-app/` のみの変更。

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
