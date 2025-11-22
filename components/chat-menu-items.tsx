"use client";

import { PinIcon } from "lucide-react";
import { PencilEditIcon, TrashIcon } from "@/components/icons";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { ShareMenuItem } from "@/components/upgrade-cta/share-menu-item";

type ChatMenuItemsProps = {
  isPinned: boolean;
  onRename: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onShare?: () => void;
  includeShareItem?: boolean;
};

export function ChatMenuItems({
  isPinned,
  onRename,
  onTogglePin,
  onDelete,
  onShare,
  includeShareItem = true,
}: ChatMenuItemsProps) {
  return (
    <>
      <DropdownMenuItem className="cursor-pointer" onClick={onRename}>
        <PencilEditIcon />
        <span>Rename</span>
      </DropdownMenuItem>

      <DropdownMenuItem className="cursor-pointer" onClick={onTogglePin}>
        <PinIcon className={`size-4 ${isPinned ? "fill-current" : ""}`} />
        <span>{isPinned ? "Unpin" : "Pin"}</span>
      </DropdownMenuItem>

      {includeShareItem && <ShareMenuItem onShare={onShare ?? (() => {})} />}

      <DropdownMenuItem
        className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
        onSelect={onDelete}
      >
        <TrashIcon />
        <span>Delete</span>
      </DropdownMenuItem>
    </>
  );
}
