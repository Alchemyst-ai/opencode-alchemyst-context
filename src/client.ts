import type { Config } from "./config";

export type ClientResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

type ErrorShape = {
  success?: boolean;
  message?: string;
  error?: { message?: string };
  response?: string;
};

async function parseErrorBody(response: Response): Promise<string> {
  try {
    const body: ErrorShape = await response.json();
    return (
      body.error?.message ??
      body.message ??
      body.response ??
      `HTTP ${response.status}: ${response.statusText}`
    );
  } catch {
    return `HTTP ${response.status}: ${response.statusText}`;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(
  baseUrl: string,
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<ClientResult<T>> {
  const url = `${baseUrl}${path}`;
  const delays = [250, 1000];

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });

      if (response.ok) {
        const data = (await response.json()) as T;
        return { ok: true, data };
      }

      const errorMsg = await parseErrorBody(response);

      if (response.status >= 400 && response.status < 500) {
        if (response.status === 401 || response.status === 403) {
          return {
            ok: false,
            error:
              "Alchemyst API auth failed — check ALCHEMYST_API_KEY",
            status: response.status,
          };
        }
        if (response.status === 402) {
          return {
            ok: false,
            error:
              "Alchemyst account has a billing/plan restriction blocking this call.",
            status: response.status,
          };
        }
        return { ok: false, error: errorMsg, status: response.status };
      }

      if (attempt < delays.length) {
        await sleep(delays[attempt]);
        continue;
      }

      return { ok: false, error: errorMsg, status: response.status };
    } catch (error) {
      if (attempt < delays.length) {
        await sleep(delays[attempt]);
        continue;
      }
      return {
        ok: false,
        error: "Alchemyst context search unavailable right now.",
      };
    }
  }

  return { ok: false, error: "Alchemyst context search unavailable right now." };
}

export type SearchRequest = {
  query: string;
  similarity_threshold: number;
  minimum_similarity_threshold: number;
  scope?: "internal" | "external";
  body_metadata?: Record<string, unknown>;
};

export type SearchResponse = {
  contexts: Array<{
    content: string;
    score: number;
    createdAt?: string;
    updatedAt?: string;
    metadata?: Record<string, unknown>;
  }>;
};

export type AskResponse = {
  answer: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  context?: string;
};

export type AddRequest = {
  documents: Array<{ content: string }>;
  source: string;
  context_type: "resource" | "instruction" | "conversation";
  scope: "internal" | "external";
  metadata?: Record<string, unknown>;
};

export type AddResponse = {
  success: boolean;
  context_id: string;
  processed_documents: number;
};

export type MemoryAddRequest = {
  sessionId: string;
  contents: Array<{
    content: string;
    metadata?: { messageId?: string };
  }>;
  metadata?: { groupName?: string[] };
};

export type MemoryResponse = {
  success: boolean;
  context_id: string;
  processed_documents: number;
};

export type MemoryUpdateRequest = {
  sessionId: string;
  contents: Array<{
    content: string;
    role?: string;
    id?: string;
    createdAt?: string;
    metadata?: Record<string, unknown>;
  }>;
};

export type MemoryUpdateResponse = {
  success: boolean;
  memory_id: string;
  updated_entries: number;
};

export function createClient(config: Config) {
  const { baseUrl, apiKey } = config;

  if (!apiKey) {
    throw new Error("ALCHEMYST_API_KEY is required to create a client");
  }

  return {
    search(
      params: SearchRequest,
      mode: "fast" | "standard" = "standard",
    ): Promise<ClientResult<SearchResponse>> {
      return request<SearchResponse>(
        baseUrl,
        apiKey,
        "POST",
        `/api/v1/context/search${mode === "fast" ? "?mode=fast" : ""}`,
        params,
      );
    },

    ask(
      params: SearchRequest & { steeringPrompt?: string },
    ): Promise<ClientResult<AskResponse>> {
      return request<AskResponse>(
        baseUrl,
        apiKey,
        "POST",
        "/api/v1/context/search/steer",
        params,
      );
    },

    add(params: AddRequest): Promise<ClientResult<AddResponse>> {
      return request<AddResponse>(
        baseUrl,
        apiKey,
        "POST",
        "/api/v1/context/add",
        params,
      );
    },

    memoryAdd(
      params: MemoryAddRequest,
    ): Promise<ClientResult<MemoryResponse>> {
      return request<MemoryResponse>(
        baseUrl,
        apiKey,
        "POST",
        "/api/v1/context/memory/add",
        params,
      );
    },

    memoryUpdate(
      params: MemoryUpdateRequest,
    ): Promise<ClientResult<MemoryUpdateResponse>> {
      return request<MemoryUpdateResponse>(
        baseUrl,
        apiKey,
        "POST",
        "/api/v1/context/memory/update",
        params,
      );
    },
  };
}

export type AlchemystClient = ReturnType<typeof createClient>;
