"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import { useChatActions, useChatStoreApi } from "@ai-sdk-tools/store";
import { useMutation } from "@tanstack/react-query";
import { CameraIcon, FileIcon, ImageIcon, PlusIcon } from "lucide-react";
import type React from "react";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { ContextBar } from "@/components/context-bar";
import { ContextUsageFromParent } from "@/components/context-usage";
import { useSaveMessageMutation } from "@/hooks/chat-sync-hooks";
import { useArtifact } from "@/hooks/use-artifact";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AppModelId } from "@/lib/ai/app-model-id";
import type { Attachment, ChatMessage, UiToolName } from "@/lib/ai/types";
import { config } from "@/lib/config";
import { processFilesForUpload } from "@/lib/files/upload-prep";
import { useLastMessageId } from "@/lib/stores/hooks-base";
import { useAddMessageToTree } from "@/lib/stores/hooks-threads";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { cn, generateUUID } from "@/lib/utils";
import { useChatId } from "@/providers/chat-id-provider";
import { useChatInput } from "@/providers/chat-input-provider";
import { useChatModels } from "@/providers/chat-models-provider";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";
import { ConnectorsDropdown } from "./connectors-dropdown";
import { LexicalChatInput } from "./lexical-chat-input";
import { ModelSelector } from "./model-selector";
import { ResponsiveTools } from "./responsive-tools";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { LimitDisplay } from "./upgrade-cta/limit-display";
import { LoginPrompt } from "./upgrade-cta/login-prompt";

const PROJECT_ROUTE_REGEX = /^\/project\/([^/]+)$/;

/** Derive accept string for images only */
function getAcceptImages(acceptedTypes: Record<string, string[]>): string {
  return Object.entries(acceptedTypes)
    .filter(([mime]) => mime.startsWith("image/"))
    .flatMap(([, exts]) => exts)
    .join(",");
}

/** Derive accept string for non-image files only */
function getAcceptFiles(acceptedTypes: Record<string, string[]>): string {
  return Object.entries(acceptedTypes)
    .filter(([mime]) => !mime.startsWith("image/"))
    .flatMap(([, exts]) => exts)
    .join(",");
}

/** Derive accept string for all file types */
function getAcceptAll(acceptedTypes: Record<string, string[]>): string {
  return Object.values(acceptedTypes).flat().join(",");
}

function PureMultimodalInput({
  chatId,
  status,
  className,
  isEditMode = false,
  parentMessageId,
  onSendMessage,
}: {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  className?: string;
  isEditMode?: boolean;
  parentMessageId: string | null;
  onSendMessage?: (message: ChatMessage) => void | Promise<void>;
}) {
  const storeApi = useChatStoreApi<ChatMessage>();
  const { artifact, closeArtifact } = useArtifact();
  const { data: session } = useSession();
  const trpc = useTRPC();
  const isMobile = useIsMobile();
  const { mutate: saveChatMessage } = useSaveMessageMutation();
  const addMessageToTree = useAddMessageToTree();
  useChatId();
  const {
    setMessages,
    sendMessage,
    stop: stopHelper,
  } = useChatActions<ChatMessage>();
  const lastMessageId = useLastMessageId();
  const {
    editorRef,
    selectedTool,
    setSelectedTool,
    attachments,
    setAttachments,
    selectedModelId,
    handleModelChange,
    getInputValue,
    handleInputChange,
    getInitialInput,
    isEmpty,
    handleSubmit,
  } = useChatInput();

  const isAnonymous = !session?.user;
  const isModelDisallowedForAnonymous =
    isAnonymous &&
    !(ANONYMOUS_LIMITS.AVAILABLE_MODELS as readonly AppModelId[]).includes(
      selectedModelId
    );
  const { getModelById } = useChatModels();
  const stopStreamMutation = useMutation(
    trpc.chat.stopStream.mutationOptions()
  );

  // Attachment configuration from site config
  const { maxBytes, maxDimension, acceptedTypes } = config.attachments;
  const maxMB = Math.round(maxBytes / (1024 * 1024));
  const attachmentsEnabled = config.features.attachments;
  const acceptImages = useMemo(
    () => getAcceptImages(acceptedTypes),
    [acceptedTypes]
  );
  const acceptFiles = useMemo(
    () => getAcceptFiles(acceptedTypes),
    [acceptedTypes]
  );
  const acceptAll = useMemo(() => getAcceptAll(acceptedTypes), [acceptedTypes]);

  // Helper function to auto-switch to PDF-compatible model
  const switchToPdfCompatibleModel = useCallback(() => {
    const pdfModel = config.ai.workflows.pdf;
    const defaultPdfModelDef = getModelById(pdfModel);
    if (defaultPdfModelDef) {
      toast.success(`Switched to ${defaultPdfModelDef.name} (supports PDF)`);
    }
    handleModelChange(pdfModel);
    return defaultPdfModelDef;
  }, [handleModelChange, getModelById]);

  // Helper function to auto-switch to image-compatible model
  const switchToImageCompatibleModel = useCallback(() => {
    const imageModel = config.ai.workflows.chatImageCompatible;
    const defaultImageModelDef = getModelById(imageModel);
    if (defaultImageModelDef) {
      toast.success(
        `Switched to ${defaultImageModelDef.name} (supports images)`
      );
    }
    handleModelChange(imageModel);
    return defaultImageModelDef;
  }, [handleModelChange, getModelById]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);

  // Centralized submission gating
  const submission = useMemo(():
    | { enabled: false; message: string }
    | { enabled: true } => {
    if (isModelDisallowedForAnonymous) {
      return { enabled: false, message: "Log in to use this model" };
    }
    if (status !== "ready" && status !== "error") {
      return {
        enabled: false,
        message: "Please wait for the model to finish its response!",
      };
    }
    if (uploadQueue.length > 0) {
      return {
        enabled: false,
        message: "Please wait for files to finish uploading!",
      };
    }
    if (isEmpty) {
      return {
        enabled: false,
        message: "Please enter a message before sending!",
      };
    }
    return { enabled: true };
  }, [isEmpty, isModelDisallowedForAnonymous, status, uploadQueue.length]);

  // Helper function to process and validate files
  const processFiles = useCallback(
    async (files: File[]): Promise<File[]> => {
      const { processedImages, pdfFiles, stillOversized, unsupportedFiles } =
        await processFilesForUpload(files, { maxBytes, maxDimension });

      if (stillOversized.length > 0) {
        toast.error(
          `${stillOversized.length} file(s) exceed ${maxMB}MB after compression`
        );
      }
      if (unsupportedFiles.length > 0) {
        toast.error(
          `${unsupportedFiles.length} unsupported file type(s). Only images and PDFs are allowed`
        );
      }

      // Auto-switch model based on file types
      if (pdfFiles.length > 0 || processedImages.length > 0) {
        let currentModelDef = getModelById(selectedModelId);

        if (pdfFiles.length > 0 && !currentModelDef?.input?.pdf) {
          currentModelDef = switchToPdfCompatibleModel();
        }
        if (processedImages.length > 0 && !currentModelDef?.input?.image) {
          currentModelDef = switchToImageCompatibleModel();
        }
      }

      return [...processedImages, ...pdfFiles];
    },
    [
      maxBytes,
      maxDimension,
      maxMB,
      selectedModelId,
      switchToPdfCompatibleModel,
      switchToImageCompatibleModel,
      getModelById,
    ]
  );

  // Update URL when sending message in new chat or project
  // Anonymous users stay on / - no URL redirect for them
  const updateChatUrl = useCallback(
    (chatIdToAdd: string) => {
      if (!session?.user) {
        return;
      }

      const currentPath = window.location.pathname;
      if (currentPath === "/") {
        window.history.pushState({}, "", `/chat/${chatIdToAdd}`);
        return;
      }

      // Handle project routes: /project/:projectId -> /project/:projectId/chat/:chatId
      const projectMatch = currentPath.match(PROJECT_ROUTE_REGEX);
      if (projectMatch) {
        const [, projectId] = projectMatch;
        window.history.pushState(
          {},
          "",
          `/project/${projectId}/chat/${chatIdToAdd}`
        );
      }
    },
    [session?.user]
  );

  // Trim messages in edit mode
  const trimMessagesInEditMode = useCallback(
    (parentId: string | null) => {
      if (parentId === null) {
        setMessages([]);
        // Close artifact if it was visible since all messages are removed
        if (artifact.isVisible) {
          closeArtifact();
        }
        return;
      }

      const parentIndex = storeApi
        .getState()
        .getThrottledMessages()
        .findIndex((msg: ChatMessage) => msg.id === parentId);

      if (parentIndex !== -1) {
        const messagesUpToParent = storeApi
          .getState()
          .getThrottledMessages()
          .slice(0, parentIndex + 1);

        // Close artifact if its message will not be in the trimmed messages
        if (
          artifact.isVisible &&
          artifact.messageId &&
          !messagesUpToParent.some((m) => m.id === artifact.messageId)
        ) {
          closeArtifact();
        }

        setMessages(messagesUpToParent);
      }
    },
    [
      artifact.isVisible,
      artifact.messageId,
      closeArtifact,
      setMessages,
      storeApi,
    ]
  );

  const coreSubmitLogic = useCallback(() => {
    const input = getInputValue();

    updateChatUrl(chatId);

    // Get the appropriate parent message ID
    const effectiveParentMessageId = isEditMode
      ? parentMessageId
      : lastMessageId;

    // In edit mode, trim messages to the parent message
    if (isEditMode) {
      trimMessagesInEditMode(parentMessageId);
    }

    const message: ChatMessage = {
      id: generateUUID(),
      parts: [
        ...attachments.map((attachment) => ({
          type: "file" as const,
          url: attachment.url,
          name: attachment.name,
          mediaType: attachment.contentType,
        })),
        {
          type: "text",
          text: input,
        },
      ],
      metadata: {
        createdAt: new Date(),
        parentMessageId: effectiveParentMessageId,
        selectedModel: selectedModelId,
        activeStreamId: null,
        selectedTool: selectedTool || undefined,
      },
      role: "user",
    };

    onSendMessage?.(message);

    addMessageToTree(message);
    saveChatMessage({ message, chatId });

    sendMessage(message);

    // Refocus after submit
    if (!isMobile) {
      editorRef.current?.focus();
    }
  }, [
    addMessageToTree,
    attachments,
    isMobile,
    chatId,
    selectedTool,
    isEditMode,
    getInputValue,
    saveChatMessage,
    parentMessageId,
    selectedModelId,
    editorRef,
    lastMessageId,
    onSendMessage,
    sendMessage,
    updateChatUrl,
    trimMessagesInEditMode,
  ]);

  const submitForm = useCallback(() => {
    handleSubmit(coreSubmitLogic, isEditMode);
  }, [handleSubmit, coreSubmitLogic, isEditMode]);

  const uploadFile = useCallback(
    async (
      file: File
    ): Promise<
      { url: string; name: string; contentType: string } | undefined
    > => {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data: { url: string; pathname: string; contentType: string } =
            await response.json();
          const { url, pathname, contentType } = data;

          return {
            url,
            name: pathname,
            contentType,
          };
        }
        const { error } = (await response.json()) as { error?: string };
        toast.error(error);
      } catch (_error) {
        toast.error("Failed to upload file, please try again!");
      }
    },
    []
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      const validFiles = await processFiles(files);

      if (validFiles.length === 0) {
        return;
      }

      setUploadQueue(validFiles.map((file) => file.name));

      try {
        const uploadPromises = validFiles.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, processFiles, uploadFile]
  );

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent) => {
      if (status !== "ready") {
        return;
      }

      // Skip file paste handling if blob storage is disabled
      if (!attachmentsEnabled) {
        return;
      }

      const clipboardData = event.clipboardData;
      if (!clipboardData) {
        return;
      }

      const files = Array.from(clipboardData.files);
      if (files.length === 0) {
        return;
      }

      event.preventDefault();

      // Check if user is anonymous
      if (!session?.user) {
        toast.error("Sign in to attach files from clipboard");
        return;
      }

      const validFiles = await processFiles(files);
      if (validFiles.length === 0) {
        return;
      }

      setUploadQueue(validFiles.map((file) => file.name));

      try {
        const uploadPromises = validFiles.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);

        toast.success(
          `${successfullyUploadedAttachments.length} file(s) pasted from clipboard`
        );
      } catch (error) {
        console.error("Error uploading pasted files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    [
      setAttachments,
      processFiles,
      status,
      session,
      uploadFile,
      attachmentsEnabled,
    ]
  );

  const removeAttachment = useCallback(
    (attachmentToRemove: Attachment) => {
      setAttachments((currentAttachments) =>
        currentAttachments.filter(
          (attachment) => attachment.url !== attachmentToRemove.url
        )
      );
    },
    [setAttachments]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) {
        return;
      }

      // Check if user is anonymous
      if (!session?.user) {
        toast.error("Sign in to attach files");
        return;
      }

      const validFiles = await processFiles(acceptedFiles);
      if (validFiles.length === 0) {
        return;
      }

      setUploadQueue(validFiles.map((file) => file.name));

      try {
        const uploadPromises = validFiles.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    noClick: true, // Prevent click to open file dialog since we have the button
    disabled: status !== "ready" || !attachmentsEnabled,
    noDrag: !attachmentsEnabled,
    accept: acceptedTypes,
  });

  const handleStop = useCallback(() => {
    if (session?.user && lastMessageId) {
      stopStreamMutation.mutate({ messageId: lastMessageId });
    }
    stopHelper?.();
  }, [lastMessageId, session?.user, stopHelper, stopStreamMutation]);

  return (
    <div className="relative">
      {attachmentsEnabled && (
        <input
          accept={acceptAll}
          className="pointer-events-none fixed -top-4 -left-4 size-0.5 opacity-0"
          multiple
          onChange={handleFileChange}
          ref={fileInputRef}
          tabIndex={-1}
          type="file"
        />
      )}

      <div className="relative">
        <PromptInput
          className={cn(
            "@container relative transition-colors",
            isDragActive && "border-blue-500 bg-blue-50 dark:bg-blue-950/20",
            className
          )}
          inputGroupClassName="dark:bg-muted bg-muted"
          {...getRootProps({ onError: undefined, onSubmit: undefined })}
          onSubmit={(_message, event) => {
            event.preventDefault();
            if (!submission.enabled) {
              if (submission.message) {
                toast.error(submission.message);
              }
              return;
            }
            submitForm();
          }}
        >
          <input {...getInputProps()} />

          {isDragActive && attachmentsEnabled && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-blue-500 border-dashed bg-blue-50/80 dark:bg-blue-950/40">
              <div className="font-medium text-blue-600 dark:text-blue-400">
                Drop images or PDFs here to attach
              </div>
            </div>
          )}

          {!isEditMode && (
            <LimitDisplay
              className="p-2"
              forceVariant={isModelDisallowedForAnonymous ? "model" : "credits"}
            />
          )}

          <ContextBar
            attachments={attachments}
            className="w-full"
            onRemoveAction={removeAttachment}
            uploadQueue={uploadQueue}
          />

          <LexicalChatInput
            autoFocus
            className="max-h-[max(35svh,5rem)] min-h-[60px] overflow-y-scroll sm:min-h-[80px]"
            data-testid="multimodal-input"
            initialValue={getInitialInput()}
            onEnterSubmit={(event) => {
              const shouldSubmit = isMobile ? event.ctrlKey : !event.shiftKey;

              if (shouldSubmit) {
                if (!submission.enabled) {
                  if (submission.message) {
                    toast.error(submission.message);
                  }
                  return true;
                }
                submitForm();
                return true;
              }

              return false;
            }}
            onInputChange={handleInputChange}
            onPaste={handlePaste}
            placeholder={
              isMobile
                ? "Send a message... (Ctrl+Enter to send)"
                : "Send a message..."
            }
            ref={editorRef}
          />

          <ChatInputBottomControls
            acceptAll={acceptAll}
            acceptFiles={acceptFiles}
            acceptImages={acceptImages}
            attachmentsEnabled={attachmentsEnabled}
            fileInputRef={fileInputRef}
            onModelChange={handleModelChange}
            onStop={handleStop}
            parentMessageId={parentMessageId}
            selectedModelId={selectedModelId}
            selectedTool={selectedTool}
            setSelectedTool={setSelectedTool}
            status={status}
            submission={submission}
            submitForm={submitForm}
          />
        </PromptInput>
      </div>
    </div>
  );
}

function PureAttachmentsButton({
  fileInputRef,
  status,
  acceptAll,
  acceptImages,
  acceptFiles,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  acceptAll: string;
  acceptImages: string;
  acceptFiles: string;
}) {
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const isAnonymous = !session?.user;
  const [showLoginPopover, setShowLoginPopover] = useState(false);

  const triggerFileInput = useCallback(
    (accept: string, capture?: "environment" | "user") => {
      const input = fileInputRef.current;
      if (!input) {
        return;
      }
      input.accept = accept;
      if (capture) {
        input.capture = capture;
      } else {
        input.removeAttribute("capture");
      }
      input.click();
    },
    [fileInputRef]
  );

  const handleDesktopClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isAnonymous) {
      setShowLoginPopover(true);
      return;
    }
    triggerFileInput(acceptAll);
  };

  // Mobile: dropdown with separate options
  if (isMobile) {
    if (isAnonymous) {
      return (
        <Popover onOpenChange={setShowLoginPopover} open={showLoginPopover}>
          <PopoverTrigger asChild>
            <PromptInputButton
              className="size-8"
              data-testid="attachments-button"
              disabled={status !== "ready"}
              onClick={() => setShowLoginPopover(true)}
              variant="ghost"
            >
              <PlusIcon className="size-4" />
            </PromptInputButton>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <LoginPrompt
              description="You can attach images and PDFs to your messages for the AI to analyze."
              title="Sign in to attach files"
            />
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <PromptInputButton
            className="size-8"
            data-testid="attachments-button"
            disabled={status !== "ready"}
            variant="ghost"
          >
            <PlusIcon className="size-4" />
          </PromptInputButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => triggerFileInput(acceptImages)}>
            <ImageIcon />
            Add photos
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => triggerFileInput(acceptImages, "environment")}
          >
            <CameraIcon />
            Take photo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => triggerFileInput(acceptFiles)}>
            <FileIcon />
            Add files
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Desktop: single button with tooltip
  return (
    <Popover onOpenChange={setShowLoginPopover} open={showLoginPopover}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <PromptInputButton
              className="@[500px]:size-10 size-8"
              data-testid="attachments-button"
              disabled={status !== "ready"}
              onClick={handleDesktopClick}
              variant="ghost"
            >
              <PlusIcon className="size-4" />
            </PromptInputButton>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Add Files</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80 p-0">
        <LoginPrompt
          description="You can attach images and PDFs to your messages for the AI to analyze."
          title="Sign in to attach files"
        />
      </PopoverContent>
    </Popover>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureChatInputBottomControls({
  selectedModelId,
  onModelChange,
  selectedTool,
  setSelectedTool,
  fileInputRef,
  status,
  submitForm,
  submission,
  parentMessageId,
  acceptAll,
  acceptImages,
  acceptFiles,
  attachmentsEnabled,
  onStop,
}: {
  selectedModelId: AppModelId;
  onModelChange: (modelId: AppModelId) => void;
  selectedTool: UiToolName | null;
  setSelectedTool: Dispatch<SetStateAction<UiToolName | null>>;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  submitForm: () => void;
  submission: { enabled: boolean; message?: string };
  parentMessageId: string | null;
  acceptAll: string;
  acceptImages: string;
  acceptFiles: string;
  attachmentsEnabled: boolean;
  onStop: () => void;
}) {
  return (
    <PromptInputFooter className="flex w-full min-w-0 flex-row items-center justify-between @[500px]:gap-2 gap-1 border-t px-1 py-1 group-has-[>input]/input-group:pb-1 [.border-t]:pt-1">
      <PromptInputTools className="flex min-w-0 items-center @[500px]:gap-2 gap-1">
        {attachmentsEnabled && (
          <AttachmentsButton
            acceptAll={acceptAll}
            acceptFiles={acceptFiles}
            acceptImages={acceptImages}
            fileInputRef={fileInputRef}
            status={status}
          />
        )}
        <ModelSelector
          className="@[500px]:h-10 h-8 w-fit max-w-none shrink justify-start truncate @[500px]:px-3 px-2 @[500px]:text-sm text-xs"
          onModelChangeAction={onModelChange}
          selectedModelId={selectedModelId}
        />
        <ConnectorsDropdown />
        <ResponsiveTools
          selectedModelId={selectedModelId}
          setTools={setSelectedTool}
          tools={selectedTool}
        />
      </PromptInputTools>
      <div className="flex items-center gap-1">
        <ContextUsageFromParent
          className="@[500px]:block hidden"
          iconOnly
          parentMessageId={parentMessageId}
          selectedModelId={selectedModelId}
        />
        <PromptInputSubmit
          className={"@[500px]:size-10 size-8 shrink-0"}
          disabled={status === "ready" && !submission.enabled}
          onClick={(e) => {
            e.preventDefault();
            if (status === "streaming" || status === "submitted") {
              onStop();
            } else if (status === "ready" || status === "error") {
              if (!submission.enabled) {
                if (submission.message) {
                  toast.error(submission.message);
                }
                return;
              }
              submitForm();
            }
          }}
          status={status}
        />
      </div>
    </PromptInputFooter>
  );
}

const ChatInputBottomControls = memo(PureChatInputBottomControls);

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.status !== nextProps.status) return false;
    if (prevProps.isEditMode !== nextProps.isEditMode) return false;
    if (prevProps.chatId !== nextProps.chatId) return false;
    if (prevProps.className !== nextProps.className) return false;
    if (prevProps.parentMessageId !== nextProps.parentMessageId) return false;
    if (prevProps.onSendMessage !== nextProps.onSendMessage) return false;
    return true;
  }
);
