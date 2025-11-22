"use client";

import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";
import { useState } from "react";

type HoverPrefetchLinkProps = Omit<
  ComponentPropsWithoutRef<typeof Link>,
  "href" | "prefetch"
> & {
  href:
    | `/chat/${string}`
    | `/project/${string}/chat/${string}`
    | `/project/${string}`;
};

export function HoverPrefetchLink({
  href,
  children,
  onMouseEnter,
  ...props
}: HoverPrefetchLinkProps) {
  const [active, setActive] = useState(false);

  return (
    <Link
      href={href}
      // Disable prefetch by default, enable it once we've hovered.
      onMouseEnter={(event) => {
        setActive(true);
        onMouseEnter?.(event);
      }}
      prefetch={active ? "auto" : false}
      {...props}
    >
      {children}
    </Link>
  );
}
