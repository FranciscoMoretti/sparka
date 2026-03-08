import { contextBridge } from "electron";
import { TITLEBAR_HEIGHT } from "./config";

// Set CSS variable synchronously before any page scripts or paint
document.documentElement.style.setProperty(
  "--electron-titlebar-height",
  `${TITLEBAR_HEIGHT}px`
);

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  titlebarHeight: TITLEBAR_HEIGHT,
});
