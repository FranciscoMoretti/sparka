import { contextBridge } from "electron";
import { TITLEBAR_HEIGHT } from "./config";

// Set CSS variable as early as possible, guarding against sandbox timing
const setTitlebarHeightVar = () => {
  document.documentElement?.style.setProperty(
    "--electron-titlebar-height",
    `${TITLEBAR_HEIGHT}px`
  );
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setTitlebarHeightVar);
} else {
  setTitlebarHeightVar();
}

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  titlebarHeight: TITLEBAR_HEIGHT,
});
