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

function createUserWindow() {
  if (userWindow && !userWindow.isDestroyed()) {
    userWindow.focus();
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
    userWindow.maximize();
    userWindow.show();
  });
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

  buildAppMenu();

  if (wantsPlatform()) {
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
