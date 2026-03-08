"use client";

import {
	isDataUIPart,
	isReasoningUIPart,
	isStaticToolUIPart,
	isTextUIPart,
	isToolUIPart,
} from "ai";
import { memo } from "react";
import {
	useMessagePartByPartIdx,
	useMessagePartTypesById,
} from "@/lib/stores/hooks-message-parts";
import { DynamicToolPart } from "./part/dynamic-tool";
import { ReasoningPart } from "./part/message-reasoning";
import { TextMessagePart } from "./part/text-message-part";
import { ToolPart } from "./part/tool-part";

interface MessagePartsProps {
	isLoading: boolean;
	isReadonly: boolean;
	messageId: string;
}

// Render a single part by index with minimal subscriptions
function PureMessagePart({
	messageId,
	partIdx,
	isReadonly,
	isLoading,
}: {
	messageId: string;
	partIdx: number;
	isReadonly: boolean;
	isLoading: boolean;
}) {
	const part = useMessagePartByPartIdx(messageId, partIdx);

	if (isTextUIPart(part)) {
		return <TextMessagePart isLoading={isLoading} text={part.text} />;
	}

	if (isReasoningUIPart(part)) {
		return <ReasoningPart content={part.text} isLoading={isLoading} />;
	}

	if (isDataUIPart(part)) {
		return null;
	}

	if (isToolUIPart(part)) {
		if (isStaticToolUIPart(part)) {
			return (
				<ToolPart isReadonly={isReadonly} messageId={messageId} part={part} />
			);
		}
		return (
			<DynamicToolPart
				isReadonly={isReadonly}
				messageId={messageId}
				part={part}
			/>
		);
	}

	return null;
}

const MessagePart = memo(PureMessagePart);

function PureMessageParts({
	messageId,
	isLoading,
	isReadonly,
}: MessagePartsProps) {
	const types = useMessagePartTypesById(messageId);

	return types.map((t, i) => {
		return (
			<MessagePart
				isLoading={isLoading && i === types.length - 1}
				isReadonly={isReadonly}
				// biome-ignore lint/suspicious/noArrayIndexKey: we only have index at this point
				key={`message-${messageId}-${t}-${i}`}
				messageId={messageId}
				partIdx={i}
			/>
		);
	});
}

export const MessageParts = memo(PureMessageParts);
