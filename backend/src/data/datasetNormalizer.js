const COLUMN_ALIASES = {
  id: ["id", "interaction_id", "ticket_id", "record_id"],
  message: ["message", "text", "query", "customer_message", "body", "content", "description"],
  category: ["category", "query_type", "type", "topic", "issue_type"],
  priority: ["priority", "urgency", "priority_level"],
  sentiment: ["sentiment", "customer_sentiment", "tone"],
  resolution: ["resolution", "resolution_status", "status", "outcome"],
  needsHuman: ["needs_human", "needshuman", "needsHuman", "follow_up_required", "handled_by"],
};

function normalizeKey(key) {
  return String(key).trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function buildColumnLookup(row) {
  const lookup = {};

  for (const [column, value] of Object.entries(row)) {
    if (column.startsWith("__")) {
      continue;
    }

    lookup[normalizeKey(column)] = value;
  }

  return lookup;
}

function trimToNull(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function pickValue(lookup, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(lookup, alias)) {
      return lookup[alias];
    }
  }

  return null;
}

function parseBoolean(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim().toLowerCase();

  if (["true", "1", "yes"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no"].includes(normalized)) {
    return false;
  }

  if (normalized.includes("human")) {
    return true;
  }

  if (normalized.includes("ai") || normalized.includes("bot") || normalized.includes("chatbot")) {
    return false;
  }

  return null;
}

function normalizeNeedsHuman(lookup) {
  const explicit = pickValue(lookup, ["needs_human", "needshuman"]);
  const explicitBoolean = parseBoolean(explicit);

  if (explicitBoolean !== null) {
    return explicitBoolean;
  }

  const handledBy = pickValue(lookup, ["handled_by"]);
  const handledByBoolean = parseBoolean(handledBy);

  if (handledByBoolean !== null) {
    return handledByBoolean;
  }

  return parseBoolean(pickValue(lookup, ["follow_up_required"]));
}

function normalizeRecord(row) {
  const lookup = buildColumnLookup(row);

  return {
    id: trimToNull(pickValue(lookup, COLUMN_ALIASES.id)),
    message: trimToNull(pickValue(lookup, COLUMN_ALIASES.message)),
    category: trimToNull(pickValue(lookup, COLUMN_ALIASES.category)),
    priority: trimToNull(pickValue(lookup, COLUMN_ALIASES.priority)),
    sentiment: trimToNull(pickValue(lookup, COLUMN_ALIASES.sentiment)),
    resolution: trimToNull(pickValue(lookup, COLUMN_ALIASES.resolution)),
    needsHuman: normalizeNeedsHuman(lookup),
  };
}

function normalizeDataset(rows) {
  return rows.map(normalizeRecord);
}

module.exports = { normalizeDataset, normalizeRecord };
