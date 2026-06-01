const { app, BrowserWindow, shell, Menu, dialog } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

const APP_URL = "https://futa-mind-map.vercel.app";

let mainWin = null;

// ── 認証/自サイトのURL判定 ───────────────────────────────────
function isInternalUrl(url) {
  return (
    url.startsWith(APP_URL) ||
    url.includes("accounts.google.com") ||
    url.includes("firebaseapp.com")
  );
}

// ── BrowserWindow 作成 ──────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: "FutaMindMap",
    icon: path.join(__dirname, "build", "icon.ico"),
    autoHideMenuBar: true,
    backgroundColor: "#f9fafb",
    show: false, // 準備完了まで非表示（白チカ防止）
  });

  win.once("ready-to-show", () => win.show());

  win.loadURL(APP_URL);

  // ポップアップ（Firebase / Google OAuth）は Electron 内、外部リンクは既定ブラウザ
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url)) return { action: "allow" };
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (e, url) => {
    if (!isInternalUrl(url)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  return win;
}

// ── 自動更新（electron-updater / GitHub Releases） ───────────
// アプリ枠（Electronシェル）のみを更新する。中身（Webアプリ）は
// Vercel が常に最新を配信するため、更新の仕組みは不要。
function setupAutoUpdater(win) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-downloaded", async (info) => {
    const { response } = await dialog.showMessageBox(win, {
      type: "info",
      title: "アップデートがあります",
      message: `FutaMindMap v${info.version} が利用できます`,
      detail: "今すぐ再起動して最新版を適用しますか？\n（あとで再起動した時にも自動で適用されます）",
      buttons: ["今すぐ再起動", "あとで"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.on("error", (err) => {
    console.error("[autoUpdater]", err == null ? "unknown error" : err.message);
  });

  // 起動直後 + 1時間ごとにチェック
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 60 * 60 * 1000);
}

// ── シングルインスタンス ────────────────────────────────────
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWin) {
      if (mainWin.isMinimized()) mainWin.restore();
      mainWin.show();
      mainWin.focus();
    }
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    mainWin = createWindow();
    if (app.isPackaged) setupAutoUpdater(mainWin);
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWin = createWindow();
  });
}
