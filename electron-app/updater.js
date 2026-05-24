/**
 * updater.js — Google ドライブ（ローカルマウント）ベースの自動アップデーター
 *
 * 仕組み：
 *   - 自分のビルド情報 → build-info.json（asar内に焼き込み済み）
 *   - 最新の情報       → version.json（EXEの隣 = Googleドライブ上）
 *   - builtAt が一致しなければ更新あり → app.relaunch() で再起動
 *
 * 更新手順：
 *   1. npm run release → dist/win-unpacked/ が生成される
 *   2. dist/win-unpacked/ の中身をすべて Google ドライブフォルダに上書きコピー
 *   3. Drive Desktop が他端末に自動同期 → 次回起動時に再起動ダイアログが出る
 */

const { app, dialog } = require("electron");
const { readFileSync } = require("fs");
const { join, dirname } = require("path");

module.exports = async function checkForUpdates(win) {
  try {
    // 自分のビルド情報（asar に焼き込み済み）
    const buildInfo = require("./build-info.json");

    // version.json は EXE の隣に置いてある（Google ドライブ上）
    const versionPath = join(dirname(app.getPath("exe")), "version.json");
    const remote = JSON.parse(readFileSync(versionPath, "utf-8"));

    // builtAt が同じなら最新版 → 何もしない
    if (buildInfo.builtAt === remote.builtAt) return;

    const { response } = await dialog.showMessageBox(win, {
      type: "info",
      title: "アップデートがあります",
      message: `FutaMindMap v${remote.version} が利用できます`,
      detail: remote.notes
        ? `更新内容:\n${remote.notes}\n\n今すぐ再起動して最新版を適用しますか？`
        : "Google ドライブ上のファイルが更新されました。\n再起動して最新版を適用しますか？",
      buttons: ["今すぐ再起動", "後で"],
      defaultId: 0,
    });

    if (response === 0) {
      app.relaunch();
      app.exit(0);
    }
  } catch {
    // version.json が見つからない（インストーラー版など）は静かにスキップ
  }
};
