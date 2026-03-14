"use client";

import { tool } from "ai";
import { z } from "zod";

export const wordCount = tool({
	description: "Count the words, characters, and sentences in a given text",
	inputSchema: z.object({
		text: z.string().describe("The text to analyze"),
	}),
	execute: async ({ text }: { text: string }) => {
		const words = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
		const characters = text.length;
		const charactersNoSpaces = text.replace(/\s/g, "").length;
		const sentences = text
			.split(/[.!?]+/)
			.filter((s) => s.trim().length > 0).length;

		return { words, characters, charactersNoSpaces, sentences };
	},
});

export type WordCountOutput = {
	words: number;
	characters: number;
	charactersNoSpaces: number;
	sentences: number;
};

// Typed locally to avoid circular imports (tools/ ← lib/ai/types ← installed-tools ← tools/)
type WordCountPart =
	| { state: "input-available" | "input-streaming"; output?: never }
	| { state: "output-available"; output: WordCountOutput };

export function WordCountRenderer({ tool }: { tool: unknown }) {
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
