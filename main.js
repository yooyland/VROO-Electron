const { app, BrowserWindow, shell, session, Menu } = require("electron");
const path = require("path");

let userWindow = null;
let consoleWindow = null;

function getAppArgs() {
  const idx = process.argv.indexOf("--");
  return idx >= 0 ? process.argv.slice(idx + 1) : process.argv.slice(2);
}

function wantsConsole() {
  const args = getAppArgs();
  return args.includes("--console") || args.includes("--platform");
}

function wantsUser() {
  const args = getAppArgs();
  if (args.includes("--console") && !args.includes("--platform")) return false;
  return true;
}

function wantsPlatform() {
  return getAppArgs().includes("--platform");
}

function wantsHeritageRuntimeTest() {
  return getAppArgs().includes("--heritage-runtime-test");
}

function baseWebPreferences() {
  return {
    preload: path.join(__dirname, "preload.js"),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true
  };
}

function attachNavigationGuards(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("file://")) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

async function runHeritageRuntimeTest(win) {
  try {
    const result = await win.webContents.executeJavaScript(`
      (async () => {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const waitFor = async (predicate, timeout = 10000) => {
          const started = Date.now();
          while (Date.now() - started < timeout) {
            if (predicate()) return true;
            await wait(50);
          }
          return false;
        };
        const loaded = await waitFor(() => window.__VROO_BOOT_OK === true);
        if (!loaded) throw new Error("VROO boot timeout");
        document.querySelector("#myPageButton")?.click();
        const mounted = await waitFor(() => document.querySelectorAll("[data-garage-view]").length === 9);
        if (!mounted) throw new Error("Garage nine-direction selector missing");

        const expected = ["front","front_45","front_right","right","rear_right","rear","rear_left","left","front_left"];
        const results = [];
        for (const id of expected) {
          const button = document.querySelector('[data-garage-view="' + id + '"]');
          if (!button) throw new Error("Missing direction button: " + id);
          button.click();
          const image = document.querySelector("[data-garage-image]");
          const ok = await waitFor(() => image && image.complete && image.naturalWidth > 0, 5000);
          results.push({
            id,
            ok,
            naturalWidth: image?.naturalWidth || 0,
            naturalHeight: image?.naturalHeight || 0,
            fallbackApplied: image?.dataset.fallbackApplied === "true",
            pressed: button.getAttribute("aria-pressed") === "true"
          });
        }
        return {
          boot: window.__VROO_BOOT_OK === true,
          selectorCount: document.querySelectorAll("[data-garage-view]").length,
          results
        };
      })()
    `, true);
    const failed = result.results.filter(item =>
      !item.ok ||
      item.naturalWidth !== 2048 ||
      item.naturalHeight !== 2048 ||
      item.fallbackApplied ||
      !item.pressed
    );
    console.log(`HERITAGE_RUNTIME_TEST_RESULT ${JSON.stringify(result)}`);
    if (failed.length) throw new Error(`Heritage runtime failures: ${failed.map(item => item.id).join(", ")}`);
    console.log("HERITAGE_RUNTIME_TEST_PASS");
    app.exit(0);
  } catch (error) {
    console.error("HERITAGE_RUNTIME_TEST_FAIL", error);
    app.exit(1);
  }
}

function createUserWindow({ smokeTest = false } = {}) {
  if (userWindow && !userWindow.isDestroyed()) {
    if (!smokeTest) userWindow.focus();
    return userWindow;
  }
  userWindow = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#07090d",
    autoHideMenuBar: true,
    show: false,
    title: "VROO",
    icon: path.join(__dirname, "assets", "icon.ico"),
    webPreferences: baseWebPreferences()
  });

  userWindow.loadFile(path.join(__dirname, "app", "index.html"));
  userWindow.once("ready-to-show", () => {
    if (!smokeTest) {
      userWindow.maximize();
      userWindow.show();
    }
  });
  if (smokeTest) {
    userWindow.webContents.once("did-finish-load", () => runHeritageRuntimeTest(userWindow));
  }
  attachNavigationGuards(userWindow);
  userWindow.on("closed", () => {
    userWindow = null;
  });
  return userWindow;
}

function createConsoleWindow() {
  if (consoleWindow && !consoleWindow.isDestroyed()) {
    consoleWindow.focus();
    return consoleWindow;
  }
  consoleWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#07090d",
    autoHideMenuBar: true,
    show: false,
    title: "VROO Console",
    icon: path.join(__dirname, "assets", "icon.ico"),
    webPreferences: baseWebPreferences()
  });

  consoleWindow.loadFile(path.join(__dirname, "console", "index.html"));
  consoleWindow.once("ready-to-show", () => {
    consoleWindow.maximize();
    consoleWindow.show();
  });
  attachNavigationGuards(consoleWindow);
  consoleWindow.on("closed", () => {
    consoleWindow = null;
  });
  return consoleWindow;
}

function buildAppMenu() {
  const isDev = !app.isPackaged;
  const template = [
    {
      label: "VROO",
      submenu: [
        { role: "reload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "quit" }
      ]
    }
  ];
  if (isDev) {
    template.push({
      label: "Develop",
      submenu: [
        {
          label: "Open VROO Console",
          accelerator: "CmdOrCtrl+Shift+C",
          click: () => createConsoleWindow()
        },
        {
          label: "Open User App",
          accelerator: "CmdOrCtrl+Shift+U",
          click: () => createUserWindow()
        }
      ]
    });
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      const allowed = ["geolocation", "media"];
      callback(allowed.includes(permission));
    }
  );

  const heritageRuntimeTest = wantsHeritageRuntimeTest();
  if (!heritageRuntimeTest) buildAppMenu();

  if (heritageRuntimeTest) {
    createUserWindow({ smokeTest: true });
  } else if (wantsPlatform()) {
    createUserWindow();
    createConsoleWindow();
  } else if (wantsConsole()) {
    createConsoleWindow();
  } else if (wantsUser()) {
    createUserWindow();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (wantsConsole() && !wantsPlatform()) createConsoleWindow();
      else createUserWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
