import { Copy, LineChart, Redo2, Sparkles, Undo2 } from "lucide-react";
import { parse, unparse } from "papaparse";
import { toast } from "sonner";
import { Artifact } from "@/components/create-artifact";
import { SpreadsheetEditor } from "@/components/sheet-editor";
import { config } from "@/lib/config";

type Metadata = any;

export const sheetArtifact = new Artifact<"sheet", Metadata>({
  kind: "sheet",
  description: "Useful for working with spreadsheets",
  initialize: async () => {
    // No initialization needed for sheet artifact
  },
  content: ({
    content,
    currentVersionIndex,
    isCurrentVersion,
    onSaveContent,
    status,
    isReadonly,
  }) => (
    <SpreadsheetEditor
      content={content}
      currentVersionIndex={currentVersionIndex}
      isCurrentVersion={isCurrentVersion}
      isReadonly={isReadonly}
      saveContent={onSaveContent}
      status={status}
    />
  ),
  actions: [
    {
      icon: <Undo2 size={18} />,
      description: "View Previous version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <Redo2 size={18} />,
      description: "View Next version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <Copy size={16} />,
      description: "Copy as .csv",
      onClick: ({ content }) => {
        const parsed = parse<string[]>(content, { skipEmptyLines: true });

        const nonEmptyRows = parsed.data.filter((row) =>
          row.some((cell) => cell.trim() !== "")
        );

        const cleanedCsv = unparse(nonEmptyRows);

        navigator.clipboard.writeText(cleanedCsv);
        toast.success("Copied csv to clipboard!");
      },
    },
  ],
  toolbar: [
    {
      description: "Format and clean data",
      icon: <Sparkles size={16} />,
      onClick: ({ sendMessage, storeApi }) => {
        sendMessage({
          role: "user",
          parts: [
            { type: "text", text: "Can you please format and clean the data?" },
          ],
          metadata: {
            selectedModel: config.ai.tools.sheet.format,
            createdAt: new Date(),
            parentMessageId: storeApi.getState().getLastMessageId(),
            activeStreamId: null,
          },
        });
      },
    },
    {
      description: "Analyze and visualize data",
      icon: <LineChart size={16} />,
      onClick: ({ sendMessage, storeApi }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Can you please analyze and visualize the data by creating a new code artifact in python?",
            },
          ],
          metadata: {
            selectedModel: config.ai.tools.sheet.analyze,
            createdAt: new Date(),
            parentMessageId: storeApi.getState().getLastMessageId(),
            activeStreamId: null,
          },
        });
      },
    },
  ],
});
