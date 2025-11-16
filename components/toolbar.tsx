"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import cx from "classnames";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
} from "motion/react";
import { nanoid } from "nanoid";
import {
  type Dispatch,
  memo,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { useOnClickOutside } from "usehooks-ts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ChatMessage } from "@/lib/ai/types";
import type { ArtifactKind } from "@/lib/artifacts/artifact-kind";
import type { useChatStoreApi } from "@/lib/stores/chat-store-context";
import { useSendMessage } from "@/lib/stores/hooks-base";
import { useChatInput } from "@/providers/chat-input-provider";
import { artifactDefinitions } from "./artifact";
import type { ArtifactToolbarItem } from "./create-artifact";
import { ArrowUpIcon, StopIcon, SummarizeIcon } from "./icons";

type ToolProps = {
  description: string;
  icon: ReactNode;
  selectedTool: string | null;
  setSelectedTool: Dispatch<SetStateAction<string | null>>;
  isToolbarVisible?: boolean;
  setIsToolbarVisible?: Dispatch<SetStateAction<boolean>>;
  isAnimating: boolean;
  onClick: ({
    sendMessage,
    storeApi,
  }: {
    sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
    storeApi: ReturnType<typeof useChatStoreApi>;
  }) => void;
  storeApi: ReturnType<typeof useChatStoreApi>;
};

function Tool({
  description,
  icon,
  selectedTool,
  setSelectedTool,
  isToolbarVisible,
  setIsToolbarVisible,
  isAnimating,
  onClick,
  storeApi,
}: ToolProps) {
  const sendMessage = useSendMessage();
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (selectedTool !== description) {
      setIsHovered(false);
    }
  }, [selectedTool, description]);

  const handleSelect = () => {
    if (!isToolbarVisible && setIsToolbarVisible) {
      setIsToolbarVisible(true);
      return;
    }

    if (!selectedTool) {
      setIsHovered(true);
      setSelectedTool(description);
      return;
    }

    if (selectedTool !== description) {
      setSelectedTool(description);
    } else {
      setSelectedTool(null);
      if (sendMessage) {
        onClick({ sendMessage, storeApi });
      }
    }
  };

  return (
    <Tooltip open={isHovered && !isAnimating}>
      <TooltipTrigger asChild>
        <motion.div
          animate={{ opacity: 1, transition: { delay: 0.1 } }}
          className={cx("rounded-full p-3", {
            "bg-primary text-primary-foreground!": selectedTool === description,
          })}
          exit={{
            scale: 0.9,
            opacity: 0,
            transition: { duration: 0.1 },
          }}
          initial={{ scale: 1, opacity: 0 }}
          onClick={() => {
            handleSelect();
          }}
          onHoverEnd={() => {
            if (selectedTool !== description) {
              setIsHovered(false);
            }
          }}
          onHoverStart={() => {
            setIsHovered(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSelect();
            }
          }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
        >
          {selectedTool === description ? <ArrowUpIcon /> : icon}
        </motion.div>
      </TooltipTrigger>
      <TooltipContent
        className="rounded-2xl bg-foreground p-3 px-4 text-background"
        side="left"
        sideOffset={16}
      >
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

const randomArr = [...new Array(6)].map((_x) => nanoid(5));

function ReadingLevelSelector({
  setSelectedTool,
  isAnimating,
  storeApi,
}: {
  setSelectedTool: Dispatch<SetStateAction<string | null>>;
  isAnimating: boolean;
  storeApi: ReturnType<typeof useChatStoreApi>;
}) {
  const sendMessage = useSendMessage();
  const LEVELS = [
    "Elementary",
    "Middle School",
    "Keep current level",
    "High School",
    "College",
    "Graduate",
  ];

  const { selectedModelId } = useChatInput();

  const y = useMotionValue(-40 * 2);
  const dragConstraints = 5 * 40 + 2;
  const yToLevel = useTransform(y, [0, -dragConstraints], [0, 5]);

  const [currentLevel, setCurrentLevel] = useState(2);
  const [hasUserSelectedLevel, setHasUserSelectedLevel] =
    useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = yToLevel.on("change", (latest) => {
      const level = Math.min(5, Math.max(0, Math.round(Math.abs(latest))));
      setCurrentLevel(level);
    });

    return () => unsubscribe();
  }, [yToLevel]);

  return (
    <div className="relative flex flex-col items-center justify-end">
      {randomArr.map((id) => (
        <motion.div
          animate={{ opacity: 1 }}
          className="flex size-[40px] flex-row items-center justify-center"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          key={id}
          transition={{ delay: 0.1 }}
        >
          <div className="size-2 rounded-full bg-muted-foreground/40" />
        </motion.div>
      ))}

      <Tooltip open={!isAnimating}>
        <TooltipTrigger asChild>
          <motion.div
            className={cx(
              "absolute flex flex-row items-center rounded-full border bg-background p-3",
              {
                "bg-primary text-primary-foreground": currentLevel !== 2,
                "bg-background text-foreground": currentLevel === 2,
              }
            )}
            drag="y"
            dragConstraints={{ top: -dragConstraints, bottom: 0 }}
            dragElastic={0}
            dragMomentum={false}
            onClick={() => {
              if (currentLevel !== 2 && hasUserSelectedLevel) {
                sendMessage?.({
                  role: "user",
                  parts: [
                    {
                      type: "text",
                      text: `Please adjust the reading level to ${LEVELS[currentLevel]} level.`,
                    },
                  ],
                  metadata: {
                    selectedModel: selectedModelId,
                    createdAt: new Date(),
                    parentMessageId: storeApi.getState().getLastMessageId(),
                  },
                });

                setSelectedTool(null);
              }
            }}
            onDragEnd={() => {
              if (currentLevel === 2) {
                setSelectedTool(null);
              } else {
                setHasUserSelectedLevel(true);
              }
            }}
            onDragStart={() => {
              setHasUserSelectedLevel(false);
            }}
            style={{ y }}
            transition={{ duration: 0.1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {currentLevel === 2 ? <SummarizeIcon /> : <ArrowUpIcon />}
          </motion.div>
        </TooltipTrigger>
        <TooltipContent
          className="rounded-2xl bg-foreground p-3 px-4 text-background text-sm"
          side="left"
          sideOffset={16}
        >
          {LEVELS[currentLevel]}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function Tools({
  isToolbarVisible,
  selectedTool,
  setSelectedTool,
  isAnimating,
  setIsToolbarVisible,
  tools,
  storeApi,
}: {
  isToolbarVisible: boolean;
  selectedTool: string | null;
  setSelectedTool: Dispatch<SetStateAction<string | null>>;
  isAnimating: boolean;
  setIsToolbarVisible: Dispatch<SetStateAction<boolean>>;
  tools: ArtifactToolbarItem[];
  storeApi: ReturnType<typeof useChatStoreApi>;
}) {
  const [primaryTool, ...secondaryTools] = tools;

  return (
    <motion.div
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col gap-1.5"
      exit={{ opacity: 0, scale: 0.95 }}
      initial={{ opacity: 0, scale: 0.95 }}
    >
      <AnimatePresence>
        {isToolbarVisible &&
          secondaryTools.map((secondaryTool) => (
            <Tool
              description={secondaryTool.description}
              icon={secondaryTool.icon}
              isAnimating={isAnimating}
              key={secondaryTool.description}
              onClick={secondaryTool.onClick}
              selectedTool={selectedTool}
              setSelectedTool={setSelectedTool}
              storeApi={storeApi}
            />
          ))}
      </AnimatePresence>

      <Tool
        description={primaryTool.description}
        icon={primaryTool.icon}
        isAnimating={isAnimating}
        isToolbarVisible={isToolbarVisible}
        onClick={primaryTool.onClick}
        selectedTool={selectedTool}
        setIsToolbarVisible={setIsToolbarVisible}
        setSelectedTool={setSelectedTool}
        storeApi={storeApi}
      />
    </motion.div>
  );
}

function PureToolbar({
  isToolbarVisible,
  setIsToolbarVisible,
  status,
  stop,
  artifactKind,
  storeApi,
}: {
  isToolbarVisible: boolean;
  setIsToolbarVisible: Dispatch<SetStateAction<boolean>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: UseChatHelpers<ChatMessage>["stop"];
  artifactKind: ArtifactKind;
  storeApi: ReturnType<typeof useChatStoreApi>;
}) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  // @ts-expect-error - usehooks-ts types are not updated for React 19
  useOnClickOutside(toolbarRef, () => {
    setIsToolbarVisible(false);
    setSelectedTool(null);
  });

  const startCloseTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setSelectedTool(null);
      setIsToolbarVisible(false);
    }, 2000);
  };

  const cancelCloseTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (status === "streaming") {
      setIsToolbarVisible(false);
    }
  }, [status, setIsToolbarVisible]);

  const artifactDefinition = artifactDefinitions.find(
    (definition) => definition.kind === artifactKind
  );

  if (!artifactDefinition) {
    throw new Error("Artifact definition not found!");
  }

  const toolsByArtifactKind = artifactDefinition.toolbar;

  if (toolsByArtifactKind.length === 0) {
    return null;
  }

  const getAnimateValue = () => {
    if (!isToolbarVisible) {
      return { opacity: 1, y: 0, height: 54, transition: { delay: 0 } };
    }
    if (selectedTool === "adjust-reading-level") {
      return {
        opacity: 1,
        y: 0,
        height: 6 * 43,
        transition: { delay: 0 },
        scale: 0.95,
      };
    }
    return {
      opacity: 1,
      y: 0,
      height: toolsByArtifactKind.length * 50,
      transition: { delay: 0 },
      scale: 1,
    };
  };

  return (
    <TooltipProvider delayDuration={0}>
      <motion.div
        animate={getAnimateValue()}
        className="absolute right-6 bottom-6 flex cursor-pointer flex-col justify-end rounded-full border bg-background p-1.5 shadow-lg"
        exit={{ opacity: 0, y: -20, transition: { duration: 0.1 } }}
        initial={{ opacity: 0, y: -20, scale: 1 }}
        onAnimationComplete={() => {
          setIsAnimating(false);
        }}
        onAnimationStart={() => {
          setIsAnimating(true);
        }}
        onHoverEnd={() => {
          if (status === "streaming") {
            return;
          }

          startCloseTimer();
        }}
        onHoverStart={() => {
          if (status === "streaming") {
            return;
          }

          cancelCloseTimer();
          setIsToolbarVisible(true);
        }}
        ref={toolbarRef}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {status === "streaming" && (
          <motion.div
            animate={{ scale: 1.4 }}
            className="p-3"
            exit={{ scale: 1 }}
            initial={{ scale: 1 }}
            key="stop-icon"
            onClick={() => {
              stop();
            }}
          >
            <StopIcon />
          </motion.div>
        )}
        {status !== "streaming" && selectedTool === "adjust-reading-level" && (
          <ReadingLevelSelector
            isAnimating={isAnimating}
            key="reading-level-selector"
            setSelectedTool={setSelectedTool}
            storeApi={storeApi}
          />
        )}
        {status !== "streaming" && selectedTool !== "adjust-reading-level" && (
          <Tools
            isAnimating={isAnimating}
            isToolbarVisible={isToolbarVisible}
            key="tools"
            selectedTool={selectedTool}
            setIsToolbarVisible={setIsToolbarVisible}
            setSelectedTool={setSelectedTool}
            storeApi={storeApi}
            tools={toolsByArtifactKind}
          />
        )}
      </motion.div>
    </TooltipProvider>
  );
}

export const Toolbar = memo(PureToolbar, (prevProps, nextProps) => {
  if (prevProps.status !== nextProps.status) {
    return false;
  }
  if (prevProps.isToolbarVisible !== nextProps.isToolbarVisible) {
    return false;
  }
  if (prevProps.artifactKind !== nextProps.artifactKind) {
    return false;
  }

  return true;
});
