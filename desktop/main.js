// Electron main process for the Silicon Interface desktop app.
//
// Boots the Next.js standalone server (bundled at resources/standalone by
// electron-builder, see electron-builder.yml) on 127.0.0.1, waits for it to
// accept connections, then opens a BrowserWindow pointed at it. The server
// runs in a utilityProcess so it uses Electron's embedded Node — users don't
// need Node installed.

const { app, BrowserWindow, session, shell, utilityProcess } = require("electron");
const net = require("node:net");
const path = require("node:path");

// Preferred fixed port so the app's origin (http://127.0.0.1:17893) stays
// stable across launches — Glass allowlists exact CORS origins, so a stable
// origin can simply be added to its CORS_ALLOWED_ORIGINS. Falls back to an
// ephemeral port if taken; the CORS shim below keeps the API working either way.
const PREFERRED_PORT = 17893;

// Glass production API — must match the NEXT_PUBLIC_API_BASE baked into the
// desktop build (see the root `desktop:build` script).
const GLASS_BASE = "https://glass.teamofsilicons.com";
// An origin Glass already allowlists; outgoing API requests masquerade as it.
const SPOOFED_ORIGIN = "https://interface.teamofsilicons.com";

let serverProc = null;
let mainWindow = null;

// --- port helpers ------------------------------------------------------------

// Resolves with the bound port if `port` (or, with 0, any free port) could be
// bound on loopback; null if it's taken.
function tryListen(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.once("error", () => resolve(null));
    srv.listen(port, "127.0.0.1", () => {
      const bound = srv.address().port;
      srv.close(() => resolve(bound));
    });
  });
}

async function pickPort() {
  return (await tryListen(PREFERRED_PORT)) ?? (await tryListen(0));
}

// Polls until the server accepts TCP connections (or times out).
function waitForServer(port, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const sock = net.connect({ host: "127.0.0.1", port });
      sock.once("connect", () => {
        sock.destroy();
        resolve();
      });
      sock.once("error", () => {
        sock.destroy();
        if (Date.now() > deadline) reject(new Error("Next.js server did not start in time"));
        else setTimeout(attempt, 150);
      });
    };
    attempt();
  });
}

// --- Next.js standalone server -----------------------------------------------

function startServer(port) {
  const standaloneDir = path.join(process.resourcesPath, "standalone");
  serverProc = utilityProcess.fork(path.join(standaloneDir, "server.js"), [], {
    cwd: standaloneDir,
    serviceName: "silicon-interface-next",
    stdio: "pipe",
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
    },
  });
  serverProc.stdout?.on("data", (d) => console.log("[next]", String(d).trimEnd()));
  serverProc.stderr?.on("data", (d) => console.error("[next]", String(d).trimEnd()));
}

function stopServer() {
  serverProc?.kill();
  serverProc = null;
}

// --- CORS shim ----------------------------------------------------------------
// Glass only emits CORS headers for allowlisted web origins, and the desktop
// app's real origin is http://127.0.0.1:<port>. So: rewrite the Origin on
// outgoing Glass requests to an allowlisted one, then patch the
// Access-Control-* response headers back to our real origin so Chromium's
// CORS check passes. WebSockets need no shim (no browser-side origin check,
// and Glass's Channels routing doesn't validate Origin).
function installCorsShim(appOrigin) {
  const filter = { urls: [`${GLASS_BASE}/*`] };
  const { webRequest } = session.defaultSession;

  webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    const requestHeaders = { ...details.requestHeaders };
    for (const key of Object.keys(requestHeaders)) {
      if (key.toLowerCase() === "origin") delete requestHeaders[key];
    }
    requestHeaders["Origin"] = SPOOFED_ORIGIN;
    callback({ requestHeaders });
  });

  webRequest.onHeadersReceived(filter, (details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    for (const key of Object.keys(responseHeaders)) {
      if (/^access-control-allow-(origin|credentials)$/i.test(key)) {
        delete responseHeaders[key];
      }
    }
    responseHeaders["Access-Control-Allow-Origin"] = [appOrigin];
    responseHeaders["Access-Control-Allow-Credentials"] = ["true"];
    callback({ responseHeaders });
  });
}

// --- window -------------------------------------------------------------------

function createWindow(appUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    title: "Silicon Interface",
    icon: path.join(__dirname, "build", "icon.png"), // used on Linux/Windows
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Anything that isn't the local app goes to the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(appUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadURL(appUrl);
}

// --- lifecycle ------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    const port = await pickPort();
    const appUrl = `http://127.0.0.1:${port}`;
    installCorsShim(appUrl);
    startServer(port);
    await waitForServer(port);
    createWindow(appUrl);

    app.on("activate", () => {
      // macOS dock re-activate with no windows — server is still up, reopen.
      if (BrowserWindow.getAllWindows().length === 0) createWindow(appUrl);
    });
  });

  // The app is useless without a window steering the local server — quit
  // everywhere, including macOS.
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", stopServer);
}
