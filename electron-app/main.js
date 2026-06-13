const { app, BrowserWindow, shell, Menu, dialog } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

const APP_URL = "https://futa-mind-map.vercel.app";

const isDev = !app.isPackaged;

let mainWin = null;

// Windows のタスクバー・通知のアプリIDを appId と一致させる
if (process.platform === "win32") {
  app.setAppUserModelId("com.futamindmap.desktop");
}

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

// ── 自動更新（electron-updater + GitHub Release）─────────────
// シェル本体（このEXE）の更新。中身（機能）は Vercel が常に最新を配信する。
// 開発時（未パッケージ）は GitHub Release が無いのでチェックしない。
function setupAutoUpdater() {
  if (isDev) return;

  autoUpdater.autoDownload = true;          // バックグラウンドで自動DL
  autoUpdater.autoInstallOnAppQuit = true;  // 終了時に自動インストール

  autoUpdater.on("update-downloaded", (info) => {
    dialog
      .showMessageBox(mainWin, {
        type: "info",
        title: "アップデート準備完了",
        message: `v${info.version} の準備ができました`,
        detail: "今すぐ再起動してインストールしますか？",
        buttons: ["今すぐ再起動", "後で"],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
      });
  });

  autoUpdater.on("error", (err) => console.warn("[update]", err.message));

  // 起動3秒後に1回 + 以降3分ごとにチェック
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 3000);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 3 * 60 * 1000);
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
    mainWin.once("ready-to-show", () => setupAutoUpdater());
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWin = createWindow();
  });
}
