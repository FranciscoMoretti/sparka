import { config } from "@/lib/config";

export const APP_NAME = config.appName;
export const APP_SCHEME = config.appPrefix;
export const APP_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : config.appUrl;

export const WINDOW_DEFAULTS = {
  width: 1280,
  height: 800,
  minWidth: 800,
  minHeight: 600,
} as const;

export const TITLEBAR_HEIGHT = 36;
