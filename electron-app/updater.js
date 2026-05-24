/**
 * updater.js — Google ドライブベースのカスタム自動アップデーター
 *
 * 【使い方】
 *  1. version.json を Google ドライブにアップロードして「リンクを知っている全員」に公開
 *  2. 下の VERSION_JSON_URL にそのファイルIDを設定
 *  3. 新バージョンをリリースするときは：
 *       ① 新しい .exe を Google ドライブにアップロード（同名ファイルを上書き or 新規）
 *       ② version.json の version と url を更新してアップロード
 *     → インストール済みのアプリが次回起動時に自動検知
 */

const { net, app, dialog, shell } = require("electron");
const { createWriteStream } = require("fs");
const { join } = require("path");
const { tmpdir } = require("os");
const { spawn } = require("child_process");

// ─────────────────────────────────────────────────────────────
// ★ ここに version.json の Google ドライブ ファイルID を設定
const VERSION_JSON_FILE_ID = "YOUR_VERSION_JSON_FILE_ID_HERE";
// ─────────────────────────────────────────────────────────────

function driveDownloadUrl(fileId) {
  return `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`;
}

// バージョン比較（1=v1が新しい、-1=v2が新しい、0=同じ）
function compareVersions(v1, v2) {
  const p1 = v1.split(".").map(Number);
  const p2 = v2.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((p1[i] || 0) > (p2[i] || 0)) return 1;
    if ((p1[i] || 0) < (p2[i] || 0)) return -1;
  }
  return 0;
}

// Google ドライブから JSON を取得
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = net.request({ url, redirect: "follow" });
    let body = "";
    req.on("response", (res) => {
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error("JSON parse error")); }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end();
  });
}

// ファイルをダウンロード（進捗コールバック付き）
function downloadFile(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const req = net.request({ url, redirect: "follow" });
    req.on("response", (res) => {
      const total = parseInt(res.headers["content-length"] || "0", 10);
      let received = 0;
      const file = createWriteStream(destPath);
      res.on("data", (chunk) => {
        received += chunk.length;
        file.write(chunk);
        if (total > 0) onProgress(received / total);
      });
      res.on("end", () => { file.close(resolve); });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.end();
  });
}

// メイン：アップデートチェック
module.exports = async function checkForUpdates(win) {
  if (VERSION_JSON_FILE_ID === "YOUR_VERSION_JSON_FILE_ID_HERE") return; // 未設定

  try {
    const remote = await fetchJson(driveDownloadUrl(VERSION_JSON_FILE_ID));
    const current = app.getVersion();

    if (compareVersions(remote.version, current) <= 0) return; // すでに最新

    const { response } = await dialog.showMessageBox(win, {
      type: "info",
      title: "アップデートがあります",
      message: `FutaMindMap v${remote.version} が利用できます（現在 v${current}）`,
      detail: remote.notes ? `更新内容:\n${remote.notes}` : "",
      buttons: ["ダウンロードして更新", "後で"],
      defaultId: 0,
    });

    if (response !== 0) return;

    const destPath = join(tmpdir(), `FutaMindMap-Setup-${remote.version}.exe`);

    // ── ダウンロード ──
    win.setProgressBar(0);
    win.setTitle("FutaMindMap — ダウンロード中...");

    await downloadFile(remote.url, destPath, (progress) => {
      win.setProgressBar(progress);
      win.setTitle(`FutaMindMap — ${Math.round(progress * 100)}% ダウンロード中`);
    });

    win.setProgressBar(-1);
    win.setTitle("FutaMindMap");

    // ── インストール確認 ──
    const { response: installRes } = await dialog.showMessageBox(win, {
      type: "info",
      title: "準備完了",
      message: "ダウンロードが完了しました。",
      detail: "インストーラーを起動してアプリを更新します。\nアプリを終了しますか？",
      buttons: ["インストール開始", "キャンセル"],
      defaultId: 0,
    });

    if (installRes === 0) {
      spawn(destPath, [], { detached: true, stdio: "ignore" }).unref();
      app.quit();
    }
  } catch (err) {
    // オフライン・通信エラーは静かに無視
    console.log("[Updater] check failed:", err.message);
  }
};
