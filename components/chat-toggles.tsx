'use client';

import React, { type Dispatch, type SetStateAction, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { useSession } from 'next-auth/react';

import { Toggle } from './ui/toggle';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Separator } from './ui/separator';
import type { ChatRequestToolsConfig } from '@/app/(chat)/api/chat/route';
import { getModelDefinition } from '@/lib/ai/all-models';
import { LoginPrompt } from './upgrade-cta/login-prompt';
import {
  toolDefinitions,
  enabledTools,
  type ToolDefinition,
} from './chat-features-definitions';

function ToolToggle({
  tool,
  enabled,
  setEnabled,
  disabled = false,
}: {
  tool: ToolDefinition;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  disabled?: boolean;
}) {
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const [showLoginPopover, setShowLoginPopover] = useState(false);

  const handleToggle = (pressed: boolean) => {
    if (disabled) return;
    if (!isAuthenticated) {
      setShowLoginPopover(true);
    } else {
      setEnabled(pressed);
    }
  };

  const Icon = tool.icon;

  if (isAuthenticated) {
    return (
      <Toggle
        pressed={enabled}
        onPressedChange={handleToggle}
        variant="outline"
        size="sm"
        disabled={disabled}
        className="gap-1 @[400px]:gap-2 p-1.5 px-2.5 h-fit border-zinc-700 rounded-full items-center disabled:opacity-50 text-xs"
      >
        <Icon size={14} />
        {tool.name}
      </Toggle>
    );
  }

  return (
    <Popover open={showLoginPopover} onOpenChange={setShowLoginPopover}>
      <PopoverTrigger asChild>
        <Toggle
          pressed={enabled}
          onPressedChange={handleToggle}
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-1 @[400px]:gap-2 p-1.5 px-2.5 h-fit border-zinc-700 rounded-full items-center disabled:opacity-50 text-xs"
        >
          <Icon size={14} />
          {tool.name}
        </Toggle>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <LoginPrompt
          title={`Sign in to use ${tool.name}`}
          description={tool.description}
        />
      </PopoverContent>
    </Popover>
  );
}

export function ResponsiveToggles({
  data,
  setData,
  selectedModelId,
}: {
  data: ChatRequestToolsConfig;
  setData: Dispatch<SetStateAction<ChatRequestToolsConfig>>;
  selectedModelId: string;
}) {
  const { data: session } = useSession();
  const isAnonymous = !session?.user;
  const [showLoginPopover, setShowLoginPopover] = useState(false);

  const hasReasoningModel = (() => {
    try {
      const modelDef = getModelDefinition(selectedModelId as any);
      return modelDef.features?.reasoning === true;
    } catch {
      return false;
    }
  })();

  const activeTool = enabledTools.find((key) => data[key]);

  const setTool = (tool: (typeof enabledTools)[number] | null) => {
    if (tool === 'deepResearch' && hasReasoningModel) {
      return;
    }

    if (isAnonymous && tool !== null) {
      setShowLoginPopover(true);
      return;
    }

    const newToolState = enabledTools.reduce(
      (acc, key) => {
        acc[key] = key === tool;
        return acc;
      },
      {} as Record<(typeof enabledTools)[number], boolean>,
    );

    setData((prev) => ({ ...prev, ...newToolState }));
  };

  return (
    <div className="flex items-center gap-1 @[400px]:gap-2">
      {isAnonymous ? (
        <Popover open={showLoginPopover} onOpenChange={setShowLoginPopover}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="gap-1 @[400px]:gap-2 p-1.5 h-fit rounded-full"
            >
              <Settings2 size={14} />
              <span className="hidden @[400px]:inline">Tools</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <LoginPrompt
              title="Sign in to use Tools"
              description="Access web search, deep research, and more to get better answers."
            />
          </PopoverContent>
        </Popover>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 @[400px]:gap-2 p-1.5 px-2.5 h-fit rounded-full"
            >
              <Settings2 size={14} />
              <span className="hidden @[400px]:inline">Tools</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-48"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {enabledTools.map((key) => {
              const tool = toolDefinitions[key];
              const isDisabled = key === 'deepResearch' && hasReasoningModel;
              const Icon = tool.icon;
              return (
                <DropdownMenuItem
                  key={key}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTool(data[key] ? null : key);
                  }}
                  className="flex items-center gap-2"
                  disabled={isDisabled}
                >
                  <Icon size={14} />
                  <span>{tool.name}</span>
                  {data[key] && <span className="text-xs opacity-70">✓</span>}
                  {isDisabled && (
                    <span className="text-xs opacity-60">
                      (for non-reasoning models)
                    </span>
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {activeTool && (
        <>
          <Separator
            orientation="vertical"
            className="bg-muted-foreground/50 h-4"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTool(null)}
            className="gap-1 @[400px]:gap-2 p-1.5 px-2.5 h-fit rounded-full"
          >
            {React.createElement(toolDefinitions[activeTool].icon, {
              size: 14,
            })}
            <span className="hidden @[500px]:inline">
              {toolDefinitions[activeTool].name}
            </span>
            <span className="text-xs opacity-70">×</span>
          </Button>
        </>
      )}
    </div>
  );
}
