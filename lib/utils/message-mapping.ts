import type { ChatMessage } from "@/lib/ai/types";
import type { Part } from "@/lib/db/schema";
import { validateToolPart } from "./message-part-validators";

/**
 * Creates a base part object with all nullable fields set to null
 */
function createBasePart(
  messageId: string,
  index: number,
  partType: string
): Omit<Part, "id" | "createdAt"> {
  return {
    messageId,
    order: index,
    type: partType,
    text_text: null,
    reasoning_text: null,
    file_mediaType: null,
    file_filename: null,
    file_url: null,
    source_url_sourceId: null,
    source_url_url: null,
    source_url_title: null,
    source_document_sourceId: null,
    source_document_mediaType: null,
    source_document_title: null,
    source_document_filename: null,
    tool_name: null,
    tool_toolCallId: null,
    tool_state: null,
    tool_input: null,
    tool_output: null,
    tool_errorText: null,
    data_type: null,
    data_blob: null,
    providerMetadata: null,
  };
}

/**
 * Handles tool-* part conversion to database format
 */
function convertToolPartToDB(
  part: ChatMessage["parts"][number],
  basePart: Omit<Part, "id" | "createdAt">
): Omit<Part, "id" | "createdAt"> | null {
  const validationResult = validateToolPart(part);

  if (!validationResult.success) {
    return null;
  }

  const toolPart = validationResult.data;
  const toolName = toolPart.type.replace("tool-", "");
  basePart.tool_name = toolName;
  basePart.tool_toolCallId = toolPart.toolCallId;
  basePart.tool_state = toolPart.state;

  const statesWithInput = [
    "input-available",
    "output-available",
    "output-error",
    "input-streaming",
  ];
  if (statesWithInput.includes(toolPart.state)) {
    basePart.tool_input = toolPart.input ?? null;
  }

  if (toolPart.state === "output-available") {
    basePart.tool_output = toolPart.output ?? null;
  }

  if (toolPart.state === "output-error") {
    basePart.tool_errorText = toolPart.errorText ?? null;
  }

  return basePart;
}

/**
 * Handles data-* part conversion to database format
 */
function convertDataPartToDB(
  part: ChatMessage["parts"][number],
  basePart: Omit<Part, "id" | "createdAt">
): Omit<Part, "id" | "createdAt"> {
  const dataType = part.type.replace("data-", "");
  basePart.data_type = dataType;
  basePart.data_blob = "data" in part ? part.data : part;
  return basePart;
}

/**
 * Handles the mapping of a single part to database format
 */
function mapPartToDBPart(
  part: ChatMessage["parts"][number],
  index: number,
  messageId: string
): Omit<Part, "id" | "createdAt"> | null {
  // Skip old "tool-invocation" format (runtime check for legacy data)
  if ((part as { type: string }).type === "tool-invocation") {
    return null;
  }

  const basePart = createBasePart(messageId, index, part.type);

  if ("providerMetadata" in part && part.providerMetadata) {
    basePart.providerMetadata = part.providerMetadata;
  }

  switch (part.type) {
    case "text":
      basePart.text_text = part.text;
      return basePart;

    case "reasoning":
      basePart.reasoning_text = part.text;
      return basePart;

    case "file":
      basePart.file_mediaType = part.mediaType;
      basePart.file_filename = part.filename ?? null;
      basePart.file_url = part.url;
      return basePart;

    case "source-url":
      basePart.source_url_sourceId = part.sourceId;
      basePart.source_url_url = part.url;
      basePart.source_url_title = part.title ?? null;
      return basePart;

    case "source-document":
      basePart.source_document_sourceId = part.sourceId;
      basePart.source_document_mediaType = part.mediaType;
      basePart.source_document_title = part.title;
      basePart.source_document_filename = part.filename ?? null;
      return basePart;

    case "step-start":
      return basePart;

    default:
      if (part.type.startsWith("tool-")) {
        return convertToolPartToDB(part, basePart);
      }

      if (part.type.startsWith("data-")) {
        return convertDataPartToDB(part, basePart);
      }

      basePart.data_type = part.type;
      basePart.data_blob = part;
      return basePart;
  }
}

/**
 * Maps UI message parts to database Part rows
 * Each UI part becomes a single Part row with prefix-based columns populated
 */
export function mapUIMessagePartsToDBParts(
  parts: ChatMessage["parts"],
  messageId: string
): Omit<Part, "id" | "createdAt">[] {
  return parts
    .map((part, index) => mapPartToDBPart(part, index, messageId))
    .filter((part): part is Omit<Part, "id" | "createdAt"> => part !== null);
}

/**
 * Creates base tool part object
 */
function createBaseToolPart(part: Part) {
  return {
    type: part.type as `tool-${string}`,
    toolCallId: part.tool_toolCallId,
  };
}

/**
 * Builds tool part with provider metadata if available
 */
function buildToolPartWithMetadata(
  basePart: ReturnType<typeof createBaseToolPart>,
  part: Part,
  additionalFields: Record<string, unknown>
): ChatMessage["parts"][number] {
  return {
    ...basePart,
    ...additionalFields,
    ...(part.providerMetadata
      ? { callProviderMetadata: part.providerMetadata }
      : {}),
  } as ChatMessage["parts"][number];
}

/**
 * Handles tool-* part conversion from database format
 */
function convertToolPartToUI(part: Part): ChatMessage["parts"][number] | null {
  if (!(part.tool_toolCallId && part.tool_state)) {
    return null;
  }

  const baseToolPart = createBaseToolPart(part);

  if (part.tool_state === "input-streaming") {
    return {
      ...baseToolPart,
      state: "input-streaming" as const,
      ...(part.tool_input !== null && part.tool_input !== undefined
        ? { input: part.tool_input }
        : {}),
    } as ChatMessage["parts"][number];
  }

  if (part.tool_state === "input-available") {
    return buildToolPartWithMetadata(baseToolPart, part, {
      state: "input-available" as const,
      input: part.tool_input ?? null,
    });
  }

  if (part.tool_state === "output-available") {
    return buildToolPartWithMetadata(baseToolPart, part, {
      state: "output-available" as const,
      input: part.tool_input ?? null,
      output: part.tool_output ?? null,
    });
  }

  if (part.tool_state === "output-error") {
    return buildToolPartWithMetadata(baseToolPart, part, {
      state: "output-error" as const,
      input: part.tool_input ?? null,
      errorText: part.tool_errorText ?? "",
    });
  }

  return null;
}

/**
 * Handles data-* part conversion from database format
 */
function convertDataPartToUI(part: Part): ChatMessage["parts"][number] | null {
  if (part.data_type && part.data_blob) {
    return {
      type: part.type as `data-${string}`,
      data: part.data_blob,
    } as ChatMessage["parts"][number];
  }

  if (part.data_blob) {
    return part.data_blob as ChatMessage["parts"][number];
  }

  return null;
}

/**
 * Converts text part to UI format
 */
function convertTextPartToUI(part: Part) {
  return {
    type: "text" as const,
    text: part.text_text ?? "",
  };
}

/**
 * Converts reasoning part to UI format
 */
function convertReasoningPartToUI(part: Part) {
  return {
    type: "reasoning" as const,
    text: part.reasoning_text ?? "",
    ...(part.providerMetadata
      ? { providerMetadata: part.providerMetadata }
      : {}),
  };
}

/**
 * Converts file part to UI format
 */
function convertFilePartToUI(part: Part) {
  return {
    type: "file" as const,
    mediaType: part.file_mediaType ?? "",
    ...(part.file_filename ? { filename: part.file_filename } : {}),
    url: part.file_url ?? "",
  };
}

/**
 * Converts source-url part to UI format
 */
function convertSourceUrlPartToUI(part: Part) {
  return {
    type: "source-url" as const,
    sourceId: part.source_url_sourceId ?? "",
    url: part.source_url_url ?? "",
    ...(part.source_url_title ? { title: part.source_url_title } : {}),
    ...(part.providerMetadata
      ? { providerMetadata: part.providerMetadata }
      : {}),
  };
}

/**
 * Converts source-document part to UI format
 */
function convertSourceDocumentPartToUI(part: Part) {
  return {
    type: "source-document" as const,
    sourceId: part.source_document_sourceId ?? "",
    mediaType: part.source_document_mediaType ?? "",
    title: part.source_document_title ?? "",
    ...(part.source_document_filename
      ? { filename: part.source_document_filename }
      : {}),
    ...(part.providerMetadata
      ? { providerMetadata: part.providerMetadata }
      : {}),
  };
}

/**
 * Converts step-start part to UI format
 */
function convertStepStartPartToUI() {
  return {
    type: "step-start" as const,
  };
}

/**
 * Handles the mapping of a single part from database format to UI format
 */
function mapPartToUIPart(part: Part): ChatMessage["parts"][number] | null {
  if (part.type === "text") {
    return convertTextPartToUI(part);
  }

  if (part.type === "reasoning") {
    return convertReasoningPartToUI(part);
  }

  if (part.type === "file") {
    return convertFilePartToUI(part);
  }

  if (part.type === "source-url") {
    return convertSourceUrlPartToUI(part);
  }

  if (part.type === "source-document") {
    return convertSourceDocumentPartToUI(part);
  }

  if (part.type === "step-start") {
    return convertStepStartPartToUI();
  }

  if (part.type.startsWith("tool-")) {
    return convertToolPartToUI(part);
  }

  if (part.type.startsWith("data-")) {
    return convertDataPartToUI(part);
  }

  throw new Error(`Unsupported part type: ${part.type}`);
}

/**
 * Maps database Part rows back to UI message parts
 * Reconstructs the original ChatMessage parts array from Part rows
 */
export function mapDBPartsToUIParts(dbParts: Part[]): ChatMessage["parts"] {
  const parts = dbParts
    .sort((a, b) => a.order - b.order)
    .map((part) => mapPartToUIPart(part));

  return parts.filter(
    (part): part is ChatMessage["parts"][number] => part !== null
  );
}
