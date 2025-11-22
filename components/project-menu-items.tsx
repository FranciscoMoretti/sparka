"use client";

import { PencilEditIcon, TrashIcon } from "@/components/icons";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

type ProjectMenuItemsProps = {
  onRename: () => void;
  onDelete: () => void;
};

export function ProjectMenuItems({
  onRename,
  onDelete,
}: ProjectMenuItemsProps) {
  return (
    <>
      <DropdownMenuItem className="cursor-pointer" onClick={onRename}>
        <PencilEditIcon />
        <span>Rename</span>
      </DropdownMenuItem>
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
