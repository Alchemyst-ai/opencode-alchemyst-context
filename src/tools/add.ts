import { tool } from "@opencode-ai/plugin";
import type { ConfigStore } from "../config";
import {
  formatAddResult,
  formatAuthError,
  formatBillingError,
  formatUnavailableError,
  formatGenericError,
  formatApiKeyMissingError,
  formatSecurityBlocked,
} from "../format";
import { checkContent } from "../security";

export function makeAddTool(store: ConfigStore) {
  return tool({
    description:
      "Save a decision, fact, or reference snippet to AlchemystAI's Context Layer so it's retrievable in future sessions. Use `context_type: instruction` for conventions/preferences to remember, `resource` for reference material or decisions, and prefer `alchemyst_memory_add` for saving raw conversation turns.",
    args: {
      content: tool.schema
        .string()
        .describe("The document content to save"),
      context_type: tool.schema
        .enum(["resource", "instruction"])
        .describe(
          "Type of context: resource for reference material, instruction for conventions",
        ),
      scope: tool.schema
        .enum(["internal", "external"])
        .default("internal")
        .describe("Document scope"),
      groupName: tool.schema
        .array(tool.schema.string())
        .optional()
        .describe("Group tags for categorization"),
      source: tool.schema
        .string()
        .optional()
        .describe("Source identifier (defaults to opencode:<project-name>)"),
    },
    async execute(args, _ctx) {
      if (!store.client) return formatApiKeyMissingError();

      const securityCheck = checkContent(args.content);
      if (securityCheck.blocked) {
        return formatSecurityBlocked(securityCheck.category);
      }

      const result = await store.client.add({
        documents: [{ content: args.content }],
        context_type: args.context_type,
        scope: args.scope,
        source: args.source ?? `opencode:${store.config.projectName}`,
        metadata: {
          groupName: args.groupName?.length
            ? args.groupName
            : store.config.groupName,
        },
      });

      if (!result.ok) {
        if (result.status === 401 || result.status === 403)
          return formatAuthError();
        if (result.status === 402) return formatBillingError();
        if (result.status && result.status >= 500)
          return formatUnavailableError();
        return formatGenericError(result.error);
      }

      return formatAddResult(
        result.data.context_id,
        result.data.processed_documents,
      );
    },
  });
}
