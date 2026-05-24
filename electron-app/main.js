const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");
const checkForUpdates = require("./updater");

const APP_URL = "https://futa-mind-map.vercel.app";

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

  // 自動アップデート（起動5秒後にチェック）
  if (app.isPackaged) setTimeout(() => checkForUpdates(win), 5000);

  // ポップアップ・ナビゲーションのハンドリング
  win.webContents.setWindowOpenHandler(({ url }) => {
    // Firebase / Google OAuth のポップアップは Electron 内で開く（signInWithPopup に必要）
    if (
      url.startsWith(APP_URL) ||
      url.includes("accounts.google.com") ||
      url.includes("firebaseapp.com/__/auth")
    ) {
      return { action: "allow" };
    }
    // それ以外の外部リンクはブラウザで開く
    shell.openExternal(url);
    return { action: "deny" };
  });

  // ページ内ナビゲーション（リダイレクトなど）
  win.webContents.on("will-navigate", (event, url) => {
    // Firebase auth ハンドラー・アプリ内遷移は許可
    if (
      url.startsWith(APP_URL) ||
      url.includes("accounts.google.com") ||
      url.includes("firebaseapp.com/__/auth")
    ) return;
    // それ以外はブラウザへ
    event.preventDefault();
    shell.openExternal(url);
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
