'use client';

import cx from 'classnames';
import { AnimatePresence, motion } from 'motion/react';
import { memo, useState } from 'react';
import type { Vote } from '@/lib/db/schema';
import { DocumentToolCall, DocumentToolResult } from './document';
import { Markdown } from './markdown';
import { MessageActions } from './message-actions';
import { Weather } from './weather';
import equal from 'fast-deep-equal';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { MessageEditor } from './message-editor';
import { DocumentPreview } from './document-preview';
import { MessageReasoning } from './message-reasoning';
import type { UseChatHelpers } from '@ai-sdk/react';
import { Retrieve } from './retrieve';

import type { YourToolInvocation } from '@/lib/ai/tools/tools';
import { StockChartMessage } from './stock-chart-message';
import { CodeInterpreterMessage } from './code-interpreter-message';
import type { YourUIMessage } from '@/lib/types/ui';
import {
  SourcesAnnotations,
  ResearchUpdateAnnotations,
} from './message-annotations';
import { ReadDocument } from './read-document';
import { AttachmentList } from './attachment-list';
import { Skeleton } from './ui/skeleton';
import { ImageModal } from './image-modal';

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  isReadonly,
  chatHelpers,
  lastArtifact,
  parentMessageId,
}: {
  chatId: string;
  message: YourUIMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  isReadonly: boolean;
  chatHelpers: UseChatHelpers;
  lastArtifact: { messageIndex: number; toolCallId: string } | null;
  parentMessageId: string | null;
}) => {
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [imageModal, setImageModal] = useState<{
    isOpen: boolean;
    imageUrl: string;
    imageName?: string;
  }>({
    isOpen: false,
    imageUrl: '',
    imageName: undefined,
  });

  // Helper function to check if this is the last artifact
  const isLastArtifact = (currentToolCallId: string) => {
    if (!lastArtifact) return false;

    const { messages } = chatHelpers;
    const currentMessageIndex = messages.findIndex(
      (msg) => msg.id === message.id,
    );

    return (
      lastArtifact.messageIndex === currentMessageIndex &&
      lastArtifact.toolCallId === currentToolCallId
    );
  };

  const handleImageClick = (imageUrl: string, imageName?: string) => {
    setImageModal({
      isOpen: true,
      imageUrl,
      imageName,
    });
  };

  const handleImageModalClose = () => {
    setImageModal({
      isOpen: false,
      imageUrl: '',
      imageName: undefined,
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        data-testid={`message-${message.role}`}
        className="w-full mx-auto max-w-3xl px-4 group/message"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role={message.role}
      >
        <div
          className={cn(
            'w-full',
            mode === 'edit'
              ? 'max-w-full'
              : 'group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:w-fit',
          )}
        >
          {/* Content Column */}
          <div
            className={cn(
              'flex flex-col gap-4 w-full',
              message.role === 'user' && mode !== 'edit' && 'items-end',
            )}
          >
            {' '}
            {message.isPartial && message.parts.length === 0 && (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-4/5 rounded-full" />
                <Skeleton className="h-4 w-3/5 rounded-full" />
                <Skeleton className="h-4 w-2/5 rounded-full" />
              </div>
            )}
            {message.annotations && (
              <ResearchUpdateAnnotations
                annotations={message.annotations}
                key={`research-update-annotations-${message.id}`}
              />
            )}
            {message.parts?.map((part, index) => {
              const { type } = part;
              const key = `message-${message.id}-part-${index}`;

              if (type === 'reasoning') {
                return (
                  <MessageReasoning
                    key={key}
                    isLoading={isLoading}
                    reasoning={part.reasoning}
                  />
                );
              }

              if (type === 'text') {
                if (mode === 'view') {
                  return (
                    <div key={key} className="">
                      {message.role === 'user' && !isReadonly ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              data-testid="message-content"
                              className={cn(
                                'cursor-pointer hover:opacity-80 transition-opacity',
                              )}
                              onClick={() => {
                                setMode('edit');
                              }}
                            >
                              <div
                                data-testid="message-content"
                                className={cn('flex flex-col gap-4 w-full', {
                                  'bg-muted px-3 py-2 rounded-2xl border dark:border-zinc-700 text-left':
                                    message.role === 'user',
                                })}
                              >
                                <AttachmentList
                                  attachments={
                                    message.experimental_attachments || []
                                  }
                                  onImageClick={handleImageClick}
                                  testId="message-attachments"
                                />
                                {/* User message renndering withotu Markdown */}

                                <pre className="whitespace-pre-wrap font-sans">
                                  {part.text}
                                </pre>
                              </div>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Click to edit message</TooltipContent>
                        </Tooltip>
                      ) : (
                        <div
                          data-testid="message-content"
                          className={cn('flex flex-col gap-4 w-full', {
                            'bg-muted px-3 py-2 rounded-2xl border dark:border-zinc-700 text-left':
                              message.role === 'user',
                          })}
                        >
                          <AttachmentList
                            attachments={message.experimental_attachments || []}
                            onImageClick={handleImageClick}
                            testId="message-attachments"
                          />
                          {message.role === 'assistant' ? (
                            <Markdown>{part.text}</Markdown>
                          ) : (
                            <pre className="whitespace-pre-wrap font-sans ">
                              {part.text}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }

                if (mode === 'edit') {
                  return (
                    <div key={key} className="flex flex-row gap-2 items-start">
                      <MessageEditor
                        key={message.id}
                        chatId={chatId}
                        message={message}
                        setMode={setMode}
                        chatHelpers={chatHelpers}
                        parentMessageId={parentMessageId}
                      />
                    </div>
                  );
                }
              }

              if (type === 'tool-invocation') {
                const { toolInvocation: toolInvocationRaw } = part;
                const toolInvocation = toolInvocationRaw as YourToolInvocation;

                if (
                  toolInvocation.state === 'call' ||
                  toolInvocation.state === 'partial-call'
                ) {
                  const { toolName, toolCallId, args } = toolInvocation;
                  return (
                    <div
                      key={toolCallId}
                      className={cx({
                        skeleton: ['getWeather'].includes(toolName),
                      })}
                    >
                      {toolName === 'getWeather' ? (
                        <Weather />
                      ) : toolName === 'createDocument' ? (
                        <DocumentPreview
                          isReadonly={isReadonly}
                          args={args}
                          messageId={message.id}
                        />
                      ) : toolName === 'updateDocument' ? (
                        <DocumentToolCall
                          type="update"
                          // @ts-expect-error // TODO: fix this
                          args={args}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolCall
                          type="request-suggestions"
                          // @ts-expect-error // TODO: fix this
                          args={args}
                          isReadonly={isReadonly}
                        />
                      ) : toolName === 'retrieve' ? (
                        <Retrieve />
                      ) : toolName === 'stockChart' ? (
                        <StockChartMessage result={null} args={args} />
                      ) : toolName === 'codeInterpreter' ? (
                        <CodeInterpreterMessage result={null} args={args} />
                      ) : toolName !== 'deepResearch' &&
                        // toolName !== 'reasonSearch' &&
                        toolName !== 'webSearch' ? (
                        <pre>{JSON.stringify(toolInvocation, null, 2)}</pre>
                      ) : null}
                    </div>
                  );
                }

                if (toolInvocation.state === 'result') {
                  const { toolName, toolCallId, args, result } = toolInvocation;
                  const shouldShowFullPreview = isLastArtifact(toolCallId);

                  return (
                    <div key={toolCallId}>
                      {toolName === 'getWeather' ? (
                        <Weather weatherAtLocation={result} />
                      ) : (toolName === 'createDocument' ||
                          toolName === 'deepResearch') &&
                        shouldShowFullPreview ? (
                        <DocumentPreview
                          isReadonly={isReadonly}
                          result={result}
                          args={args}
                          messageId={message.id}
                          type="create"
                        />
                      ) : toolName === 'createDocument' ||
                        toolName === 'deepResearch' ? (
                        <DocumentToolResult
                          type="create"
                          // @ts-expect-error // TODO: fix this
                          result={result}
                          isReadonly={isReadonly}
                          messageId={message.id}
                        />
                      ) : toolName === 'updateDocument' &&
                        shouldShowFullPreview ? (
                        <DocumentPreview
                          isReadonly={isReadonly}
                          result={result}
                          args={args}
                          messageId={message.id}
                          type="update"
                        />
                      ) : toolName === 'updateDocument' &&
                        !shouldShowFullPreview ? (
                        <DocumentToolResult
                          type="update"
                          // @ts-expect-error // TODO: fix this
                          result={result}
                          isReadonly={isReadonly}
                          messageId={message.id}
                        />
                      ) : toolName === 'requestSuggestions' ? (
                        <DocumentToolResult
                          type="request-suggestions"
                          // @ts-expect-error // TODO: fix this
                          result={result}
                          isReadonly={isReadonly}
                          messageId={message.id}
                        />
                      ) : toolName === 'retrieve' ? (
                        // @ts-expect-error // TODO: fix this
                        <Retrieve result={result} />
                      ) : toolName === 'readDocument' ? (
                        // @ts-expect-error // TODO: fix this
                        <ReadDocument result={result} />
                      ) : toolName === 'stockChart' ? (
                        // @ts-expect-error // TODO: fix this
                        <StockChartMessage result={result} args={args} />
                      ) : toolName === 'codeInterpreter' ? (
                        // @ts-expect-error // TODO: fix this
                        <CodeInterpreterMessage result={result} args={args} />
                      ) : // toolName !== 'reasonSearch' &&
                      // toolName !== 'deepResearch' &&
                      toolName !== 'webSearch' ? (
                        <pre>{JSON.stringify(result, null, 2)}</pre>
                      ) : null}
                    </div>
                  );
                }
              }
            })}
            {message.annotations && (
              <SourcesAnnotations
                annotations={message.annotations}
                key={`sources-annotations-${message.id}`}
              />
            )}
            <MessageActions
              key={`action-${message.id}`}
              chatId={chatId}
              message={message}
              vote={vote}
              isLoading={isLoading}
              isReadOnly={isReadonly}
              chatHelpers={chatHelpers}
              parentMessageId={parentMessageId}
            />
          </div>
        </div>
      </motion.div>

      <ImageModal
        isOpen={imageModal.isOpen}
        onClose={handleImageModalClose}
        imageUrl={imageModal.imageUrl}
        imageName={imageModal.imageName}
      />
    </AnimatePresence>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) return false;
    if (prevProps.message.id !== nextProps.message.id) return false;
    if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;
    if (prevProps.chatHelpers !== nextProps.chatHelpers) return false;
    if (!equal(prevProps.message.annotations, nextProps.message.annotations))
      return false;
    if (!equal(prevProps.vote, nextProps.vote)) return false;
    if (!equal(prevProps.lastArtifact, nextProps.lastArtifact)) return false;
    if (prevProps.parentMessageId !== nextProps.parentMessageId) return false;

    return true;
  },
);
