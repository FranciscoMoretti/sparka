import type { UIDataTypes, UIMessage, UIMessageStreamWriter } from "ai";
import z from "zod";

/**
Create a union of the given object's values, and optionally specify which keys to get the values from.

Please upvote [this issue](https://github.com/microsoft/TypeScript/issues/31438) if you want to have this type as a built-in in TypeScript.

@example
```
// data.json
{
    'foo': 1,
    'bar': 2,
    'biz': 3
}

// main.ts
import type {ValueOf} from 'type-fest';
import data = require('./data.json');

export function getData(name: string): ValueOf<typeof data> {
    return data[name];
}

export function onlyBar(name: string): ValueOf<typeof data, 'bar'> {
    return data[name];
}

// file.ts
import {getData, onlyBar} from './main';

getData('foo');
//=> 1

onlyBar('foo');
//=> TypeError ...

onlyBar('bar');
//=> 2
```
* @see https://github.com/sindresorhus/type-fest/blob/main/source/value-of.d.ts
*/
type ValueOf<
  ObjectType,
  ValueType extends keyof ObjectType = keyof ObjectType,
> = ObjectType[ValueType];

type StreamableArtifact<
  CONTENT_SCHEMA extends z.ZodTypeAny,
  DELTA_SCHEMA extends z.ZodTypeAny,
> = {
  contentSchema: CONTENT_SCHEMA;
  deltaSchema: DELTA_SCHEMA;
  reduceDelta: (
    accumulator: z.infer<CONTENT_SCHEMA>,
    delta: z.infer<DELTA_SCHEMA>
  ) => z.infer<CONTENT_SCHEMA>;
};

const TextArtifact: StreamableArtifact<z.ZodString, z.ZodString> = {
  contentSchema: z.string(),
  deltaSchema: z.string(),
  reduceDelta: (accumulator, delta) => accumulator + delta,
};

const CodeArtifact: StreamableArtifact<z.ZodString, z.ZodString> = {
  contentSchema: z.string(),
  deltaSchema: z.string(),
  reduceDelta: (accumulator, delta) => accumulator + delta,
};

const SheetArtifact: StreamableArtifact<z.ZodString, z.ZodString> = {
  contentSchema: z.string(),
  deltaSchema: z.string(),
  reduceDelta: (accumulator, delta) => accumulator + delta,
};

type UIArtifact = {
  content: unknown;
};

type ArtifactInfo = {
  id: string;
  title: string;
  messageId: string;
};

type ArtifactOutput<ARTIFACT extends UIArtifact> = ArtifactInfo & {
  content: ARTIFACT["content"];
};

const artifacts = {
  text: TextArtifact,
  code: CodeArtifact,
  sheet: SheetArtifact,
};

type ArtifactContentTypes = {
  [K in keyof typeof artifacts]: ArtifactOutput<{
    content: z.infer<(typeof artifacts)[K]["contentSchema"]>;
  }>;
};

type ArtifactDeltaTypes = {
  [K in keyof typeof artifacts as `${K}-delta`]: z.infer<
    (typeof artifacts)[K]["deltaSchema"]
  >;
};

export type ChatArtifactsUiDataTypes = ArtifactContentTypes &
  ArtifactDeltaTypes & { "data-artifact-info": ArtifactInfo };

export type ArtifactKind = keyof typeof artifacts;

type DataUIMessageChunk<DATA_TYPES extends UIDataTypes> = ValueOf<{
  [NAME in keyof DATA_TYPES & string]: {
    type: `data-${NAME}`;
    id?: string;
    data: DATA_TYPES[NAME];
    transient?: boolean;
  };
}>;

type ArtifactMessageStreamWriter<
  K extends ArtifactKind,
  UI_MESSAGE extends UIMessage = UIMessage,
> = Omit<UIMessageStreamWriter<UI_MESSAGE>, "write"> & {
  write(
    part: DataUIMessageChunk<
      Pick<ArtifactContentTypes, K> & Pick<ArtifactDeltaTypes, `${K}-delta`>
    >
  ): void;
};

const textArtifactDataStreamWriter: ArtifactMessageStreamWriter<"text"> = {
  write: (part) => {
    console.log(part);
  },
};

textArtifactDataStreamWriter.write({
  type: "data-text",
  data: {
    state: "metadata-available",
  },
});
