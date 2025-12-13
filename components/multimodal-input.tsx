"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import { useChatActions, useChatStoreApi } from "@ai-sdk-tools/store";
import { PlusIcon } from "lucide-react";
import type React from "react";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
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
import { useIsMobile } from "@/hooks/use-mobile";
import type { AppModelDefinition, AppModelId } from "@/lib/ai/app-models";
import {
  DEFAULT_CHAT_IMAGE_COMPATIBLE_MODEL,
  DEFAULT_CHAT_MODEL,
  DEFAULT_PDF_MODEL,
} from "@/lib/ai/app-models";
import type { Attachment, ChatMessage, UiToolName } from "@/lib/ai/types";
import { processFilesForUpload } from "@/lib/files/upload-prep";
import { useLastMessageId, useMessageIds } from "@/lib/stores/hooks-base";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { cn, generateUUID } from "@/lib/utils";
import { useChatId } from "@/providers/chat-id-provider";
import { useChatInput } from "@/providers/chat-input-provider";
import { useChatModels } from "@/providers/chat-models-provider";
import { useSession } from "@/providers/session-provider";
import { ConnectorsDropdown } from "./connectors-dropdown";
import { ImageModal } from "./image-modal";
import { LexicalChatInput } from "./lexical-chat-input";
import { ModelSelector } from "./model-selector";
import { ResponsiveTools } from "./responsive-tools";
import { SuggestedActions } from "./suggested-actions";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { LimitDisplay } from "./upgrade-cta/limit-display";
import { LoginPrompt } from "./upgrade-cta/login-prompt";

const IMAGE_UPLOAD_LIMITS = {
  maxBytes: 1024 * 1024,
  maxDimension: 2048,
};
const IMAGE_UPLOAD_MAX_MB = Math.round(
  IMAGE_UPLOAD_LIMITS.maxBytes / (1024 * 1024)
);
const PROJECT_ROUTE_REGEX = /^\/project\/([^/]+)$/;

function PureMultimodalInput({
  chatId,
  status,
  className,
  isEditMode = false,
  parentMessageId,
  onSendMessage,
  disableSuggestedActions = false,
  emptyStateOverride,
}: {
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  className?: string;
  isEditMode?: boolean;
  parentMessageId: string | null;
  onSendMessage?: (message: ChatMessage) => void | Promise<void>;
  disableSuggestedActions?: boolean;
  emptyStateOverride?: React.ReactNode;
}) {
  const storeApi = useChatStoreApi<ChatMessage>();
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const { mutate: saveChatMessage } = useSaveMessageMutation();
  useChatId();
  const messageIds = useMessageIds();
  const { setMessages, sendMessage } = useChatActions<ChatMessage>();
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
    isAnonymous && !ANONYMOUS_LIMITS.AVAILABLE_MODELS.includes(selectedModelId);
  const { getModelById } = useChatModels();

  // Helper function to auto-switch to PDF-compatible model
  const switchToPdfCompatibleModel = useCallback(() => {
    const defaultPdfModelDef = getModelById(DEFAULT_PDF_MODEL);
    if (defaultPdfModelDef) {
      toast.success(`Switched to ${defaultPdfModelDef.name} (supports PDF)`);
    }
    handleModelChange(DEFAULT_PDF_MODEL);
    return defaultPdfModelDef;
  }, [handleModelChange, getModelById]);

  // Helper function to auto-switch to image-compatible model
  const switchToImageCompatibleModel = useCallback(() => {
    const defaultImageModelDef = getModelById(
      DEFAULT_CHAT_IMAGE_COMPATIBLE_MODEL
    );
    if (defaultImageModelDef) {
      toast.success(
        `Switched to ${defaultImageModelDef.name} (supports images)`
      );
    }
    handleModelChange(DEFAULT_CHAT_IMAGE_COMPATIBLE_MODEL);
    return defaultImageModelDef;
  }, [handleModelChange, getModelById]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const [imageModal, setImageModal] = useState<{
    isOpen: boolean;
    imageUrl: string;
    imageName?: string;
  }>({
    isOpen: false,
    imageUrl: "",
    imageName: undefined,
  });

  // Centralized submission gating

  const _selectedModelDef: AppModelDefinition | undefined =
    getModelById(selectedModelId) ?? getModelById(DEFAULT_CHAT_MODEL);
  const submission: { enabled: false; message: string } | { enabled: true } =
    (() => {
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
    })();

  // Helper function to process and validate files
  const processFiles = useCallback(
    async (files: File[]): Promise<File[]> => {
      const { processedImages, pdfFiles, stillOversized, unsupportedFiles } =
        await processFilesForUpload(files, IMAGE_UPLOAD_LIMITS);

      if (stillOversized.length > 0) {
        toast.error(
          `${stillOversized.length} file(s) exceed ${IMAGE_UPLOAD_MAX_MB}MB after compression`
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
        setMessages(messagesUpToParent);
      }
    },
    [setMessages, storeApi]
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
        selectedTool: selectedTool || undefined,
      },
      role: "user",
    };

    onSendMessage?.(message);

    saveChatMessage({ message, chatId });

    sendMessage(message);

    // Refocus after submit
    if (!isMobile) {
      editorRef.current?.focus();
    }
  }, [
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
    [setAttachments, processFiles, status, session, uploadFile]
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

  const handleImageClick = useCallback(
    (imageUrl: string, imageName?: string) => {
      setImageModal({
        isOpen: true,
        imageUrl,
        imageName,
      });
    },
    []
  );

  const handleImageModalClose = useCallback(() => {
    setImageModal({
      isOpen: false,
      imageUrl: "",
      imageName: undefined,
    });
  }, []);

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
    disabled: status !== "ready",
    accept: {
      "image/*": [".png", ".jpg", ".jpeg"],
      "application/pdf": [".pdf"],
    },
  });

  const showEmptyState =
    messageIds.length === 0 &&
    attachments.length === 0 &&
    uploadQueue.length === 0 &&
    !isEditMode;

  let emptyStateContent: React.ReactNode = null;
  if (showEmptyState) {
    if (emptyStateOverride) {
      emptyStateContent = emptyStateOverride;
    } else if (!disableSuggestedActions) {
      emptyStateContent = (
        <SuggestedActions
          chatId={chatId}
          className="mb-4"
          selectedModelId={selectedModelId}
        />
      );
    }
  }

  return (
    <div className="relative">
      {emptyStateContent}

      <input
        accept="image/*,.pdf"
        className="-top-4 -left-4 pointer-events-none fixed size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

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

          {isDragActive && (
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
            onImageClick={handleImageClick}
            onRemove={removeAttachment}
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
            fileInputRef={fileInputRef}
            isEmpty={isEmpty}
            onModelChange={handleModelChange}
            parentMessageId={parentMessageId}
            selectedModelId={selectedModelId}
            selectedTool={selectedTool}
            setSelectedTool={setSelectedTool}
            status={status}
            submission={submission}
            submitForm={submitForm}
            uploadQueue={uploadQueue}
          />
        </PromptInput>
      </div>

      <ImageModal
        imageName={imageModal.imageName}
        imageUrl={imageModal.imageUrl}
        isOpen={imageModal.isOpen}
        onClose={handleImageModalClose}
      />
    </div>
  );
}

function PureAttachmentsButton({
  fileInputRef,
  status,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
}) {
  const { data: session } = useSession();
  const isAnonymous = !session?.user;
  const [showLoginPopover, setShowLoginPopover] = useState(false);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isAnonymous) {
      setShowLoginPopover(true);
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <Popover onOpenChange={setShowLoginPopover} open={showLoginPopover}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <PromptInputButton
              className="@[500px]:size-10 size-8"
              data-testid="attachments-button"
              disabled={status !== "ready"}
              onClick={handleClick}
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
  isEmpty: _isEmpty,
  submitForm,
  uploadQueue: _uploadQueue,
  submission,
  parentMessageId,
}: {
  selectedModelId: AppModelId;
  onModelChange: (modelId: AppModelId) => void;
  selectedTool: UiToolName | null;
  setSelectedTool: Dispatch<SetStateAction<UiToolName | null>>;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  isEmpty: boolean;
  submitForm: () => void;
  uploadQueue: string[];
  submission: { enabled: boolean; message?: string };
  parentMessageId: string | null;
}) {
  const { stop: stopHelper } = useChatActions<ChatMessage>();
  return (
    <PromptInputFooter className="flex w-full min-w-0 flex-row items-center justify-between @[500px]:gap-2 gap-1 border-t px-1 py-1 group-has-[>input]/input-group:pb-1 [.border-t]:pt-1">
      <PromptInputTools className="flex min-w-0 items-center @[500px]:gap-2 gap-1">
        <AttachmentsButton fileInputRef={fileInputRef} status={status} />
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
              stopHelper?.();
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

const ChatInputBottomControls = memo(
  PureChatInputBottomControls,
  (prevProps, nextProps) => {
    if (prevProps.selectedModelId !== nextProps.selectedModelId) {
      return false;
    }
    if (prevProps.onModelChange !== nextProps.onModelChange) {
      return false;
    }
    if (prevProps.selectedTool !== nextProps.selectedTool) {
      return false;
    }
    if (prevProps.setSelectedTool !== nextProps.setSelectedTool) {
      return false;
    }
    if (prevProps.fileInputRef !== nextProps.fileInputRef) {
      return false;
    }
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (prevProps.isEmpty !== nextProps.isEmpty) {
      return false;
    }
    if (prevProps.submitForm !== nextProps.submitForm) {
      return false;
    }
    if (prevProps.uploadQueue.length !== nextProps.uploadQueue.length) {
      return false;
    }
    if (prevProps.submission.enabled !== nextProps.submission.enabled) {
      return false;
    }
    if (prevProps.submission.message !== nextProps.submission.message) {
      return false;
    }
    if (prevProps.parentMessageId !== nextProps.parentMessageId) {
      return false;
    }
    return true;
  }
);

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    // More specific equality checks to prevent unnecessary re-renders
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (prevProps.isEditMode !== nextProps.isEditMode) {
      return false;
    }
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.className !== nextProps.className) {
      return false;
    }

    return true;
  }
);
