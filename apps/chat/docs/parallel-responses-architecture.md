# Parallel Responses Architecture

## Goal

Allow one user submit to fan out into multiple assistant responses and show them as Cursor-style cards, without breaking the existing parent-pointer thread model.

## Core model

There are three separate concepts now:

- `parentMessageId`
  - The thread edge.
  - Used to rebuild context and visible branches.
- `parallelGroupId: string | null`
  - The response-batch discriminator.
  - `null` means normal single-response / retry flow.
  - Non-null means this assistant belongs to one parallel fanout batch.
- `selectedModel: AppModelId | Record<AppModelId, number>`
  - The submit intent.
  - String means normal single-model send.
  - Record means multi-request fanout, where each value is the number of requests for that model.

This split matters:

- `parentMessageId` alone cannot distinguish retry siblings from true parallel siblings.
- `parallelGroupId` is what prevents retries and fanout responses from being rendered as the same card set.
- `selectedModel` on the user message preserves what the submit path was asked to do.

## Metadata contract

`MessageMetadata` now carries:

- `createdAt`
- `parentMessageId`
- `parallelGroupId`
- `parallelIndex`
- `isPrimaryParallel`
- `selectedModel`
- `activeStreamId`
- `selectedTool`
- `usage`

Rules:

- User messages store the submit intent.
  - Single send: `selectedModel = modelId`, `parallelGroupId = null`
  - Parallel send: `selectedModel = { [modelId]: count }`, `parallelGroupId = <uuid>`
- Assistant messages store concrete execution metadata.
  - `selectedModel` is always the scalar model for that assistant branch.
  - `parallelGroupId` matches the batch on all assistants created from the same fanout submit.
  - `parallelIndex` is the stable card order.

## Persistence model

The `Message` table persists:

- `parentMessageId`
- `selectedModel` as JSON
- `parallelGroupId`
- `parallelIndex`
- `isPrimaryParallel`
- `activeStreamId`

Important implementation detail:

- `updateMessage()` must update the parallel fields and `selectedModel`.
- If finalize only updates parts and `activeStreamId`, `parallelGroupId` gets lost on the final assistant row.

## Submit flow

The submit entrypoint is still `multimodal-input.tsx`.

Single-model submit:

1. Build one user message with scalar `selectedModel`
2. Add the user message optimistically
3. Send one `/api/chat` request through `useChat`

Parallel submit:

1. Build one user message with record-form `selectedModel`
2. Generate one shared `parallelGroupId`
3. Expand the record into concrete request specs
4. Create one assistant placeholder per request spec
5. Insert all placeholders into `allMessages` immediately
6. Send the primary request through `useChat`
7. Run `POST /api/chat/prepare`
8. Fire secondary `/api/chat` requests manually and drain their response bodies
9. Invalidate persisted chat messages after the secondary requests settle

Why the user message matters:

- Cards are rendered from the user message plus `allMessages`.
- The UI does not have to wait for assistant text before showing the batch.

## Request contracts

### `POST /api/chat`

Body:

```ts
{
  id: string;
  message: ChatMessage;
  prevMessages: ChatMessage[];
  projectId?: string;
  assistantMessageId?: string;
  selectedModelId?: AppModelId;
  parallelGroupId?: string | null;
  parallelIndex?: number | null;
  isPrimaryParallel?: boolean | null;
}
```

Server resolution:

- If `message.metadata.selectedModel` is a string:
  - Use it directly unless `selectedModelId` explicitly overrides it.
- If it is a record:
  - Require a concrete `selectedModelId` that exists in that record.
  - Persist the user message with the record.
  - Persist the assistant branch with the scalar `selectedModelId`.

### `POST /api/chat/prepare`

Used only before secondary fanout requests.

Responsibilities:

- Require auth
- Validate chat ownership
- Create the chat if needed
- Persist the user message idempotently

## Server flow

`route.ts` now does this:

1. Resolve the concrete model for this request from `selectedModel`
2. Validate session / model access
3. Persist the user message idempotently
4. Save an assistant placeholder using the client-generated `assistantMessageId` when provided
5. Stream the response
6. Finalize the assistant row while explicitly preserving:
   - `selectedModel`
   - `parallelGroupId`
   - `parallelIndex`
   - `isPrimaryParallel`

This is why client-generated assistant IDs are required:

- The placeholder inserted in `allMessages`
- The streamed assistant from `useChat`
- The DB row

all refer to the same logical assistant branch.

## Thread handling

The thread store still uses a parent-pointer tree.

What changed:

- `allMessages` is still the full source of truth
- sibling navigation still exists for legacy non-parallel branches
- grouped navigation is now message-targeted

New store behavior:

- `getParallelGroupInfo(messageId)`
  - Finds grouped assistants by `(parentMessageId, parallelGroupId)`
- `switchToMessage(messageId)`
  - Rebuilds the visible thread from a specific assistant branch
- `setAllMessages(messages)`
  - Reconciles the currently visible thread against refetched server state instead of only replacing `allMessages`

This lets the UI switch directly to a chosen assistant card instead of only doing previous/next sibling traversal.

## Card UI

Cards are rendered from the user message, not from sibling count alone.

Render rule:

- show cards only when the message has a non-null `parallelGroupId`
- group assistants by:
  - parent = the user message id
  - same `parallelGroupId`

Each card shows:

- resolved model label
- streaming spinner when `activeStreamId !== null`
- one of:
  - `Selected`
  - `Generating...`
  - `Task completed`

Click behavior:

- `ParallelResponseCards` -> `useNavigateToMessage()` -> `switchToMessage(messageId)`

Legacy retry arrows stay for non-parallel siblings where `parallelGroupId === null`.

## Retry behavior

Retry is intentionally not treated as parallel fanout.

When retrying an assistant:

- derive the retry model from the assistant being retried
- resend the parent user message with:
  - scalar `selectedModel`
  - `parallelGroupId = null`
  - `parallelIndex = null`
  - `isPrimaryParallel = null`

That keeps retries in the legacy sibling path and out of the grouped-card path.

## Edit-mode branching

Edit mode still branches from the edited message's parent.

Flow:

1. Trim the visible thread back to the edited parent
2. Create a new user message whose `parentMessageId` points to that parent
3. Run normal single or parallel submit logic from that point

That means parallel fanout from edit mode creates a new grouped assistant batch on the new branch, not on the previous branch's assistants.

## Migration / compatibility

- Existing rows with scalar `selectedModel` remain valid after the column moves to JSON.
- The migration casts the existing `varchar` value into JSON and adds nullable parallel columns.
- Old messages keep:
  - scalar `selectedModel`
  - `parallelGroupId = null`
  - `parallelIndex = null`
  - `isPrimaryParallel = null`
- No data backfill is required to make old threads readable.

## Known constraints

- Multi-model fanout is authenticated-only.
- Multi-model fanout with attachments is currently blocked.
  - A single attachment payload across mixed model capabilities is not safe yet.
- Anonymous chats still use client-provided `prevMessages` for context.
- `threadInitialMessages` is still a remount snapshot workaround in `ChatSync`.
  - The store now reconciles visible thread data on refetch, but the snapshot mechanism still exists.
- `buildThreadFromLeaf()` still has the existing 100-hop guard.

## Validation checklist

- Single send:
  - no cards
  - scalar `selectedModel`
  - `parallelGroupId = null`
- Retry:
  - no cards
  - scalar `selectedModel`
  - `parallelGroupId = null`
- Parallel send:
  - user message stores record-form `selectedModel`
  - all assistant placeholders share one non-null `parallelGroupId`
  - cards appear immediately
- Persist / reload:
  - user message keeps submit intent
  - assistants keep concrete scalar model ids
  - card grouping survives refetch
