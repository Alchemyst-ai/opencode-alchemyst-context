import { tool } from "@opencode-ai/plugin";
import type { ConfigStore } from "../config";
import {
  formatMemoryResult,
  formatAuthError,
  formatBillingError,
  formatUnavailableError,
  formatGenericError,
  formatApiKeyMissingError,
  formatSecurityBlocked,
} from "../format";
import { checkContent } from "../security";

export function makeMemoryTools(store: ConfigStore) {
  const resolveSessionId = (
    sessionID: string | undefined,
    directory: string,
  ): string => {
    return sessionID || `session:${store.config.projectName}:${directory}`;
  };

  return {
    add: tool({
      description:
        "Persist one or more conversation turns from this coding session to AlchemystAI memory, keyed by session ID, so the conversation can be recalled later.",
      args: {
        contents: tool.schema
          .array(
            tool.schema.object({
              content: tool.schema
                .string()
                .describe("The conversation content"),
              messageId: tool.schema
                .string()
                .optional()
                .describe("Optional message identifier"),
            }),
          )
          .describe("Conversation turns to persist"),
        groupName: tool.schema
          .array(tool.schema.string())
          .optional()
          .describe("Group tags for categorization"),
      },
      async execute(args, ctx) {
        if (!store.client) return formatApiKeyMissingError();

        const sessionId = resolveSessionId(ctx.sessionID, ctx.directory);

        for (const entry of args.contents) {
          const check = checkContent(entry.content);
          if (check.blocked) return formatSecurityBlocked(check.category);
        }

        const result = await store.client.memoryAdd({
          sessionId,
          contents: args.contents.map((c) => ({
            content: c.content,
            metadata: c.messageId ? { messageId: c.messageId } : undefined,
          })),
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

        return formatMemoryResult(
          result.data.context_id,
          result.data.processed_documents,
        );
      },
    }),

    update: tool({
      description:
        "Update or amend conversation turns already saved to AlchemystAI memory for the current session.",
      args: {
        contents: tool.schema
          .array(
            tool.schema.object({
              content: tool.schema
                .string()
                .describe("The updated conversation content"),
              role: tool.schema
                .string()
                .optional()
                .describe("Message role (user/assistant/system)"),
              id: tool.schema
                .string()
                .optional()
                .describe("Entry identifier for targeted updates"),
              createdAt: tool.schema
                .string()
                .optional()
                .describe("Original creation timestamp"),
            }),
          )
          .describe("Conversation entries to update"),
      },
      async execute(args, ctx) {
        if (!store.client) return formatApiKeyMissingError();

        const sessionId = resolveSessionId(ctx.sessionID, ctx.directory);

        for (const entry of args.contents) {
          const check = checkContent(entry.content);
          if (check.blocked) return formatSecurityBlocked(check.category);
        }

        const result = await store.client.memoryUpdate({
          sessionId,
          contents: args.contents.map((c) => ({
            content: c.content,
            role: c.role,
            id: c.id,
            createdAt: c.createdAt,
          })),
        });

        if (!result.ok) {
          if (result.status === 401 || result.status === 403)
            return formatAuthError();
          if (result.status === 402) return formatBillingError();
          if (result.status && result.status >= 500)
            return formatUnavailableError();
          return formatGenericError(result.error);
        }

        return formatMemoryResult(
          result.data.memory_id,
          result.data.updated_entries,
        );
      },
    }),
  };
}
