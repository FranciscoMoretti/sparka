type TextSplitterParams = {
  chunkSize: number;

  chunkOverlap: number;
};

abstract class TextSplitter implements TextSplitterParams {
  chunkSize = 1000;
  chunkOverlap = 200;

  constructor(fields?: Partial<TextSplitterParams>) {
    this.chunkSize = fields?.chunkSize ?? this.chunkSize;
    this.chunkOverlap = fields?.chunkOverlap ?? this.chunkOverlap;
  }

  abstract splitText(text: string): string[];

  createDocuments(texts: string[]): string[] {
    const documents: string[] = [];
    for (const text of texts) {
      if (text == null) {
        continue;
      }
      for (const chunk of this.splitText(text)) {
        documents.push(chunk);
      }
    }
    return documents;
  }

  splitDocuments(documents: string[]): string[] {
    return this.createDocuments(documents);
  }

  private joinDocs(docs: string[], separator: string): string | null {
    const text = docs.join(separator).trim();
    return text === "" ? null : text;
  }

  private handleChunkOverflow(
    d: string,
    options: {
      separator: string;
      docs: string[];
      currentDoc: string[];
      total: number;
      overlapLimit: number;
    }
  ): number {
    const {
      separator,
      docs,
      currentDoc,
      total: initialTotal,
      overlapLimit,
    } = options;
    const _len = d.length;
    if (initialTotal + _len <= this.chunkSize) {
      return initialTotal;
    }

    if (initialTotal > this.chunkSize) {
      console.warn(
        `Created a chunk of size ${initialTotal}, +
which is longer than the specified ${this.chunkSize}`
      );
    }

    let total = initialTotal;
    if (currentDoc.length > 0) {
      const doc = this.joinDocs(currentDoc, separator);
      if (doc !== null) {
        docs.push(doc);
      }
      // Keep on popping if:
      // - we have a larger chunk than in the chunk overlap
      // - or if we still have any chunks and the length is long
      while (
        total > overlapLimit ||
        (total + _len > this.chunkSize && total > 0)
      ) {
        total -= currentDoc[0]?.length ?? 0;
        currentDoc.shift();
      }
    }

    return total;
  }

  mergeSplits(splits: string[], separator: string): string[] {
    const docs: string[] = [];
    const currentDoc: string[] = [];
    let total = 0;
    // Use no overlap when splitting at character level (separator is empty string)
    const overlapLimit = separator === "" ? 0 : this.chunkOverlap;
    for (const d of splits) {
      const _len = d.length;
      total = this.handleChunkOverflow(d, {
        separator,
        docs,
        currentDoc,
        total,
        overlapLimit,
      });
      currentDoc.push(d);
      total += _len;
    }
    const doc = this.joinDocs(currentDoc, separator);
    if (doc !== null) {
      docs.push(doc);
    }
    return docs;
  }
}

export interface RecursiveCharacterTextSplitterParams
  extends TextSplitterParams {
  separators: string[];
}

export class RecursiveCharacterTextSplitter
  extends TextSplitter
  implements RecursiveCharacterTextSplitterParams
{
  separators: string[] = ["\n\n", "\n", ".", ",", ">", "<", " ", ""];

  constructor(fields?: Partial<RecursiveCharacterTextSplitterParams>) {
    super(fields);
    this.separators = fields?.separators ?? this.separators;
  }

  private findSeparator(text: string): string {
    let separator: string = this.separators.at(-1) ?? "";
    for (const s of this.separators) {
      if (s === "") {
        separator = s;
        break;
      }
      if (text.includes(s)) {
        separator = s;
        break;
      }
    }
    return separator;
  }

  private handleSpaceCase(splits: string[], text: string): string[] | null {
    if (splits[0] === undefined || splits[0].trim() === "") {
      return null;
    }

    const trimmed = text.trim();
    if (trimmed.length > this.chunkSize) {
      return null;
    }

    const parts = splits.map((s) => s.trim()).filter((s) => s !== "");
    const combined: string[] = [];
    for (let i = 0; i < parts.length; i += 1) {
      const current = parts[i] ?? "";
      const next = parts[i + 1] ?? "";
      if (
        current.includes("(") &&
        !current.includes(")") &&
        next.includes(")")
      ) {
        combined.push(`${current} ${next}`);
        i += 1; // skip next since it's merged
      } else {
        combined.push(current);
      }
    }
    return combined;
  }

  private mergeAndProcessSplits(
    splits: string[],
    separator: string,
    finalChunks: string[]
  ): void {
    let goodSplits: string[] = [];
    for (const s of splits) {
      if (s.length < this.chunkSize) {
        goodSplits.push(s);
      } else {
        if (goodSplits.length) {
          const mergedText = this.mergeSplits(goodSplits, separator);
          finalChunks.push(...mergedText);
          goodSplits = [];
        }
        const otherInfo = this.splitText(s);
        finalChunks.push(...otherInfo);
      }
    }
    if (goodSplits.length) {
      const mergedText = this.mergeSplits(goodSplits, separator);
      finalChunks.push(...mergedText);
    }
  }

  splitText(text: string): string[] {
    if (this.chunkOverlap >= this.chunkSize) {
      throw new Error("Cannot have chunkOverlap >= chunkSize");
    }
    const finalChunks: string[] = [];

    // Get appropriate separator to use
    const separator = this.findSeparator(text);

    // Now that we have the separator, split the text
    const splits: string[] = separator ? text.split(separator) : text.split("");

    // If we're splitting on spaces and the entire text fits within one chunk,
    // return minimally merged tokens while keeping parenthesized phrases intact.
    if (separator === " ") {
      const spaceCaseResult = this.handleSpaceCase(splits, text);
      if (spaceCaseResult !== null) {
        return spaceCaseResult;
      }
    }

    // Now go merging things, recursively splitting longer texts.
    this.mergeAndProcessSplits(splits, separator, finalChunks);
    return finalChunks;
  }
}
