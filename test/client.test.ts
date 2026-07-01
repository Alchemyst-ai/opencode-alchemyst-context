import { describe, it, expect, beforeEach, vi } from "vitest";
import { createClient } from "../src/client";

const TEST_API_KEY = "test-key-12345";
const BASE_URL = "https://platform-backend.getalchemystai.com";

function mockFetch(response: Partial<Response>, body: unknown) {
  return vi.mocked(fetch).mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    statusText: response.statusText ?? "OK",
    json: vi.fn().mockResolvedValue(body),
    headers: new Headers(response.headers),
    redirected: false,
    type: "basic" as ResponseType,
    url: "",
    clone: vi.fn(),
    body: null,
    bodyUsed: false,
    arrayBuffer: vi.fn(),
    blob: vi.fn(),
    formData: vi.fn(),
    text: vi.fn(),
  } as unknown as Response);
}

describe("AlchemystClient", () => {
  const config = {
    apiKey: TEST_API_KEY,
    baseUrl: BASE_URL,
    defaultScope: "internal" as const,
    groupName: "opencode",
    projectName: "test-project",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = vi.fn();
  });

  describe("search", () => {
    const searchParams = {
      query: "test query",
      similarity_threshold: 0.8,
      minimum_similarity_threshold: 0.5,
      scope: "internal" as const,
    };

    it("returns search results on 202", async () => {
      const responseBody = {
        contexts: [
          { content: "result 1", score: 0.91 },
          { content: "result 2", score: 0.75 },
        ],
      };
      mockFetch({ ok: true, status: 202 }, responseBody);

      const client = createClient(config);
      const result = await client.search(searchParams);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual(responseBody);
      }
    });

    it("returns auth error on 401", async () => {
      mockFetch({ ok: false, status: 401 }, {
        success: false,
        message: "unauthorized",
      });

      const client = createClient(config);
      const result = await client.search(searchParams);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("ALCHEMYST_API_KEY");
        expect(result.status).toBe(401);
      }
    });

    it("returns auth error on 403", async () => {
      mockFetch({ ok: false, status: 403 }, {
        success: false,
        message: "forbidden",
      });

      const client = createClient(config);
      const result = await client.search(searchParams);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("ALCHEMYST_API_KEY");
        expect(result.status).toBe(403);
      }
    });

    it("returns billing error on 402", async () => {
      mockFetch({ ok: false, status: 402 }, {
        success: false,
        message: "payment required",
      });

      const client = createClient(config);
      const result = await client.search(searchParams);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("billing");
        expect(result.status).toBe(402);
      }
    });

    it("returns generic error on 400", async () => {
      mockFetch({ ok: false, status: 400 }, {
        success: false,
        message: "bad request",
      });

      const client = createClient(config);
      const result = await client.search(searchParams);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("bad request");
        expect(result.status).toBe(400);
      }
    });

    it("retries on 500 then returns unavailable", async () => {
      mockFetch({ ok: false, status: 500 }, {
        response: "internal error",
      });

      const client = createClient(config);
      const result = await client.search(searchParams);

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("internal error");
        expect(result.status).toBe(500);
      }
    });

    it("retries on network error then returns unavailable", async () => {
      vi.mocked(fetch).mockRejectedValue(new Error("network failure"));

      const client = createClient(config);
      const result = await client.search(searchParams);

      expect(fetch).toHaveBeenCalledTimes(3);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("unavailable");
      }
    });

    it("uses fast mode param when specified", async () => {
      mockFetch({ ok: true, status: 200 }, { contexts: [] });

      const client = createClient(config);
      await client.search(searchParams, "fast");

      const callUrl = (fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callUrl).toContain("mode=fast");
    });

    it("parses error.message first, then message, then response, then statusText", async () => {
      mockFetch(
        { ok: false, status: 400, statusText: "Bad Request" },
        { error: { message: "nested error" } },
      );

      const client = createClient(config);
      const result = await client.search(searchParams);

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toBe("nested error");
    });
  });

  describe("add", () => {
    const addParams = {
      documents: [{ content: "test content" }],
      source: "opencode:test-project",
      context_type: "resource" as const,
      scope: "internal" as const,
    };

    it("returns success on 201", async () => {
      const responseBody = {
        success: true,
        context_id: "ctx-123",
        processed_documents: 1,
      };
      mockFetch({ ok: true, status: 201 }, responseBody);

      const client = createClient(config);
      const result = await client.add(addParams);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.context_id).toBe("ctx-123");
      }
    });

    it("returns error on 400", async () => {
      mockFetch({ ok: false, status: 400 }, { response: "invalid" });

      const client = createClient(config);
      const result = await client.add(addParams);

      expect(result.ok).toBe(false);
    });
  });

  describe("ask", () => {
    it("returns answer on 200", async () => {
      const responseBody = {
        answer: "The PRD says to exclude Voice AI.",
        model: "gpt-4",
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      };
      mockFetch({ ok: true, status: 200 }, responseBody);

      const client = createClient(config);
      const result = await client.ask({ query: "what does the PRD say?" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.answer).toContain("exclude Voice AI");
      }
    });
  });

  describe("memoryAdd", () => {
    it("returns success on 201", async () => {
      const responseBody = {
        success: true,
        context_id: "mem-123",
        processed_documents: 2,
      };
      mockFetch({ ok: true, status: 201 }, responseBody);

      const client = createClient(config);
      const result = await client.memoryAdd({
        sessionId: "sess-1",
        contents: [
          { content: "turn 1" },
          { content: "turn 2" },
        ],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.processed_documents).toBe(2);
      }
    });
  });

  describe("memoryUpdate", () => {
    it("returns success on 200", async () => {
      const responseBody = {
        success: true,
        memory_id: "mem-456",
        updated_entries: 1,
      };
      mockFetch({ ok: true, status: 200 }, responseBody);

      const client = createClient(config);
      const result = await client.memoryUpdate({
        sessionId: "sess-1",
        contents: [{ content: "updated content" }],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.updated_entries).toBe(1);
        expect(result.data.memory_id).toBe("mem-456");
      }
    });
  });
});
