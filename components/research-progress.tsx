import { Maximize2, Minimize2 } from "lucide-react";
import React from "react";
import { UpdateTitle } from "@/components/update-title";
// Type-only imports
import type { ResearchUpdate } from "@/lib/ai/tools/research-updates-schema";
import { cn } from "@/lib/utils";
import { ResearchTask } from "./research-task";
import { ResearchTasks } from "./research-tasks";

// Add the updateName mapping (consider moving to a shared util later)
const updateName = {
  web: "Web Search",
  started: "Started",
  completed: "Completed",
  thoughts: "Thoughts",
  writing: "Writing",
} as const;

export const ResearchProgress = ({
  updates,
  totalExpectedSteps: _totalExpectedSteps,
  isComplete,
}: {
  updates: ResearchUpdate[];
  totalExpectedSteps: number;
  isComplete: boolean;
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const lastUpdate = updates.length > 0 ? updates.at(-1) : null;

  const searchCount = React.useMemo(
    () => updates.filter((u) => u.type === "web").length,
    [updates]
  );

  const sourceCount = React.useMemo(
    () =>
      updates
        .filter((u) => u.type === "web")
        .reduce((acc, u) => acc + (u.results?.length || 0), 0),
    [updates]
  );

  // TODO: First update is not showing
  let lastUpdateTitle: string;
  if (isComplete) {
    lastUpdateTitle = "Research Complete";
  } else if (lastUpdate) {
    lastUpdateTitle = lastUpdate.title || updateName[lastUpdate.type];
  } else {
    lastUpdateTitle = "Researching";
  }

  const timeSpent = React.useMemo(() => {
    if (isComplete) {
      const progressUpdates = updates.filter(
        (u) => u.type === "started" || u.type === "completed"
      );
      const completedUpdate = progressUpdates.find(
        (u) => u.type === "completed"
      );

      return completedUpdate?.timestamp
        ? Math.floor(
            (completedUpdate.timestamp - progressUpdates[0].timestamp) / 1000
          )
        : 0;
    }
    return 0;
  }, [updates, isComplete]);

  return (
    <div className="w-full rounded-lg border p-1">
      <button
        className={cn(
          "flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2",
          "transition-colors hover:bg-accent hover:text-accent-foreground"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {isComplete ? (
              <span className="text-muted-foreground text-xs">{`Researched for ${timeSpent} seconds, ${searchCount} searches, ${sourceCount} sources`}</span>
            ) : (
              <UpdateTitle isRunning={!isComplete} title={lastUpdateTitle} />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <Minimize2
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
          ) : (
            <Maximize2
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground"
            />
          )}
        </div>
      </button>

      {isExpanded ? (
        <div className="px-1 pt-2 pb-1">
          <ResearchTasks updates={updates} />
        </div>
      ) : (
        lastUpdate &&
        !isComplete && (
          <div className="px-4 pt-1 pb-3">
            {/* We only show the running step in this component */}
            <ResearchTask isRunning={true} minimal={true} update={lastUpdate} />
          </div>
        )
      )}
    </div>
  );
};
