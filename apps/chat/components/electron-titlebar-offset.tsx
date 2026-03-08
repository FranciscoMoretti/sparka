"use client";

import { useEffect, useState } from "react";

type ElectronWindow = Window & {
  electronAPI?: {
    titlebarHeight?: number;
  };
};

export function ElectronTitlebarOffset() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const nextHeight =
      (window as ElectronWindow).electronAPI?.titlebarHeight ?? 0;
    setHeight(nextHeight);
    document.documentElement.style.setProperty(
      "--electron-titlebar-height",
      `${nextHeight}px`
    );
  }, []);

  if (!height) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-99999"
      style={{
        height: `${height}px`,
        WebkitAppRegion: "drag",
      }}
    />
  );
}
