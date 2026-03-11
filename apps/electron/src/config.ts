export const APP_URL =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://chatjs.dev";

export const APP_SCHEME = "chatjs";

export const WINDOW_DEFAULTS = {
  width: 1280,
  height: 800,
  minWidth: 800,
  minHeight: 600,
} as const;

export const TITLEBAR_HEIGHT = 36;
