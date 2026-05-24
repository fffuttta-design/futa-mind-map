const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require("electron");
const path = require("path");
const { autoUpdater } = require("electron-updater");

const APP_URL = "https://futa-mind-map.vercel.app";

// ── 自動アップデート設定 ───────────────────────────────────────
autoUpdater.autoDownload = true;          // 更新を自動ダウンロード
autoUpdater.autoInstallOnAppQuit = true;  // 終了時に自動インストール

function setupAutoUpdater(win) {
  // 更新チェック開始（起動5秒後）
  setTimeout(() => autoUpdater.checkForUpdates(), 5000);

  autoUpdater.on("update-available", (info) => {
    win.webContents.send("update-status", `新しいバージョン v${info.version} をダウンロード中...`);
  });

  autoUpdater.on("update-downloaded", () => {
    dialog.showMessageBox(win, {
      type: "info",
      title: "アップデート完了",
      message: "FutaMindMap の新しいバージョンが準備できました。",
      detail: "今すぐ再起動してアップデートを適用しますか？",
      buttons: ["今すぐ再起動", "後で"],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on("error", (err) => {
    // 開発環境やオフライン時はエラーを静かに無視
    console.log("Auto-updater error:", err.message);
  });
}
// ──────────────────────────────────────────────────────────────

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
    show: false, // 準備完了まで非表示
  });

  // 準備できたら表示（白チカ防止）
  win.once("ready-to-show", () => {
    win.show();
  });

  win.loadURL(APP_URL);

  // 自動アップデート設定
  if (app.isPackaged) setupAutoUpdater(win);

  // 外部リンク（Google Auth など）はブラウザで開く
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL)) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  // ページ内リンクも同様
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // シンプルなメニュー（macOS 対応も含む）
  const menu = Menu.buildFromTemplate([
    {
      label: "FutaMindMap",
      submenu: [
        { label: "再読み込み", accelerator: "CmdOrCtrl+R", click: () => win.reload() },
        { type: "separator" },
        { label: "終了", accelerator: "Alt+F4", click: () => app.quit() },
      ],
    },
    {
      label: "編集",
      submenu: [
        { role: "undo", label: "元に戻す" },
        { role: "redo", label: "やり直し" },
        { type: "separator" },
        { role: "cut", label: "切り取り" },
        { role: "copy", label: "コピー" },
        { role: "paste", label: "貼り付け" },
        { role: "selectAll", label: "すべて選択" },
      ],
    },
    {
      label: "表示",
      submenu: [
        { role: "zoomIn",  label: "拡大", accelerator: "CmdOrCtrl+=" },
        { role: "zoomOut", label: "縮小", accelerator: "CmdOrCtrl+-" },
        { role: "resetZoom", label: "実際のサイズ", accelerator: "CmdOrCtrl+0" },
        { type: "separator" },
        { role: "togglefullscreen", label: "フルスクリーン" },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
