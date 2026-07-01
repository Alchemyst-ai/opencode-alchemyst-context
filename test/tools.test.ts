import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigStore } from "../src/config";
import { makeSearchTool } from "../src/tools/search";
import { makeAddTool } from "../src/tools/add";
import { makeAskTool } from "../src/tools/ask";
import { makeConfigureTool } from "../src/tools/configure";
import { checkContent } from "../src/security";
import {
  formatSearchResults,
  formatAddResult,
  formatMemoryResult,
  formatAuthError,
  formatBillingError,
  formatUnavailableError,
  formatApiKeyMissingError,
  formatSecurityBlocked,
  formatGenericError,
} from "../src/format";

const mockToolContext = {
  sessionID: "sess-123",
  messageID: "msg-1",
  agent: "test-agent",
  directory: "/tmp/test-project",
  worktree: "/tmp/test-project",
  abort: new AbortController().signal,
  metadata: vi.fn(),
  ask: vi.fn().mockResolvedValue(undefined),
};

function makeStore(apiKey: string | null): ConfigStore {
  return ConfigStore.fromConfig({
    apiKey,
    baseUrl: "https://example.com",
    defaultScope: "internal" as const,
    groupName: ["opencode"],
    projectName: "test-project",
  });
}

describe("security", () => {
  it("blocks private key content", () => {
    const result = checkContent("-----BEGIN RSA PRIVATE KEY-----\nABCDEF");
    expect(result.blocked).toBe(true);
    if (result.blocked) expect(result.category).toBe("private-key");
  });

  it("blocks AWS access key", () => {
    const result = checkContent("AKIA1234567890123456");
    expect(result.blocked).toBe(true);
    if (result.blocked) expect(result.category).toBe("aws-access-key");
  });

  it("blocks OpenAI-style API key", () => {
    const result = checkContent("sk-abcdefghijklmnopqrstuvwxyz12345678");
    expect(result.blocked).toBe(true);
    if (result.blocked) expect(result.category).toBe("openai-api-key");
  });

  it("blocks GitHub token", () => {
    const result = checkContent("ghp_abcdefghijklmnopqrstuvwxyz1234567890");
    expect(result.blocked).toBe(true);
    if (result.blocked) expect(result.category).toBe("github-token");
  });

  it("blocks generic api_key pattern", () => {
    const result = checkContent('api_key = "abcdefghijklmnop12345678"');
    expect(result.blocked).toBe(true);
    if (result.blocked) expect(result.category).toBe("api-key");
  });

  it("blocks env-style SECRET assignment", () => {
    const result = checkContent("SECRET=my-super-secret-value-12345");
    expect(result.blocked).toBe(true);
    if (result.blocked) expect(result.category).toBe("env-secret");
  });

  it("allows safe content through", () => {
    const result = checkContent(
      "The PRD says we should use React 18 for the frontend.",
    );
    expect(result.blocked).toBe(false);
  });

  it("allows mildly suspicious but non-matching content", () => {
    const result = checkContent(
      "We decided to use the secret manager API for storing configs.",
    );
    expect(result.blocked).toBe(false);
  });
});

describe("format", () => {
  describe("formatSearchResults", () => {
    it("formats results as numbered markdown list", () => {
      const results = [
        { content: "First result", score: 0.91 },
        { content: "Second result", score: 0.75 },
      ];
      const formatted = formatSearchResults(results, 8);
      expect(formatted).toContain("1. [score 0.91]");
      expect(formatted).toContain("2. [score 0.75]");
      expect(formatted).toContain("First result");
      expect(formatted).toContain("Second result");
    });

    it("returns explicit string when no results", () => {
      const formatted = formatSearchResults([], 8);
      expect(formatted).toBe("No matching context found in Alchemyst.");
    });

    it("sorts by score descending", () => {
      const results = [
        { content: "low", score: 0.5 },
        { content: "high", score: 0.95 },
        { content: "medium", score: 0.7 },
      ];
      const formatted = formatSearchResults(results, 8);
      const lines = formatted.split("\n");
      expect(lines[0]).toContain("0.95");
      expect(lines[1]).toContain("0.70");
      expect(lines[2]).toContain("0.50");
    });

    it("respects limit", () => {
      const results = Array.from({ length: 10 }, (_, i) => ({
        content: `result ${i}`,
        score: 1 - i * 0.1,
      }));
      const formatted = formatSearchResults(results, 3);
      const lines = formatted.split("\n");
      expect(lines.length).toBe(3);
    });

    it("truncates content over 800 chars", () => {
      const long = "a".repeat(900);
      const results = [{ content: long, score: 0.9 }];
      const formatted = formatSearchResults(results, 8);
      expect(formatted.length).toBeLessThan(900);
      expect(formatted).toContain("…");
    });
  });

  describe("error formatters", () => {
    it("formatAuthError", () => {
      expect(formatAuthError()).toContain("API key");
    });

    it("formatBillingError", () => {
      expect(formatBillingError()).toContain("billing");
    });

    it("formatUnavailableError", () => {
      expect(formatUnavailableError()).toContain("unavailable");
    });

    it("formatApiKeyMissingError", () => {
      expect(formatApiKeyMissingError()).toContain("alchemyst_configure");
    });

    it("formatSecurityBlocked", () => {
      const msg = formatSecurityBlocked("private-key");
      expect(msg).toContain("blocked");
      expect(msg).toContain("private-key");
    });

    it("formatGenericError", () => {
      const msg = formatGenericError("something broke");
      expect(msg).toContain("something broke");
    });
  });
});

describe("tools (null client)", () => {
  const emptyStore = makeStore(null);

  it("search tool returns missing key error without client", async () => {
    const tool = makeSearchTool(emptyStore);
    const result = await tool.execute(
      {
        query: "test",
        scope: "internal",
        similarity_threshold: 0.8,
        minimum_similarity_threshold: 0.5,
        mode: "standard",
        limit: 8,
      },
      mockToolContext,
    );
    expect(result).toContain("alchemyst_configure");
  });

  it("add tool returns missing key error without client", async () => {
    const tool = makeAddTool(emptyStore);
    const result = await tool.execute(
      {
        content: "test content",
        context_type: "resource",
        scope: "internal",
      },
      mockToolContext,
    );
    expect(result).toContain("alchemyst_configure");
  });

  it("ask tool returns missing key error without client", async () => {
    const tool = makeAskTool(emptyStore);
    const result = await tool.execute(
      {
        query: "test",
        scope: "internal",
        similarity_threshold: 0.8,
        minimum_similarity_threshold: 0.5,
      },
      mockToolContext,
    );
    expect(result).toContain("alchemyst_configure");
  });
});

describe("configure tool", () => {
  it("saves API key and creates client after permission", async () => {
    const store = makeStore(null);
    expect(store.client).toBeNull();

    const tool = makeConfigureTool(store);
    const result = await tool.execute(
      { apiKey: "new-key-12345" },
      mockToolContext,
    );

    expect(result).toContain("configured successfully");
    expect(store.client).not.toBeNull();
    expect(store.config.apiKey).toBe("new-key-12345");
  });

  it("persists all config fields to the store when saving", async () => {
    const store = makeStore(null);

    const tool = makeConfigureTool(store);
    await tool.execute(
      {
        apiKey: "abc",
        baseUrl: "https://staging.example.com",
        defaultScope: "external",
        groupName: ["my-team", "project-x"],
      },
      mockToolContext,
    );

    expect(store.config.apiKey).toBe("abc");
    expect(store.config.baseUrl).toBe("https://staging.example.com");
    expect(store.config.defaultScope).toBe("external");
    expect(store.config.groupName).toEqual(["my-team", "project-x"]);
  });

  it("only overrides fields provided when saving", async () => {
    const store = makeStore("existing-key");
    const originalBaseUrl = store.config.baseUrl;
    const originalScope = store.config.defaultScope;

    const tool = makeConfigureTool(store);
    await tool.execute(
      { apiKey: "updated-key", groupName: ["new-team"] },
      mockToolContext,
    );

    expect(store.config.apiKey).toBe("updated-key");
    expect(store.config.groupName).toEqual(["new-team"]);
    expect(store.config.baseUrl).toBe(originalBaseUrl);
    expect(store.config.defaultScope).toBe(originalScope);
  });

  it("returns permission denied when ask rejects", async () => {
    const store = makeStore(null);
    const ask = vi.fn().mockRejectedValue(new Error("denied"));

    const tool = makeConfigureTool(store);
    const result = await tool.execute(
      { apiKey: "should-not-save" },
      { ...mockToolContext, ask },
    );

    expect(result).toContain("Permission denied");
    expect(store.config.apiKey).toBeNull();
  });
});
