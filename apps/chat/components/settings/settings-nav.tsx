"use client";

import { Cpu, Plug, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { config } from "@/lib/config";
import { cn } from "@/lib/utils";

export function SettingsNav({
  orientation = "vertical",
}: {
  orientation?: "horizontal" | "vertical";
}) {
  const pathname = usePathname();

  const navItems = useMemo(
    () =>
      [
        { href: "/settings" as const, label: "General", icon: Settings },
        { href: "/settings/models" as const, label: "Models", icon: Cpu },
        ...(config.ai.tools.mcp.enabled
          ? [
              {
                href: "/settings/connectors" as const,
                label: "Connectors",
                icon: Plug,
              },
            ]
          : []),
      ] as const,
    []
  );

  return (
    <nav
      className={cn(
        "flex gap-1 sm:overflow-auto sm:pb-2",
        orientation === "vertical" ? "w-56 flex-col" : "flex-row"
      )}
    >
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive =
          href === "/settings"
            ? pathname === "/settings"
            : pathname.startsWith(href);

        return (
          <Link
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              isActive && "bg-muted text-foreground"
            )}
            href={href}
            key={href}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
