import type { UIDataTypes, UIMessage, UIMessageStreamWriter } from "ai";
import type z from "zod";
import type { ArtifactKind } from "./artifact-kind";
import type { artifacts } from "./schemas";

/**
Create a union of the given object's values, and optionally specify which keys to get the values from.
* @see https://github.com/sindresorhus/type-fest/blob/main/source/value-of.d.ts
*/
type ValueOf<
  ObjectType,
  ValueType extends keyof ObjectType = keyof ObjectType,
> = ObjectType[ValueType];

type UIArtifact = {
  content: unknown;
};

export type ArtifactInfo = {
  id: string;
  title: string;
  messageId: string;
  kind: ArtifactKind;
};

type ArtifactOutput<ARTIFACT extends UIArtifact> = Omit<
  ArtifactInfo,
  "kind"
> & {
  content: ARTIFACT["content"];
};

type ArtifactContentTypes = {
  [K in keyof typeof artifacts]: ArtifactOutput<{
    content: z.infer<(typeof artifacts)[K]["contentSchema"]>;
  }>;
};

type ArtifactDeltaTypes = {
  [K in keyof typeof artifacts as `${K}Delta`]: z.infer<
    (typeof artifacts)[K]["deltaSchema"]
  >;
};

export type CommonArtifactsUiDataTypes = {
  artifactInfo: ArtifactInfo;
  clear: null;
  finish: null;
};

export type ChatArtifactsUiDataTypes = ArtifactContentTypes &
  ArtifactDeltaTypes &
  CommonArtifactsUiDataTypes;

type DataUIMessageChunk<DATA_TYPES extends UIDataTypes> = ValueOf<{
  [NAME in keyof DATA_TYPES & string]: {
    type: `data-${NAME}`;
    id?: string;
    data: DATA_TYPES[NAME];
    transient?: boolean;
  };
}>;

export type ArtifactMessageStreamWriter<
  K extends ArtifactKind,
  UI_MESSAGE extends UIMessage = UIMessage,
> = Omit<UIMessageStreamWriter<UI_MESSAGE>, "write"> & {
  write(
    part:
      | DataUIMessageChunk<CommonArtifactsUiDataTypes>
      | DataUIMessageChunk<Pick<ArtifactContentTypes, K>>
      | DataUIMessageChunk<Pick<ArtifactDeltaTypes, `${K}Delta`>>
  ): void;
};
