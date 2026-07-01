import { tool } from "@opencode-ai/plugin";
import type { Config } from "../config";
import type { ConfigStore } from "../config";
import { getConfigPath } from "../config";

export function makeConfigureTool(store: ConfigStore) {
  return tool({
    description:
      "Set or update the Alchemyst API key and optionally override connection settings. Required before using any other alchemyst_* tools. All values are saved to ~/.config/opencode-alchemyst/config.json and persist across sessions. Environment variables ALCHEMYST_BASE_URL, ALCHEMYST_DEFAULT_SCOPE, and ALCHEMYST_GROUP_NAME take priority over saved values if set.",
    args: {
      apiKey: tool.schema
        .string()
        .describe(
          "The Alchemyst API JWT bearer token from your AlchemystAI account",
        ),
      baseUrl: tool.schema
        .string()
        .optional()
        .describe(
          "Override the Alchemyst API base URL (default: https://platform-backend.getalchemystai.com)",
        ),
      defaultScope: tool.schema
        .enum(["internal", "external"])
        .optional()
        .describe("Override the default search scope"),
      groupName: tool.schema
        .array(tool.schema.string())
        .optional()
        .describe("Override the group names for context categorization"),
    },
    async execute(args, ctx) {
      try {
        await ctx.ask({
          permission: `Save Alchemyst API configuration to ${getConfigPath()}?`,
          patterns: [],
          always: [],
          metadata: { file: getConfigPath() },
        });
      } catch {
        return "Permission denied. Alchemyst API configuration was not saved.";
      }

      const overrides: Partial<
        Pick<Config, "baseUrl" | "defaultScope" | "groupName">
      > = {};
      if (args.baseUrl) overrides.baseUrl = args.baseUrl;
      if (args.defaultScope) overrides.defaultScope = args.defaultScope;
      if (args.groupName) overrides.groupName = args.groupName;

      store.setApiKey(args.apiKey, overrides);
      return "Alchemyst API configured successfully. All alchemyst_* tools are now active.";
    },
  });
}
