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

function wantsWorkspaceRuntimeTest() {
  return getAppArgs().includes("--workspace-runtime-test");
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
        const initialAutoEnabled =
          document.querySelector("[data-garage-auto]")?.getAttribute("aria-pressed") === "true";

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
        document.querySelector('[data-garage-view="front_45"]')?.click();
        const lightButton = document.querySelector("[data-garage-light-toggle]");
        const lightLayer = document.querySelector("[data-garage-light-layer]");
        lightButton?.click();
        const lightReady = await waitFor(() =>
          lightLayer &&
          lightLayer.complete &&
          lightLayer.naturalWidth === 2048 &&
          lightLayer.classList.contains("active")
        , 5000);
        const lightPilot = {
          ready: lightReady,
          pressed: lightButton?.getAttribute("aria-pressed") === "true",
          naturalWidth: lightLayer?.naturalWidth || 0,
          naturalHeight: lightLayer?.naturalHeight || 0
        };
        document.querySelector('[data-garage-view="right"]')?.click();
        lightPilot.disabledOutsideFront45 = lightButton?.disabled === true;
        lightPilot.hiddenOutsideFront45 = !lightLayer?.classList.contains("active");
        const autoButton = document.querySelector("[data-garage-auto]");
        const autoPilot = {
          defaultEnabled: initialAutoEnabled,
          clickedStart: document.querySelector("[data-garage-view].active")?.dataset.garageView === "right",
          runningShowsStop: autoButton?.textContent?.trim() === "■STOP"
        };
        await wait(1950);
        autoPilot.advancesFromClickedView =
          document.querySelector("[data-garage-view].active")?.dataset.garageView === "rear_right";
        autoButton?.click();
        const stoppedView = document.querySelector("[data-garage-view].active")?.dataset.garageView;
        await wait(1950);
        autoPilot.stopHoldsView =
          autoButton?.getAttribute("aria-pressed") === "false" &&
          document.querySelector("[data-garage-view].active")?.dataset.garageView === stoppedView &&
          autoButton?.textContent?.trim() === "▶AUTO";
        return {
          boot: window.__VROO_BOOT_OK === true,
          selectorCount: document.querySelectorAll("[data-garage-view]").length,
          results,
          lightPilot,
          autoPilot
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
    const lightFailed =
      !result.lightPilot?.ready ||
      !result.lightPilot?.pressed ||
      result.lightPilot?.naturalWidth !== 2048 ||
      result.lightPilot?.naturalHeight !== 2048 ||
      !result.lightPilot?.disabledOutsideFront45 ||
      !result.lightPilot?.hiddenOutsideFront45;
    const autoFailed =
      !result.autoPilot?.defaultEnabled ||
      !result.autoPilot?.clickedStart ||
      !result.autoPilot?.runningShowsStop ||
      !result.autoPilot?.advancesFromClickedView ||
      !result.autoPilot?.stopHoldsView;
    console.log(`HERITAGE_RUNTIME_TEST_RESULT ${JSON.stringify(result)}`);
    if (failed.length || lightFailed || autoFailed) {
      const details = failed.map(item => item.id)
        .concat(lightFailed ? ["front_45_light_pilot"] : [])
        .concat(autoFailed ? ["garage_auto_rotation"] : []);
      throw new Error(`Heritage runtime failures: ${details.join(", ")}`);
    }
    console.log("HERITAGE_RUNTIME_TEST_PASS");
    app.exit(0);
  } catch (error) {
    console.error("HERITAGE_RUNTIME_TEST_FAIL", error);
    app.exit(1);
  }
}

async function runWorkspaceRuntimeTest(win) {
  try {
    const result = await win.webContents.executeJavaScript(`
      (async () => {
        const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
        const waitFor = async (predicate, label, timeout = 12000) => {
          const started = Date.now();
          while (Date.now() - started < timeout) {
            const value = predicate();
            if (value) return value;
            await wait(75);
          }
          throw new Error("Timed out waiting for " + label);
        };
        const click = async (selector) => {
          const element = await waitFor(() => document.querySelector(selector), selector);
          element.click();
          await wait(150);
        };

        await waitFor(() => window.__VROO_BOOT_OK === true, "VROO boot");
        const mapLegend = await waitFor(() => document.querySelector("#mapLegend"), "map display filters");
        const map = {
          legendVisible: Boolean(mapLegend.querySelector("#mapLegendToggle")),
          filterCount: mapLegend.querySelectorAll("[data-map-filter]").length,
          layerCount: mapLegend.querySelectorAll("[data-layer]").length
        };
        const [{ emit }, mapModule, dataModule, conversationStore, storageModule] = await Promise.all([
          import("./assets/js/core/events.js"),
          import("./assets/js/modules/map.js"),
          import("./assets/js/modules/data.js"),
          import("./assets/js/modules/conversation-store.js"),
          import("./assets/js/core/storage.js")
        ]);
        await click('[data-screen="nearby"]');
        await click('[data-nearby-tab="poi"]');
        map.nearbyPoiTab = Boolean(await waitFor(
          () => document.querySelector(".nearby-place-row [data-place-view]"),
          "nearby POI tab"
        ));
        await click("[data-place-favorite]");
        await click('[data-nearby-tab="fav"]');
        map.nearbyFavoriteTab = Boolean(await waitFor(
          () => document.querySelector(".nearby-place-row [data-place-view]"),
          "nearby favorites tab"
        ));
        await click('[data-nearby-tab="pins"]');
        await click("#registerCurrentPlace");
        map.nearbyRegisteredPlace = Boolean(await waitFor(
          () => document.querySelector('.nearby-place-row [data-place-view^="pin-"]'),
          "nearby registered place"
        ));
        await click('[data-nearby-tab="friends"]');
        const legacyOverlayState = { spatialOverlayConfig: { maxBubbles: 8 } };
        map.overlayBubbleCapDefault = conversationStore.SPATIAL_OVERLAY_DEFAULTS.maxBubbles;
        map.overlayBubbleCapMigrated =
          conversationStore.ensureSpatialOverlayConfig(legacyOverlayState).maxBubbles;
        const storageKeys = [
          storageModule.STORAGE_KEY,
          storageModule.STORAGE_BACKUP_KEY,
          storageModule.STORAGE_CORRUPT_KEY
        ];
        const storageSnapshot = Object.fromEntries(
          storageKeys.map(key => [key, localStorage.getItem(key)])
        );
        localStorage.setItem(storageModule.STORAGE_KEY, JSON.stringify({ credits: 111 }));
        storageModule.saveState({ ...structuredClone(storageModule.defaults), credits: 222 });
        const promotedBackup = JSON.parse(
          localStorage.getItem(storageModule.STORAGE_BACKUP_KEY) || "{}"
        );
        localStorage.setItem(storageModule.STORAGE_BACKUP_KEY, JSON.stringify({
          credits: 333,
          roadChat: {
            session: { conversationId: "road-session-current" },
            messages: [{ id: "road-recovery", body: "도로 대화 보존", createdAt: Date.now() }]
          },
          rooms: {
            "peer-recovery": {
              type: "direct",
              messages: [{ id: "room-recovery", text: "일반 대화 보존", createdAt: Date.now() }]
            }
          }
        }));
        localStorage.setItem(storageModule.STORAGE_KEY, "{broken-json");
        const recoveredState = storageModule.loadState();
        map.storageSchemaVersion =
          recoveredState._schemaVersion === storageModule.STORAGE_SCHEMA_VERSION;
        map.storagePromotesBackup = promotedBackup.credits === 111;
        map.storageRecoversRoadSeparately =
          recoveredState.roadChat?.messages?.[0]?.body === "도로 대화 보존";
        map.storageRecoversRoomSeparately =
          recoveredState.rooms?.["peer-recovery"]?.messages?.[0]?.text === "일반 대화 보존";
        map.storageQuarantinesCorrupt =
          localStorage.getItem(storageModule.STORAGE_CORRUPT_KEY) === "{broken-json";
        for (const key of storageKeys) {
          const value = storageSnapshot[key];
          if (value == null) localStorage.removeItem(key);
          else localStorage.setItem(key, value);
        }
        const mapPeerId = mapModule.getUsers()[0]?.id;
        emit("chat:activeRoomChanged", {
          type: "direct",
          participantIds: [dataModule.MY_USER_ID, mapPeerId]
        });
        await wait(100);
        map.directHighlight = Boolean(document.querySelector(".vroo-marker--vehicle.is-chatting-direct"));
        map.myHighlight = Boolean(document.querySelector(".vroo-marker--me.is-chatting-me"));
        emit("chat:activeRoomChanged", {
          type: "grid",
          participantIds: [dataModule.MY_USER_ID, mapPeerId]
        });
        await wait(100);
        map.gridHighlight = Boolean(document.querySelector(".vroo-marker--vehicle.is-chatting-grid"));
        emit("chat:closed", {});
        await click('[data-screen="chat"]');
        const commandGrid = await waitFor(() => document.querySelector(".chat-command-grid"), "chat command grid");
        const chat = {
          zoneCount: commandGrid.children.length,
          filterCount: document.querySelectorAll(".chat-command-control-row [data-rooms-filter]").length,
          roomHost: Boolean(document.querySelector("[data-chat-room-host]")),
          filtersInControlRow: Boolean(document.querySelector(".chat-command-control-row .chat-command-filters")),
          defaultConversation: Boolean(await waitFor(
            () => document.querySelector("[data-chat-room-host] .chat-shell"),
            "default conversation in third zone"
          )),
          unreadBadge: Boolean(document.querySelector(".chat-command-unread strong")),
          giftCount: document.querySelectorAll(".chat-command-gifts [data-list-gift]").length,
          phraseToggle: Boolean(document.querySelector("[data-list-phrase-toggle]")),
          roadTicker: Boolean(document.querySelector(".chat-road-alert-ticker"))
        };

        await click("[data-open-road-scene]");
        chat.roadDetailInThirdZone = Boolean(await waitFor(
          () => document.querySelector("[data-chat-room-host] [data-road-content-detail]"),
          "road detail in third zone"
        ));
        await click("#roadContentBack");
        chat.backRestoresRoomList = Boolean(await waitFor(
          () => document.querySelector("[data-chat-room-host]"),
          "room list after back"
        ));

        emit("chat:open", {
          id: mapPeerId,
          nickname: "Runtime Peer",
          online: true,
          level: 1
        });
        chat.directInThirdZone = Boolean(await waitFor(
          () => document.querySelector("[data-chat-room-host] .chat-shell"),
          "direct chat in third zone"
        ));
        chat.directKeepsThreeZones = Boolean(document.querySelector(".chat-command-grid"));
        const runtimeText = "Runtime three-pane message";
        const runtimeTextarea = await waitFor(() => document.querySelector("[data-chat-room-host] #chatText"), "direct textarea");
        runtimeTextarea.value = runtimeText;
        await click("[data-chat-room-host] #sendChat");
        chat.messageInRoadPane = Boolean(await waitFor(
          () => [...document.querySelectorAll(".chat-road-bubble")].some(node => node.textContent.includes(runtimeText)),
          "message preview in road pane"
        ));
        chat.messageInMapPane = Boolean(await waitFor(
          () => [...document.querySelectorAll(".chat-map-message")].some(node => node.textContent.includes(runtimeText)),
          "message preview in map pane"
        ));
        chat.previewMaxTwo =
          document.querySelectorAll(".chat-road-bubble").length <= 2 &&
          document.querySelectorAll(".chat-map-message").length <= 2;
        await click("#chatBack");
        chat.directBackRestoresThreeZones = Boolean(await waitFor(
          () => document.querySelector(".chat-command-grid [data-chat-room-host]"),
          "three zones after direct back"
        ));

        emit("grid:chatOpen", {gridId: "g_my"});
        chat.gridInThirdZone = Boolean(await waitFor(
          () => document.querySelector('[data-chat-room-host] [data-conversation-type="grid"]'),
          "grid chat in third zone"
        ));
        chat.gridKeepsThreeZones = Boolean(document.querySelector(".chat-command-grid"));
        await click("#chatBack");
        await waitFor(
          () => document.querySelector(".chat-command-grid [data-chat-room-host]"),
          "three zones after grid back"
        );

        emit("chat:openConversation", {
          conversationId: "road-session-current",
          returnView: "road"
        });
        chat.conversationEventInThirdZone = Boolean(await waitFor(
          () => document.querySelector("[data-chat-room-host] [data-road-content-detail]"),
          "conversation event in third zone"
        ));
        chat.conversationEventKeepsThreeZones = Boolean(document.querySelector(".chat-command-grid"));
        await click("#roadContentBack");
        chat.conversationBackStaysInChat = Boolean(await waitFor(
          () => document.querySelector(".chat-command-grid [data-chat-room-host]"),
          "chat command center after conversation back"
        ));

        await click("#myPageButton");
        await waitFor(() => document.querySelector(".garage-shell"), "Garage shell");
        const autoBeforeDirection =
          document.querySelector("[data-garage-auto]")?.getAttribute("aria-pressed");
        await click('[data-garage-view="front"]');
        const garage = {
          visible: true,
          viewCount: document.querySelectorAll("[data-garage-view]").length,
          actionCount: document.querySelectorAll("[data-garage-action]").length,
          autoControl: Boolean(document.querySelector("[data-garage-auto]")),
          directionPreservesAutoState:
            document.querySelector("[data-garage-auto]")?.getAttribute("aria-pressed") === autoBeforeDirection
        };
        const garageStage = document.querySelector("[data-garage-stage]");
        const viewBeforeDrag = document.querySelector("[data-garage-view].active")?.dataset.garageView;
        garageStage.dispatchEvent(new PointerEvent("pointerdown", {
          bubbles: true, pointerId: 7, button: 0, clientX: 500
        }));
        garageStage.dispatchEvent(new PointerEvent("pointermove", {
          bubbles: true, pointerId: 7, clientX: 340
        }));
        garageStage.dispatchEvent(new PointerEvent("pointerup", {
          bubbles: true, pointerId: 7, button: 0, clientX: 340
        }));
        await wait(100);
        garage.dragRotation = document.querySelector("[data-garage-view].active")?.dataset.garageView !== viewBeforeDrag;

        await click('[data-garage-action="mission"]');
        garage.missionInternal = Boolean(document.querySelector('[data-room="mission"].active'));
        await click('[data-room="garage"]');
        await click('[data-garage-action="collection"]');
        garage.collectionInternal = Boolean(document.querySelector('[data-room="inventory"].active'));
        await click('[data-room="garage"]');
        await click('[data-garage-action="customize"]');
        garage.customizeRoutesToStore = Boolean(await waitFor(
          () => document.querySelector('[data-cat="feature"].active'),
          "Store feature category"
        ));

        await click("#myPageButton");
        await click('[data-room="garage"]');
        await click('[data-garage-action="upgrade"]');
        garage.upgradeRoutesToGame = Boolean(await waitFor(() => document.querySelector("#levelUp"), "Game upgrade"));

        const checks = [
          map.legendVisible,
          map.filterCount === 4,
          map.layerCount === 6,
          map.nearbyPoiTab,
          map.nearbyFavoriteTab,
          map.nearbyRegisteredPlace,
          map.overlayBubbleCapDefault === 2,
          map.overlayBubbleCapMigrated === 2,
          map.storageSchemaVersion,
          map.storagePromotesBackup,
          map.storageRecoversRoadSeparately,
          map.storageRecoversRoomSeparately,
          map.storageQuarantinesCorrupt,
          map.directHighlight,
          map.gridHighlight,
          map.myHighlight,
          chat.zoneCount === 3,
          chat.filterCount === 6,
          chat.roomHost,
          chat.filtersInControlRow,
          chat.defaultConversation,
          chat.unreadBadge,
          chat.giftCount === 4,
          chat.phraseToggle,
          chat.roadTicker,
          chat.messageInRoadPane,
          chat.messageInMapPane,
          chat.previewMaxTwo,
          chat.roadDetailInThirdZone,
          chat.backRestoresRoomList,
          chat.directInThirdZone,
          chat.directKeepsThreeZones,
          chat.directBackRestoresThreeZones,
          chat.gridInThirdZone,
          chat.gridKeepsThreeZones,
          chat.conversationEventInThirdZone,
          chat.conversationEventKeepsThreeZones,
          chat.conversationBackStaysInChat,
          garage.visible,
          garage.viewCount === 9,
          garage.actionCount === 4,
          garage.autoControl,
          garage.directionRestartsAuto,
          garage.dragRotation,
          garage.missionInternal,
          garage.collectionInternal,
          garage.customizeRoutesToStore,
          garage.upgradeRoutesToGame
        ];
        return { boot: true, map, chat, garage, pass: checks.every(Boolean) };
      })()
    `, true);
    console.log(`WORKSPACE_RUNTIME_TEST_RESULT ${JSON.stringify(result)}`);
    if (!result.pass) throw new Error("Workspace runtime assertions failed");
    console.log("WORKSPACE_RUNTIME_TEST_PASS");
    app.exit(0);
  } catch (error) {
    console.error("WORKSPACE_RUNTIME_TEST_FAIL", error);
    app.exit(1);
  }
}

function createUserWindow({ smokeTest = false, smokeRunner = runHeritageRuntimeTest } = {}) {
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
    userWindow.webContents.once("did-finish-load", () => smokeRunner(userWindow));
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
  const workspaceRuntimeTest = wantsWorkspaceRuntimeTest();
  if (!heritageRuntimeTest && !workspaceRuntimeTest) buildAppMenu();

  if (heritageRuntimeTest) {
    createUserWindow({ smokeTest: true });
  } else if (workspaceRuntimeTest) {
    createUserWindow({ smokeTest: true, smokeRunner: runWorkspaceRuntimeTest });
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
