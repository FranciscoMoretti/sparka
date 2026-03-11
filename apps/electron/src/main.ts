import * as path from "node:path";
import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  session,
  shell,
  Tray,
} from "electron";
import { autoUpdater } from "electron-updater";
import { APP_SCHEME, APP_URL, TITLEBAR_HEIGHT, WINDOW_DEFAULTS } from "./config";

// Register the custom protocol as a handler for OAuth deep-link callbacks.
// Must be called before app is ready.
app.setAsDefaultProtocolClient(APP_SCHEME);

// On Windows, a second instance is launched when the OS opens a deep link.
// We grab the URL from argv and quit the duplicate instance.
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

let isQuitting = false;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// --- Deep-link / OAuth callback ---

const OAUTH_HOSTS = [
  "https://accounts.google.com",
  "https://github.com/login/oauth",
];

function isAuthCallbackUrl(url: URL): boolean {
  if (url.protocol !== `${APP_SCHEME}:`) {
    return false;
  }

  return (
    url.pathname === "/auth/callback" ||
    (url.host === "auth" && url.pathname === "/callback")
  );
}

async function handleDeepLink(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return;
  }

  if (!isAuthCallbackUrl(parsed)) {
    return;
  }

  const token = parsed.searchParams.get("token");
  if (!token) return;

  try {
    const res = await fetch(
      `${APP_URL}/api/auth/electron-exchange?token=${encodeURIComponent(token)}`
    );
    if (!res.ok) {
      console.error("electron-exchange failed:", res.status);
      return;
    }
    const { sessionToken } = (await res.json()) as { sessionToken?: string };
    if (!sessionToken) return;

    // Inject the Better Auth session cookie into Electron's webview session.
    await session.defaultSession.cookies.set({
      url: APP_URL,
      name: "better-auth.session_token",
      value: sessionToken,
      httpOnly: true,
      secure: APP_URL.startsWith("https"),
      sameSite: "lax",
    });

    mainWindow?.show();
    mainWindow?.focus();
    mainWindow?.webContents.reload();
  } catch (err) {
    console.error("Deep-link auth error:", err);
  }
}

function getAppAssetPath(...segments: string[]): string {
  return path.join(app.getAppPath(), ...segments);
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

  win.webContents.on("did-finish-load", () => {
    win.webContents.insertCSS(`
      :root { --electron-titlebar-height: ${TITLEBAR_HEIGHT}px !important; }
      body { padding-top: var(--electron-titlebar-height) !important; }
      [data-slot="sidebar-container"] {
        top: var(--electron-titlebar-height) !important;
        height: calc(100svh - var(--electron-titlebar-height)) !important;
      }
    `);
  });

  // Intercept top-level navigations to OAuth providers and open them in the
  // user's default browser instead (where they're already logged in).
  win.webContents.on("will-navigate", (event, url) => {
    if (OAUTH_HOSTS.some((prefix) => url.startsWith(prefix))) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Open all new-window requests (including OAuth popups) in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
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


// macOS: deep link arrives as open-url on the already-running instance.
app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Windows/Linux: deep link causes a second instance launch; grab the URL from argv.
app.on("second-instance", (_event, argv) => {
  const url = argv.find((arg) => arg.startsWith(`${APP_SCHEME}://`));
  if (url) handleDeepLink(url);
  mainWindow?.show();
  mainWindow?.focus();
});

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
