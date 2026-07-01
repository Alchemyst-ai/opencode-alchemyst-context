import { tool } from "@opencode-ai/plugin";
import type { ConfigStore } from "../config";
import {
  formatAskResult,
  formatAuthError,
  formatBillingError,
  formatUnavailableError,
  formatGenericError,
  formatApiKeyMissingError,
} from "../format";

export function makeAskTool(store: ConfigStore) {
  return tool({
    description:
      "Ask a question grounded in AlchemystAI's Context Layer and get a synthesized answer (not raw chunks). Use for quick factual lookups; use `alchemyst_context_search` instead when you want to see and judge the underlying source chunks yourself.",
    args: {
      query: tool.schema
        .string()
        .describe(
          "Natural language question to ask against stored context",
        ),
      steeringPrompt: tool.schema
        .string()
        .optional()
        .describe(
          "Optional instruction to steer the answer format (e.g. 'answer in 2 sentences')",
        ),
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
    },
    async execute(args, _ctx) {
      if (!store.client) return formatApiKeyMissingError();

      const result = await store.client.ask({
        query: args.query,
        similarity_threshold: args.similarity_threshold,
        minimum_similarity_threshold: args.minimum_similarity_threshold,
        scope: args.scope,
        ...(args.steeringPrompt
          ? { steeringPrompt: args.steeringPrompt }
          : {}),
      });

      if (!result.ok) {
        if (result.status === 401 || result.status === 403)
          return formatAuthError();
        if (result.status === 402) return formatBillingError();
        if (result.status && result.status >= 500)
          return formatUnavailableError();
        return formatGenericError(result.error);
      }

      return formatAskResult(result.data.answer);
    },
  });
}
