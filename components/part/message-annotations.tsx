import { memo } from "react";
import type {
  ResearchUpdate,
  WebSearchUpdate,
} from "@/lib/ai/tools/research-updates-schema";
import { useMessageResearchUpdatePartsById } from "@/lib/stores/hooks-base";
import { ReasonSearchResearchProgress } from "../deep-research-progress";
import { Sources } from "../sources";

export const SourcesAnnotations = memo(
  ({ messageId }: { messageId: string }) => {
    const parts = useMessageResearchUpdatePartsById(messageId);

    const researchUpdates = parts.map((u) => u.data);

    if (researchUpdates.length === 0) {
      return null;
    }

    const researchCompleted = researchUpdates.find(
      (u) => u.type === "completed"
    );

    if (!researchCompleted) {
      return null;
    }

    const webSearchUpdates = researchUpdates
      .filter<WebSearchUpdate>((u) => u.type === "web")
      .filter((u) => u.results)
      .flatMap((u) => u.results)
      .filter((u) => u !== undefined);

    const deDuppedSources = webSearchUpdates.filter(
      (source, index, self) =>
        index === self.findIndex((t) => t.url === source.url)
    );

    return <Sources sources={deDuppedSources} />;
  }
);

SourcesAnnotations.displayName = "SourcesAnnotations";

// Render a given list of research updates (already grouped/filtered)
export const ResearchUpdates = ({
  updates,
}: {
  updates: ResearchUpdate[] | undefined;
}) => {
  if (!updates || updates.length === 0) {
    return null;
  }
  return <ReasonSearchResearchProgress updates={updates} />;
};
