const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");

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
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWin = createWindow();
  });
}
