// Generic message type that works for both DB and anonymous messages
export interface MessageNode {
  id: string;
  metadata?: {
    parentMessageId: string | null;
    parallelGroupId?: string | null;
    parallelIndex?: number | null;
    activeStreamId?: string | null;
    createdAt: Date;
  };
}

/** Safely extract a numeric timestamp from a Date object or ISO string. */
function toTimestamp(value: Date | string | undefined | null): number {
  if (!value) {
    return 0;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  return new Date(value).getTime();
}

// Get the default leaf (most recent message by timestamp)
function getDefaultLeafMessage<T extends MessageNode>(
  allMessages: T[]
): T | null {
  if (allMessages.length === 0) {
    return null;
  }

  // Sort by createdAt descending and return the first one
  const sorted = [...allMessages].sort(
    (a, b) =>
      toTimestamp(b.metadata?.createdAt) - toTimestamp(a.metadata?.createdAt)
  );

  return sorted[0];
}

// Build thread from leaf message using all messages
export function buildThreadFromLeaf<T extends MessageNode>(
  allMessages: T[],
  leafMessageId: string
): T[] {
  const messageMap = new Map<string, T>();
  for (const msg of allMessages) {
    messageMap.set(msg.id, msg);
  }

  const thread: T[] = [];
  let currentMessageId: string | null = leafMessageId;
  let iteration = 0;

  while (currentMessageId) {
    iteration += 1;

    if (iteration > 100) {
      break;
    }

    const currentMessage = messageMap.get(currentMessageId);
    if (!currentMessage) {
      break;
    }

    thread.unshift(currentMessage);

    // Check for self-reference
    if (currentMessage.metadata?.parentMessageId === currentMessage.id) {
      console.error(
        "[buildThreadFromLeaf] SELF-REFERENCE DETECTED for message:",
        currentMessage.id
      );
      break;
    }

    currentMessageId = currentMessage.metadata?.parentMessageId || null;
  }

  return thread;
}

// Get default thread (combination of the above two)
export function getDefaultThread<T extends MessageNode>(allMessages: T[]): T[] {
  const defaultLeaf = getDefaultLeafMessage(allMessages);
  if (!defaultLeaf) {
    return [];
  }

  return buildThreadFromLeaf(allMessages, defaultLeaf.id);
}

// Build parent->children mapping sorted by createdAt
export function buildChildrenMap<T extends MessageNode>(
  allMessages: T[]
): Map<string | null, T[]> {
  const map = new Map<string | null, T[]>();
  for (const message of allMessages) {
    const parentId = message.metadata?.parentMessageId || null;
    if (!map.has(parentId)) {
      map.set(parentId, []);
    }
    map.get(parentId)?.push(message);
  }
  for (const siblings of map.values()) {
    siblings.sort(
      (a, b) => {
        const aParallelIndex = a.metadata?.parallelIndex;
        const bParallelIndex = b.metadata?.parallelIndex;
        const sameParallelGroup =
          a.metadata?.parallelGroupId &&
          a.metadata?.parallelGroupId === b.metadata?.parallelGroupId;

        if (
          sameParallelGroup &&
          typeof aParallelIndex === "number" &&
          typeof bParallelIndex === "number" &&
          aParallelIndex !== bParallelIndex
        ) {
          return aParallelIndex - bParallelIndex;
        }

        return (
          toTimestamp(a.metadata?.createdAt) - toTimestamp(b.metadata?.createdAt)
        );
      }
    );
  }
  return map;
}

export function findLeafDfsToRightFromMessageId<T extends MessageNode>(
  childrenMapSorted: Map<string | null, T[]>,
  messageId: string
): T | null {
  const children = childrenMapSorted.get(messageId);
  if (!children || children.length === 0) {
    return null;
  }

  const rightmostChild = children.at(-1);

  if (!rightmostChild) {
    return null;
  }

  const leaf = findLeafDfsToRightFromMessageId(
    childrenMapSorted,
    rightmostChild.id
  );
  return leaf || rightmostChild;
}
