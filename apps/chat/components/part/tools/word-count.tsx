"use client";

import type { ToolUIPart } from "ai";
import type { PluginToolRendererProps } from "@/lib/ai/tool-renderer-registry";
import type { ChatTools } from "@/lib/ai/types";

type WordCountPart = Extract<ToolUIPart<ChatTools>, { type: "tool-wordCount" }>;

export function WordCountRenderer({ tool }: PluginToolRendererProps) {
	const part = tool as WordCountPart;

	if (part.state === "input-available") {
		return (
			<div className="text-muted-foreground rounded-lg border p-3 text-sm">
				Counting words...
			</div>
		);
	}

	if (part.state !== "output-available") {
		return null;
	}

	const { words, characters, charactersNoSpaces, sentences } = part.output;

	return (
		<div className="grid grid-cols-2 gap-2 rounded-lg border p-3 text-sm sm:grid-cols-4">
			<Stat label="Words" value={words} />
			<Stat label="Characters" value={characters} />
			<Stat label="No spaces" value={charactersNoSpaces} />
			<Stat label="Sentences" value={sentences} />
		</div>
	);
}

function Stat({ label, value }: { label: string; value: number }) {
	return (
		<div className="flex flex-col items-center gap-1">
			<span className="font-semibold text-lg">{value}</span>
			<span className="text-muted-foreground text-xs">{label}</span>
		</div>
	);
}
