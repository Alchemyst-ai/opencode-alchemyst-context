const MAX_CONTENT_LENGTH = 800;

export function truncateContent(content: string): string {
  if (content.length <= MAX_CONTENT_LENGTH) return content;
  const truncated = content.slice(0, MAX_CONTENT_LENGTH);
  const lastNewline = truncated.lastIndexOf("\n");
  const cutAt = lastNewline > 0 ? lastNewline : MAX_CONTENT_LENGTH;
  return content.slice(0, cutAt) + "\n…";
}

export type SearchResult = {
  content: string;
  score: number;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
};

export function formatSearchResults(
  results: SearchResult[],
  limit: number,
): string {
  if (results.length === 0) {
    return "No matching context found in Alchemyst.";
  }

  const sorted = [...results]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return sorted
    .map(
      (r, i) =>
        `${i + 1}. [score ${r.score.toFixed(2)}] ${truncateContent(r.content)}`,
    )
    .join("\n");
}

export function formatAddResult(
  contextId: string,
  processedCount: number,
): string {
  return `Context saved successfully (ID: ${contextId}, documents: ${processedCount}).`;
}

export function formatMemoryResult(id: string, entryCount: number): string {
  return `Memory persisted successfully (ID: ${id}, entries: ${entryCount}).`;
}

export function formatAskResult(answer: string): string {
  return answer;
}

export function formatAuthError(): string {
  return "Alchemyst API auth failed — check your configured API key";
}

export function formatBillingError(): string {
  return "Alchemyst account has a billing/plan restriction blocking this call.";
}

export function formatUnavailableError(): string {
  return "Alchemyst context search unavailable right now.";
}

export function formatApiKeyMissingError(): string {
  return "Alchemyst API key not configured. Use `alchemyst_configure` to set it up.";
}

export function formatSecurityBlocked(category: string): string {
  return `Content blocked by security guard: ${category} pattern detected. Refusing to send.`;
}

export function formatGenericError(message: string): string {
  return `Alchemyst API error: ${message}`;
}
