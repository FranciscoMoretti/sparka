/* eslint-disable @typescript-eslint/consistent-type-definitions */
"use client";

import Link from "next/link";
import { useState } from "react";
import { DeleteProjectDialog } from "@/components/delete-project-dialog";
import { MoreHorizontalIcon } from "@/components/icons";
import { ProjectMenuItems } from "@/components/project-menu-items";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useRenameProject } from "@/hooks/chat-sync-hooks";
import type { Project } from "@/lib/db/schema";

export function SidebarProjectItem({
  project,
  isActive,
}: {
  project: Project;
  isActive: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { mutateAsync: renameProject } = useRenameProject();

  const projectHref = `/project/${project.id}` as const;

  const handleRename = async () => {
    const trimmed = editName.trim();
    if (trimmed === "" || trimmed === project.name) {
      setIsEditing(false);
      setEditName(project.name);
      return;
    }
    try {
      await renameProject({
        id: project.id,
        updates: { name: trimmed },
      });
      setIsEditing(false);
    } catch {
      setEditName(project.name);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleRename();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditName(project.name);
    }
  };

  return (
    <SidebarMenuItem>
      {isEditing ? (
        <div className="flex w-full items-center gap-2 overflow-hidden rounded-md bg-background p-2 text-left text-sm">
          <Input
            autoFocus
            className="h-auto border-0 bg-transparent p-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
            maxLength={255}
            onBlur={handleRename}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            value={editName}
          />
        </div>
      ) : (
        <SidebarMenuButton
          asChild
          className="cursor-pointer"
          isActive={isActive}
        >
          <Link href={projectHref} prefetch={false}>
            <span>{project.name}</span>
          </Link>
        </SidebarMenuButton>
      )}

      <DropdownMenu modal={true}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className="mr-0.5 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            showOnHover={!isActive}
          >
            <MoreHorizontalIcon />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom">
          <ProjectMenuItems
            onDelete={() => setShowDeleteDialog(true)}
            onRename={() => {
              setIsEditing(true);
              setEditName(project.name);
            }}
          />
        </DropdownMenuContent>
      </DropdownMenu>
      <DeleteProjectDialog
        deleteId={project.id}
        setShowDeleteDialog={setShowDeleteDialog}
        showDeleteDialog={showDeleteDialog}
      />
    </SidebarMenuItem>
  );
}
