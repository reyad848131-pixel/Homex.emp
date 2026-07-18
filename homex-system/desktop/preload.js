const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("homexDesktop", {
  isDesktop: true,
  platform: process.platform,
});
