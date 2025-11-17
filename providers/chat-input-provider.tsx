"use client";

import React, {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import type { LexicalChatInputRef } from "@/components/lexical-chat-input";
import type { AppModelId } from "@/lib/ai/app-models";
import { getAppModelDefinition } from "@/lib/ai/app-models";
import type { Attachment, UiToolName } from "@/lib/ai/types";
import { useDefaultModel, useModelChange } from "./default-model-provider";

type ChatInputContextType = {
  editorRef: React.RefObject<LexicalChatInputRef | null>;
  selectedTool: UiToolName | null;
  setSelectedTool: Dispatch<SetStateAction<UiToolName | null>>;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  selectedModelId: AppModelId;
  handleModelChange: (modelId: AppModelId) => Promise<void>;
  getInputValue: () => string;
  handleInputChange: (value: string) => void;
  getInitialInput: () => string;
  isEmpty: boolean;
  handleSubmit: (submitFn: () => void, isEditMode?: boolean) => void;
};

const ChatInputContext = createContext<ChatInputContextType | undefined>(
  undefined
);

type ChatInputProviderProps = {
  children: ReactNode;
  initialInput?: string;
  initialTool?: UiToolName | null;
  initialAttachments?: Attachment[];
  overrideModelId?: AppModelId; // For message editing where we want to use the original model
  localStorageEnabled?: boolean;
};

export function ChatInputProvider({
  children,
  initialInput = "",
  initialTool = null,
  initialAttachments = [],
  overrideModelId,
  localStorageEnabled = true,
}: ChatInputProviderProps) {
  // Helper functions for localStorage access without state
  const getLocalStorageInput = useCallback(() => {
    if (!localStorageEnabled) {
      return "";
    }
    try {
      return localStorage.getItem("input") || "";
    } catch {
      return "";
    }
  }, [localStorageEnabled]);

  const setLocalStorageInput = useCallback(
    (value: string) => {
      if (!localStorageEnabled) {
        return;
      }
      try {
        localStorage.setItem("input", value);
      } catch {
        // Silently fail if localStorage is not available
      }
    },
    [localStorageEnabled]
  );

  const defaultModel = useDefaultModel();
  const changeModel = useModelChange();

  // Initialize selectedModelId from override or default model
  const [selectedModelId, setSelectedModelId] = useState<AppModelId>(
    overrideModelId || defaultModel
  );

  const [selectedTool, setSelectedTool] = useState<UiToolName | null>(
    initialTool
  );
  const [attachments, setAttachments] =
    useState<Attachment[]>(initialAttachments);

  // Track if input is empty for reactive UI updates
  const [isEmpty, setIsEmpty] = useState<boolean>(() => {
    const initial = initialInput || getLocalStorageInput();
    return initial.trim().length === 0;
  });

  // Create ref for lexical editor
  const editorRef = useRef<LexicalChatInputRef | null>(null);

  // Get the initial input value from localStorage if enabled and no initial input provided
  const getInitialInput = useCallback(() => {
    if (!localStorageEnabled) {
      return initialInput;
    }
    return initialInput || getLocalStorageInput();
  }, [initialInput, getLocalStorageInput, localStorageEnabled]);

  const inputValueRef = useRef<string>(getInitialInput());

  const handleModelChange = useCallback(
    async (modelId: AppModelId) => {
      const modelDef = getAppModelDefinition(modelId);
      const hasReasoning = modelDef.reasoning === true;
      const hasUnspecifiedFeatures = !modelDef.input;

      // If switching to a model with unspecified features, disable all tools
      if (hasUnspecifiedFeatures && selectedTool !== null) {
        setSelectedTool(null);
      }
      // If switching to a reasoning model and deep research is selected, disable it
      else if (hasReasoning && selectedTool === "deepResearch") {
        setSelectedTool(null);
      }

      // Update local state immediately
      setSelectedModelId(modelId);

      // Update global default model (which handles cookie persistence)
      await changeModel(modelId);
    },
    [selectedTool, changeModel]
  );

  const clearInput = useCallback(() => {
    editorRef.current?.clear();
    inputValueRef.current = "";
    setLocalStorageInput("");
    setIsEmpty(true);
  }, [setLocalStorageInput]);

  const resetData = useCallback(() => {
    setSelectedTool(null);
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const getInputValue = useCallback(() => inputValueRef.current || "", []);

  // Save to localStorage when input changes (will be called by the lexical editor)
  const handleInputChange = useCallback(
    (value: string) => {
      inputValueRef.current = value;
      if (localStorageEnabled) {
        setLocalStorageInput(value);
      }
      // Update isEmpty state reactively
      setIsEmpty(value.trim().length === 0);
    },
    [setLocalStorageInput, localStorageEnabled]
  );

  // Unified submit handler that ensures consistent behavior for both Enter key and send button
  const handleSubmit = useCallback(
    (submitFn: () => void, isEditMode = false) => {
      // Call the actual submission function
      submitFn();

      // Clear attachments for all submissions
      clearAttachments();

      // Clear input only when not in edit mode
      if (!isEditMode) {
        clearInput();
      }

      // deepResearch stays active until the research process completes (handled via DataStreamHandler)
      if (selectedTool !== "deepResearch") {
        resetData();
      }
    },
    [clearAttachments, clearInput, selectedTool, resetData]
  );

  return (
    <ChatInputContext.Provider
      value={{
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
      }}
    >
      {children}
    </ChatInputContext.Provider>
  );
}

export function useChatInput() {
  const context = useContext(ChatInputContext);
  if (context === undefined) {
    throw new Error("useChatInput must be used within a ChatInputProvider");
  }
  return context;
}
