import { contextBridge } from "electron";
import { TITLEBAR_HEIGHT } from "./config";

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  titlebarHeight: TITLEBAR_HEIGHT,
});
