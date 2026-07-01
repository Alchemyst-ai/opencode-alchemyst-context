import { tool } from "@opencode-ai/plugin";
import type { ConfigStore } from "../config";
import {
  formatSearchResults,
  formatAuthError,
  formatBillingError,
  formatUnavailableError,
  formatGenericError,
  formatApiKeyMissingError,
} from "../format";

export function makeSearchTool(store: ConfigStore) {
  return tool({
    description:
      "Search AlchemystAI's Context Layer for previously captured decisions, docs, or reference material relevant to a query. Use before answering questions about prior team decisions, specs, or conventions that might already be documented.",
    args: {
      query: tool.schema.string().describe("Natural language search query"),
      scope: tool.schema
        .enum(["internal", "external"])
        .default("internal")
        .describe("Document scope"),
      similarity_threshold: tool.schema
        .number()
        .default(0.8)
        .describe("Maximum similarity threshold (0-1)"),
      minimum_similarity_threshold: tool.schema
        .number()
        .default(0.5)
        .describe("Minimum similarity threshold (0-1)"),
      mode: tool.schema
        .enum(["fast", "standard"])
        .default("standard")
        .describe("Search mode: fast or standard"),
      limit: tool.schema
        .number()
        .default(8)
        .describe("Maximum number of results to return (client-side cap)"),
    },
    async execute(args, _ctx) {
      if (!store.client) return formatApiKeyMissingError();

      const result = await store.client.search(
        {
          query: args.query,
          similarity_threshold: args.similarity_threshold,
          minimum_similarity_threshold: args.minimum_similarity_threshold,
          scope: args.scope,
        },
        args.mode,
      );

      if (!result.ok) {
        if (result.status === 401 || result.status === 403)
          return formatAuthError();
        if (result.status === 402) return formatBillingError();
        if (result.status && result.status >= 500)
          return formatUnavailableError();
        return formatGenericError(result.error);
      }

      return formatSearchResults(result.data.contexts, args.limit);
    },
  });
}
