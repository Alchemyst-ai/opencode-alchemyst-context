import type { Plugin, Hooks } from "@opencode-ai/plugin";
import { ConfigStore } from "./config";
import { makeSearchTool } from "./tools/search";
import { makeAddTool } from "./tools/add";
import { makeMemoryTools } from "./tools/memory";
import { makeAskTool } from "./tools/ask";
import { makeConfigureTool } from "./tools/configure";

const plugin: Plugin = async (ctx) => {
  const projectName =
    (ctx.project as { name?: string })?.name ??
    ctx.directory?.split("/").filter(Boolean).pop() ??
    "unknown";
  const store = ConfigStore.create(projectName);

  if (store.client) {
    ctx.client?.app?.log?.({
      body: {
        service: "alchemyst-context",
        level: "info",
        message: `Plugin initialized for project: ${projectName}`,
        extra: {
          baseUrl: store.config.baseUrl,
          defaultScope: store.config.defaultScope,
        },
      },
    });
  } else {
    ctx.client?.app?.log?.({
      body: {
        service: "alchemyst-context",
        level: "warn",
        message:
          "Alchemyst API key not configured — use alchemyst_configure tool to set it",
      },
    });
  }

  const memoryTools = makeMemoryTools(store);

  const hooks: Hooks = {
    tool: {
      alchemyst_context_search: makeSearchTool(store),
      alchemyst_context_add: makeAddTool(store),
      alchemyst_memory_add: memoryTools.add,
      alchemyst_memory_update: memoryTools.update,
      alchemyst_context_ask: makeAskTool(store),
      alchemyst_configure: makeConfigureTool(store),
    },
  };

  return hooks;
};

export default { server: plugin };
