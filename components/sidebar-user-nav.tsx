"use client";

import {
  ChevronsUpDown,
  LogIn,
  LogOut,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useGetCredits } from "@/hooks/chat-sync-hooks";
import authClient from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/session-provider";

export function SidebarUserNav() {
  const { data: session } = useSession();
  const { credits } = useGetCredits();
  const { setTheme, resolvedTheme } = useTheme();
  const router = useRouter();
  const { isMobile, state } = useSidebar();

  const user = session?.user;

  if (!user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton onClick={() => router.push("/login")}>
            <LogIn className="size-4" />
            <span>Sign in</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className={cn(
                "mx-auto data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground",
                state === "collapsed" &&
                  "flex flex-col items-center justify-center"
              )}
              size="lg"
            >
              <Avatar
                className={cn(
                  "size-8 rounded-lg",
                  state === "collapsed" && "size-6"
                )}
              >
                <AvatarImage
                  alt={user.name || user.email || "User"}
                  src={user.image || `https://avatar.vercel.sh/${user.email}`}
                />
                <AvatarFallback className="rounded-lg">
                  {(user.name || user.email || "User")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  "grid flex-1 text-left text-sm leading-tight",
                  state === "collapsed" && "hidden"
                )}
              >
                <span className="truncate font-medium">
                  {user.name || user.email}
                </span>
                <span className="flex items-center gap-1 truncate text-xs">
                  <Sparkles className="size-3" />
                  {credits ?? 0} Credits
                </span>
              </div>
              <ChevronsUpDown
                className={cn(
                  "ml-auto size-4",
                  state === "collapsed" && "hidden"
                )}
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage
                    alt={user.name || user.email || "User"}
                    src={user.image || `https://avatar.vercel.sh/${user.email}`}
                  />
                  <AvatarFallback className="rounded-lg">
                    {(user.name || user.email || "User")
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    {user.name || user.email}
                  </span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() =>
                  setTheme(resolvedTheme === "light" ? "dark" : "light")
                }
              >
                {resolvedTheme === "light" ? (
                  <Moon className="mr-2 size-4" />
                ) : (
                  <Sun className="mr-2 size-4" />
                )}
                Toggle Theme
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={async () => {
                await authClient.signOut();
                window.location.href = "/";
              }}
            >
              <LogOut className="mr-2 size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
