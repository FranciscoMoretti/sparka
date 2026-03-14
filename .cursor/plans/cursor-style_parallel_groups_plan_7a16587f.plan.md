---
name: Cursor-Style Parallel Groups Plan
overview: Revise the Cursor-style parallel response design so `parentMessageId` remains the tree edge, while nullable `parallelGroupId` becomes the required discriminator between normal retries and true multi-request response batches.
todos:
  - id: rewrite-doc
    content: Rewrite `apps/chat/docs/parallel-responses-architecture.md` around `parentMessageId` + nullable `parallelGroupId` as distinct primitives
    status: pending
  - id: extend-metadata-contract
    content: Define `parallelGroupId` as required-for-parallel, nullable-for-normal metadata across types, schema, queries, and API payloads
    status: pending
  - id: refactor-submit-flow
    content: Plan `multimodal-input` submit so one user message can create a single parallel batch id and attach it to all assistant placeholders in that fanout
    status: pending
  - id: update-server-flow
    content: Plan `/api/chat` and persistence changes so retries keep `parallelGroupId = null`, while multi-request fanout preserves a shared non-null group id
    status: pending
  - id: upgrade-thread-store
    content: Plan store/navigation changes so card UI groups assistants by `(parentMessageId, parallelGroupId)` and selection switches to a specific assistant leaf
    status: pending
  - id: verify-risks
    content: "Call out edge cases: retries vs fanout, edit-mode branching, anonymous behavior, resume/cancel, stale thread snapshots, and ordering"
    status: pending
isProject: false
---

# Cursor-Style Parallel Groups Plan

## Core correction

- `parentMessageId` alone is not enough.
- It should remain the tree edge used for context reconstruction and branch traversal.
- `parallelGroupId: string | null` must be added as a separate discriminator so the system can distinguish:
  - ordinary retry siblings
  - edit-created siblings
  - true multi-request siblings created from one submit
- Rule:
  - `parallelGroupId = null` -> normal single-response flow, including retries
  - `parallelGroupId = <uuid>` -> this assistant belongs to a specific parallel response batch

## Required model

- Keep branch semantics on `metadata.parentMessageId`.
- Add batch semantics on `metadata.parallelGroupId`.
- Card rendering should be based on assistants sharing both:
  - the same `parentMessageId`
  - the same non-null `parallelGroupId`
- This prevents old retries under the same parent from being rendered as cards in the active multi-request batch.

## Exact contract changes

- Extend `[/Users/fran/code/chat-js-2/apps/chat/lib/ai/types.ts](/Users/fran/code/chat-js-2/apps/chat/lib/ai/types.ts)` `MessageMetadata` with at least:
  - `parallelGroupId: string | null`
  - `parallelIndex: number | null`
  - `isPrimaryParallel: boolean | null`
  - optional `parallelModelId` or reuse `selectedModel`
- Keep `parentMessageId` unchanged.
- The triggering user message should also carry batch metadata describing the active fanout, so UI can know “a parallel batch was just submitted” before final assistant content exists.

## DB + persistence

- Add nullable `parallelGroupId` to `[/Users/fran/code/chat-js-2/apps/chat/lib/db/schema.ts](/Users/fran/code/chat-js-2/apps/chat/lib/db/schema.ts)` `message`.
- Also add deterministic ordering data like `parallelIndex`.
- Thread through:
  - `[/Users/fran/code/chat-js-2/apps/chat/lib/message-conversion.ts](/Users/fran/code/chat-js-2/apps/chat/lib/message-conversion.ts)`
  - `[/Users/fran/code/chat-js-2/apps/chat/lib/db/queries.ts](/Users/fran/code/chat-js-2/apps/chat/lib/db/queries.ts)` `saveMessage`
  - `saveChatMessages`
  - `updateMessage`
  - `getAllMessagesByChatId`
  - `getChatMessageWithPartsById`
- Important: `updateMessage()` currently drops extra metadata fields. The plan must explicitly fix that or `parallelGroupId` will disappear on finalize.

## Submit behavior

- In `[/Users/fran/code/chat-js-2/apps/chat/components/multimodal-input.tsx](/Users/fran/code/chat-js-2/apps/chat/components/multimodal-input.tsx)`:
  - normal submit -> user message gets `parallelGroupId = null`
  - retry -> regenerated assistant path also keeps `parallelGroupId = null`
  - multi-request submit -> generate one `parallelGroupId` for that submit and assign it to all assistant placeholders/requests in that fanout
- So one user message can have many child assistants, but only some sibling subsets are treated as one card set.

## Store and UI implications

- Current sibling logic in `[/Users/fran/code/chat-js-2/apps/chat/lib/stores/with-threads.ts](/Users/fran/code/chat-js-2/apps/chat/lib/stores/with-threads.ts)` groups only by `parentMessageId`. That is insufficient for cards.
- Add group selectors like:
  - `getParallelGroupInfo(messageId)`
  - or `getParallelSiblings(parentMessageId, parallelGroupId)`
- Add `switchToMessage(messageId)` so clicking a card selects a specific assistant leaf.
- Keep arrow-based sibling nav for legacy/retry branches where `parallelGroupId` is null.
- Only render `ParallelResponseCards` when `parallelGroupId !== null` and there are multiple assistants in that same group.

## Why this is the right split

- `parentMessageId` answers: “what conversation branch is this message on?”
- `parallelGroupId` answers: “which assistant siblings were produced by the same fanout submit?”
- Without the second field, retry and parallel responses collapse into the same bucket.
- Without the first field, you lose thread reconstruction and request-context lookup used today by `[/Users/fran/code/chat-js-2/apps/chat/app/(chat)/api/chat/get-thread-up-to-message-id.ts](</Users/fran/code/chat-js-2/apps/chat/app/(chat)`/api/chat/get-thread-up-to-message-id.ts>).

## Concrete implementation order

1. Rewrite the doc so it states `parentMessageId` and `parallelGroupId` have different jobs.
2. Add nullable `parallelGroupId` and ordering fields to types/schema/queries.
3. Update submit fanout logic so only true multi-request batches get a shared non-null group id.
4. Add store selectors and `switchToMessage(messageId)`.
5. Render cards from grouped assistants, not raw sibling count.
6. Keep retries outside the card UI by leaving them ungrouped.

## Validation cases the doc should require

- Single-model send: no cards, `parallelGroupId = null`.
- Retry assistant: still no cards, new sibling but `parallelGroupId = null`.
- Multi-request send: immediate cards, all assistants share one non-null `parallelGroupId`.
- Mixed history on one parent: retries and parallel batches do not contaminate each other’s UI grouping.
- Reload/refetch: grouped assistants still reconstruct correctly from persisted metadata.
