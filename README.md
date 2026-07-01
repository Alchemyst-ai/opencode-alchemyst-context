# opencode-alchemyst-context

opencode plugin for AlchemystAI Context Layer — gives opencode agents persistent, retrievable memory backed by Alchemyst.

## Install

```bash
# via npm
npm install opencode-alchemyst-context

# via GitHub
npm install https://github.com/Alchemyst-ai/opencode-alchemyst-context.git
```

Add to `opencode.json`:

```json
{
  "plugin": ["opencode-alchemyst-context"]
}
```

## Setup

On first use, tell the agent to configure the API key:

```
alchemyst_configure: set my key to <your-jwt-bearer-token>
```

This saves your configuration to `~/.config/opencode-alchemyst/config.json`.
It persists across sessions — you only need to do this once.

You can also pre-configure by creating the file manually:

```json
{
  "apiKey": "your-jwt-bearer-token",
  "groupName": ["opencode", "my-project"]
}
```

The config file stores all connection settings (not just the key). Environment
variables take priority over saved values — useful for per-session overrides
without editing the file.

| Env var | Required | Default | Priority |
|---|---|---|---|
| `ALCHEMYST_BASE_URL` | no | `https://platform-backend.getalchemystai.com` | overrides `config.json` |
| `ALCHEMYST_DEFAULT_SCOPE` | no | `internal` | overrides `config.json` |
| `ALCHEMYST_GROUP_NAME` | no | `opencode` (first element) | overrides `config.json` |

## Tools

### `alchemyst_configure`

Set the Alchemyst API key and optionally override connection settings.
Required before using any other tool.

```
apiKey: "your-jwt-bearer-token"
baseUrl: "https://staging.example.com"       # optional
defaultScope: "external"                      # optional
groupName: ["my-team", "project-x"]           # optional, string[]
```

All values are saved to `~/.config/opencode-alchemyst/config.json`. Prompts
you for permission before saving. Environment variables for the same settings
will override saved values.

### `alchemyst_context_search`

Search stored context for relevant documents.

```
query: "what did we decide about authentication?"
```

Returns top results with relevance scores. Use when you need to check if
decisions or reference material already exist before answering.

### `alchemyst_context_add`

Save a decision, snippet, or convention to context.

```
content: "We decided to use Auth0 for all customer-facing auth."
context_type: "instruction"
```

Runs content through a security guard (blocking keys, tokens, passwords)
before sending. Returns the new context ID on success.

### `alchemyst_memory_add`

Persist conversation turns keyed by session ID.

```
contents: [{ content: "User asked about deployment pipeline..." }]
```

Session ID is pulled automatically from the opencode session — the model
cannot spoof or collide session IDs.

### `alchemyst_memory_update`

Update previously saved memory entries for the current session.

### `alchemyst_context_ask`

Ask a grounded question and get a synthesized answer.

```
query: "What's our policy on dependency versions?"
steeringPrompt: "answer in one sentence"
```

## Security

The plugin includes a heuristic outbound content guard that checks for:

- Private key headers (`BEGIN RSA PRIVATE KEY`, etc.)
- AWS access keys (`AKIA...`)
- OpenAI-style API keys (`sk-...`)
- GitHub tokens (`ghp_...`, `gho_...`, `ghu_...`)
- Generic `api_key` assignments
- `SECRET`/`TOKEN`/`PASSWORD` environment assignments

**This is a blunt heuristic, not a compliance control.** Matched content is
blocked before any network request, and the tool returns a clear message
about which category was detected. No matched text is echoed back.

## Credential handling

The API key is stored in `~/.config/opencode-alchemyst/config.json` with
restricted permissions (0600). It is never logged, included in error
messages, or echoed to the model. Use the `alchemyst_configure` tool to set
or update the key at runtime — no environment variable needed.

If no key is configured, the plugin still loads but every tool returns a
clear error message instead of crashing the session.

## Development

```bash
# Install deps
npm install

# Typecheck
npm run typecheck

# Test
npm test

# Build
npm run build
```

## License

MIT
