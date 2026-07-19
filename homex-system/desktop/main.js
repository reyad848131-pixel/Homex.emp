const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");

const configPath = path.join(app.isPackaged ? path.dirname(process.execPath) : __dirname, "config.json");
let config = { serverUrl: "https://your-domain.com" };
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
} catch {}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Homex",
    icon: path.join(__dirname, "icons", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadURL(config.serverUrl);

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    mainWindow.loadFile(path.join(__dirname, "offline.html"));
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(config.serverUrl)) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });
}

const menu = Menu.buildFromTemplate([
  {
    label: "Homex",
    submenu: [
      {
        label: "الرئيسية",
        click: () => mainWindow?.loadURL(config.serverUrl),
      },
      {
        label: "إعادة تحميل",
        accelerator: "CmdOrCtrl+R",
        click: () => mainWindow?.reload(),
      },
      { type: "separator" },
      {
        label: "تكبير",
        accelerator: "CmdOrCtrl+=",
        click: () => {
          const zoom = mainWindow?.webContents.getZoomFactor() || 1;
          mainWindow?.webContents.setZoomFactor(Math.min(zoom + 0.1, 2));
        },
      },
      {
        label: "تصغير",
        accelerator: "CmdOrCtrl+-",
        click: () => {
          const zoom = mainWindow?.webContents.getZoomFactor() || 1;
          mainWindow?.webContents.setZoomFactor(Math.max(zoom - 0.1, 0.5));
        },
      },
      { type: "separator" },
      {
        label: "حول البرنامج",
        click: () => {
          dialog.showMessageBox(mainWindow, {
            type: "info",
            title: "Homex",
            message: `Homex v${app.getVersion()}`,
            detail: "نظام إدارة عروض الأسعار\nHomex Quotation Management System",
          });
        },
      },
      { type: "separator" },
      { label: "خروج", role: "quit" },
    ],
  },
]);

app.whenReady().then(() => {
  Menu.setApplicationMenu(menu);
  createWindow();

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on("window-all-closed", () => app.quit());

autoUpdater.on("update-available", () => {
  dialog.showMessageBox(mainWindow, {
    type: "info",
    title: "تحديث متاح",
    message: "يوجد تحديث جديد للبرنامج. سيتم تحميله تلقائياً.",
  });
});

autoUpdater.on("update-downloaded", () => {
  dialog
    .showMessageBox(mainWindow, {
      type: "info",
      title: "تحديث جاهز",
      message: "تم تحميل التحديث. هل تريد إعادة تشغيل البرنامج للتحديث؟",
      buttons: ["إعادة التشغيل", "لاحقاً"],
    })
    .then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
});
