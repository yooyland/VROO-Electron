const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("vrooDesktop", {
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
});
