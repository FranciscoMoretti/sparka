"use client";
import { useChatId, useMessageById } from "@ai-sdk-tools/store";
import { memo, useState } from "react";
import { Message, MessageContent } from "@/components/ai-elements/message";
import type { ChatMessage } from "@/lib/ai/types";
import { cn, getAttachmentsFromMessage } from "@/lib/utils";
import { AttachmentList } from "./attachment-list";
import { ImageModal } from "./image-modal";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { ParallelResponseCards } from "./parallel-response-cards";

export interface BaseMessageProps {
	isLoading: boolean;
	isReadonly: boolean;
	messageId: string;
	parentMessageId: string | null;
}

const PureUserMessage = ({
	messageId,
	isLoading,
	isReadonly,
	parentMessageId,
}: BaseMessageProps) => {
	const chatId = useChatId();
	const message = useMessageById<ChatMessage>(messageId);
	const [mode, setMode] = useState<"view" | "edit">("view");
	const [imageModal, setImageModal] = useState<{
		isOpen: boolean;
		imageUrl: string;
		imageName?: string;
	}>({ isOpen: false, imageUrl: "" });

	const handleImageClick = (imageUrl: string, imageName?: string) => {
		setImageModal({ isOpen: true, imageUrl, imageName });
	};

	if (!message) {
		return null;
	}
	const textPart = message.parts.find((part) => part.type === "text");
	if (!(textPart && chatId)) {
		return null;
	}

	return (
		<>
			<Message
				className={cn(
					// TODO: Consider not using this max-w class override when editing is cohesive with displaying the message
					mode === "edit" ? "max-w-full [&>div]:max-w-full" : undefined,
					"py-1",
				)}
				from="user"
			>
				<div
					className={cn(
						"flex w-full flex-col gap-2",
						message.role === "user" && mode !== "edit" && "items-end",
					)}
				>
					{mode === "view" && <ParallelResponseCards messageId={message.id} />}

					{mode === "view" && isReadonly && (
						<MessageContent
							className="text-left group-[.is-user]:bg-card"
							data-testid="message-content"
						>
							<AttachmentList
								attachments={getAttachmentsFromMessage(message)}
								onImageClick={handleImageClick}
								testId="message-attachments"
							/>
							<pre className="whitespace-pre-wrap font-sans">
								{textPart.text}
							</pre>
						</MessageContent>
					)}
					{mode === "view" && !isReadonly && (
						<button
							className="block cursor-pointer select-text text-left transition-opacity hover:opacity-80"
							data-testid="message-content"
							onClick={(e) => {
								const selection = window.getSelection();
								if (
									selection?.toString() &&
									e.currentTarget.contains(selection.anchorNode)
								)
									return;
								setMode("edit");
							}}
							type="button"
						>
							<MessageContent
								className="text-left group-[.is-user]:max-w-none group-[.is-user]:bg-card"
								data-testid="message-content"
							>
								<AttachmentList
									attachments={getAttachmentsFromMessage(message)}
									onImageClick={handleImageClick}
									testId="message-attachments"
								/>
								<pre className="whitespace-pre-wrap font-sans">
									{textPart.text}
								</pre>
							</MessageContent>
						</button>
					)}
					{mode !== "view" && (
						<div className="flex flex-row items-start gap-2">
							<MessageEditor
								chatId={chatId}
								key={message.id}
								message={message}
								parentMessageId={parentMessageId}
								setMode={setMode}
							/>
						</div>
					)}

					<div className="self-end">
						<MessageActions
							chatId={chatId}
							isEditing={mode === "edit"}
							isLoading={isLoading}
							isReadOnly={isReadonly}
							key={`action-${message.id}`}
							messageId={message.id}
							onCancelEdit={() => setMode("view")}
							onStartEdit={() => setMode("edit")}
						/>
					</div>
				</div>
			</Message>
			<ImageModal
				imageName={imageModal.imageName}
				imageUrl={imageModal.imageUrl}
				isOpen={imageModal.isOpen}
				onClose={() => setImageModal({ isOpen: false, imageUrl: "" })}
			/>
		</>
	);
};

export const UserMessage = memo(PureUserMessage, (prevProps, nextProps) => {
	if (prevProps.messageId !== nextProps.messageId) {
		return false;
	}
	if (prevProps.isReadonly !== nextProps.isReadonly) {
		return false;
	}
	if (prevProps.parentMessageId !== nextProps.parentMessageId) {
		return false;
	}
	if (prevProps.isLoading !== nextProps.isLoading) {
		return false;
	}
	return true;
});
