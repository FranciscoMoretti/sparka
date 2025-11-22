"use client";
import { Coins } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGetCredits } from "@/hooks/chat-sync-hooks";
import type { Session } from "@/lib/auth";
import authClient from "@/lib/auth-client";

export function HeaderUserNav({
  user,
}: {
  user: NonNullable<Session["user"]>;
}) {
  const router = useRouter();
  const { credits } = useGetCredits();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Open user menu"
          size="icon"
          type="button"
          variant="ghost"
        >
          <Image
            alt={user.email ?? "User Avatar"}
            className="rounded-full"
            height={24}
            src={user.image ?? `https://avatar.vercel.sh/${user.email}`}
            width={24}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56" side="bottom">
        <DropdownMenuItem disabled>
          <span className="font-medium">{user.email}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <div className="flex items-center text-muted-foreground">
            <Coins className="mr-1 size-4" />
            <span>Credits: {credits ?? "Loading..."}</span>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <button
            className="w-full cursor-pointer"
            onClick={async () => {
              await authClient.signOut();
              router.push("/");
              router.refresh();
            }}
            type="button"
          >
            Sign out
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
