"use client";

import { usePathname } from "next/navigation";

const SHARE_ROUTE_PREFIX = /^\/share\/[^/]+(?:\/|$)/;

export function useIsSharedRoute(): boolean {
  const pathname = usePathname();
  return Boolean(pathname && SHARE_ROUTE_PREFIX.test(pathname));
}
