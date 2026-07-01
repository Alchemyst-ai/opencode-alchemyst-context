const SECRET_PATTERNS: { pattern: RegExp; category: string }[] = [
  {
    pattern:
      /-----BEGIN\s+(RSA|OPENSSH|EC|DSA|PRIVATE|ENCRYPTED)\s+PRIVATE\s+KEY-----/i,
    category: "private-key",
  },
  { pattern: /(?:AKIA|ASIA)[0-9A-Z]{16}/, category: "aws-access-key" },
  { pattern: /sk-[a-zA-Z0-9]{32,}/, category: "openai-api-key" },
  { pattern: /ghp_[a-zA-Z0-9]{36}/, category: "github-token" },
  { pattern: /gho_[a-zA-Z0-9]{36}/, category: "github-oauth-token" },
  { pattern: /ghu_[a-zA-Z0-9]{36}/, category: "github-user-token" },
  {
    pattern: /api[_-]?key\s*[:=]\s*['"][a-z0-9]{16,}/i,
    category: "api-key",
  },
  {
    pattern:
      /(?:secret|token|password)\s*[:=]\s*['"][a-zA-Z0-9_\-!@#$%^&*()]{8,}/i,
    category: "secret-token",
  },
  {
    pattern:
      /^\s*(?:export\s+)?(?:SECRET|TOKEN|PASSWORD|API_KEY|ACCESS_KEY)\s*=\s*\S+/im,
    category: "env-secret",
  },
];

export type SecurityCheckResult =
  | { blocked: true; category: string }
  | { blocked: false };

export function checkContent(content: string): SecurityCheckResult {
  for (const { pattern, category } of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      return { blocked: true, category };
    }
  }
  return { blocked: false };
}
