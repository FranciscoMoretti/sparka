import * as path from "node:path";
import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  shell,
  Tray,
} from "electron";
import { autoUpdater } from "electron-updater";
import { APP_URL, TITLEBAR_HEIGHT, WINDOW_DEFAULTS } from "./config";

let isQuitting = false;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

function getAppAssetPath(...segments: string[]): string {
  return path.join(app.getAppPath(), ...segments);
}

function getTitlebarStyles(): string {
  return `
    :root {
      --electron-titlebar-height: ${TITLEBAR_HEIGHT}px !important;
    }

    body {
      padding-top: var(--electron-titlebar-height) !important;
    }

    [data-slot="sidebar-container"] {
      top: var(--electron-titlebar-height) !important;
      bottom: 0 !important;
      height: calc(100svh - var(--electron-titlebar-height)) !important;
    }
  `;
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    ...WINDOW_DEFAULTS,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 10 },
    webPreferences: {
      preload: getAppAssetPath("dist", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(APP_URL);

  win.webContents.on("did-finish-load", async () => {
    await win.webContents.insertCSS(getTitlebarStyles());
  });

  // Handle OAuth popups and external links
  win.webContents.setWindowOpenHandler(({ url }) => {
    const oauthHosts = [
      "accounts.google.com",
      "github.com/login",
      "github.com/sessions",
    ];
    const isOAuth = oauthHosts.some((host) => url.includes(host));

    if (isOAuth) {
      win.loadURL(url);
      return { action: "deny" };
    }

    shell.openExternal(url);
    return { action: "deny" };
  });

  // Minimize to tray on close
  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: "detach" });
  }

  return win;
}

function createTray(): Tray {
  const iconPath = getAppAssetPath("build", "icon.png");
  const trayIcon = nativeImage.createFromPath(iconPath);
  const t = new Tray(trayIcon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show ChatJS",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  t.setToolTip("ChatJS");
  t.setContextMenu(contextMenu);

  t.on("click", () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });

  return t;
}

function setupAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (err) => {
    console.error("AutoUpdater error:", err);
  });

  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
}


app.whenReady().then(() => {
  mainWindow = createWindow();
  tray = createTray();
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
    } else {
      mainWindow?.show();
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  tray?.destroy();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
