let messageCounter = 0;

const DEFAULT_STATUS = "completed";

export function createMessageId(prefix = "msg") {
  messageCounter += 1;
  return `${prefix}_${Date.now()}_${messageCounter.toString(36)}`;
}

export function extractTextContent(content) {
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (!item) return "";
        if (typeof item.value === "string") return item.value;
        if (Array.isArray(item.value)) return item.value.join("\n");
        if (item.value && typeof item.value === "object") {
          return Object.values(item.value).join("\n");
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  if (content == null) return "";
  return String(content);
}

function normalizeStatus(status) {
  return status === "error" ? "error" : DEFAULT_STATUS;
}

function buildUiContentFromMessageContent(content) {
  if (Array.isArray(content)) {
    return content;
  }

  const text = extractTextContent(content);
  return text ? [{ type: "response", value: text }] : [];
}

function normalizeComparableText(content) {
  return extractTextContent(content).replace(/\r\n/g, "\n").trim();
}

function normalizeMainMessage(message = {}) {
  return {
    ...message,
    id: message.id || createMessageId(),
    status: normalizeStatus(message.status),
    error: message.error || null,
  };
}

function normalizeUiMessage(message = {}, matchedMainMessage = null) {
  const sourceMessageId =
    message.sourceMessageId ||
    (matchedMainMessage ? matchedMainMessage.id : null) ||
    null;

  return {
    ...message,
    id: message.id || sourceMessageId || createMessageId(),
    sourceMessageId,
    content: buildUiContentFromMessageContent(message.content),
    status: normalizeStatus(message.status || matchedMainMessage?.status),
    error: message.error || matchedMainMessage?.error || null,
    retryable:
      typeof message.retryable === "boolean"
        ? message.retryable
        : Boolean(sourceMessageId),
  };
}

function findMatchedMainMessage(uiMessage, mainMessages, usedMessageIds) {
  if (!uiMessage) return null;

  if (uiMessage.sourceMessageId) {
    return (
      mainMessages.find((message) => message.id === uiMessage.sourceMessageId) ||
      null
    );
  }

  if (uiMessage.id) {
    const sameIdMessage = mainMessages.find((message) => message.id === uiMessage.id);
    if (sameIdMessage) {
      return sameIdMessage;
    }
  }

  const uiText = normalizeComparableText(uiMessage.content);
  if (!uiText) return null;

  return (
    mainMessages.find((message) => {
      if (usedMessageIds.has(message.id)) return false;
      if (message.role !== uiMessage.role) return false;
      return normalizeComparableText(message.content) === uiText;
    }) || null
  );
}

export function createLinkedMessagePair({
  id = createMessageId(),
  role,
  textContent,
  uiContent,
  status = DEFAULT_STATUS,
  error = null,
  retryable = true,
  extra = {},
} = {}) {
  const normalizedStatus = normalizeStatus(status);

  return {
    message: {
      id,
      role,
      content: textContent,
      status: normalizedStatus,
      error,
      ...extra,
    },
    uiMessage: {
      id,
      sourceMessageId: id,
      role,
      content: buildUiContentFromMessageContent(uiContent),
      status: normalizedStatus,
      error,
      retryable,
      ...extra,
    },
  };
}

export function createUiOnlyMessage({
  id = createMessageId("ui"),
  role,
  content,
  status = DEFAULT_STATUS,
  error = null,
  retryable = false,
  extra = {},
} = {}) {
  return {
    id,
    role,
    content: buildUiContentFromMessageContent(content),
    status: normalizeStatus(status),
    error,
    retryable,
    sourceMessageId: null,
    ...extra,
  };
}

export function normalizeStoredChat(messages = [], uiMessages = []) {
  const normalizedMessages = Array.isArray(messages)
    ? messages.map((message) => normalizeMainMessage(message))
    : [];

  if (!Array.isArray(uiMessages) || uiMessages.length === 0) {
    return {
      messages: normalizedMessages,
      uiMessages: normalizedMessages.map((message) =>
        normalizeUiMessage(
          {
            ...message,
            content: buildUiContentFromMessageContent(message.content),
          },
          message
        )
      ),
    };
  }

  const usedMessageIds = new Set();
  const normalizedUiMessages = uiMessages.map((uiMessage) => {
    const matchedMainMessage = findMatchedMainMessage(
      uiMessage,
      normalizedMessages,
      usedMessageIds
    );

    if (matchedMainMessage) {
      usedMessageIds.add(matchedMainMessage.id);
    }

    return normalizeUiMessage(uiMessage, matchedMainMessage);
  });

  return {
    messages: normalizedMessages,
    uiMessages: normalizedUiMessages,
  };
}
