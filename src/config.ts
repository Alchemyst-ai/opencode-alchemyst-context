import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createClient } from "./client";
import type { AlchemystClient } from "./client";

export type Config = {
  apiKey: string | null;
  baseUrl: string;
  defaultScope: "internal" | "external";
  groupName: string[];
  projectName: string;
};

const CONFIG_DIR = join(homedir(), ".config", "opencode-alchemyst");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

type ConfigFile = {
  apiKey?: string;
  baseUrl?: string;
  defaultScope?: "internal" | "external";
  groupName?: string[];
};

export function getConfigPath(): string {
  return CONFIG_PATH;
}

function readConfigFile(): ConfigFile {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = readFileSync(CONFIG_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      let groupName: string[] | undefined;
      if (Array.isArray(parsed.groupName)) {
        groupName = parsed.groupName;
      } else if (typeof parsed.groupName === "string") {
        groupName = [parsed.groupName];
      }
      return {
        apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : undefined,
        baseUrl:
          typeof parsed.baseUrl === "string" ? parsed.baseUrl : undefined,
        defaultScope:
          parsed.defaultScope === "external" || parsed.defaultScope === "internal"
            ? parsed.defaultScope
            : undefined,
        groupName,
      };
    }
  } catch {
    // corrupt or missing file — treat as empty
  }
  return {};
}

function writeConfigFile(data: ConfigFile): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function parseScope(
  value: string | undefined,
): "internal" | "external" | undefined {
  if (value === "internal" || value === "external") return value;
  return undefined;
}

function resolveGroupName(
  envValue: string | undefined,
  fileValue: string[] | undefined,
  projectName: string,
): string[] {
  if (envValue) return [envValue, projectName];
  if (fileValue && fileValue.length > 0) return fileValue;
  return ["opencode", projectName];
}

export class ConfigStore {
  config: Config;
  client: AlchemystClient | null;

  private constructor(config: Config) {
    this.config = config;
    this.client = config.apiKey ? createClient(config) : null;
  }

  static create(projectName?: string): ConfigStore {
    const configFile = readConfigFile();
    const pn = projectName ?? "unknown";

    const config: Config = {
      apiKey: configFile.apiKey ?? null,
      baseUrl:
        process.env.ALCHEMYST_BASE_URL ??
        configFile.baseUrl ??
        "https://platform-backend.getalchemystai.com",
      defaultScope:
        parseScope(process.env.ALCHEMYST_DEFAULT_SCOPE) ??
        parseScope(configFile.defaultScope) ??
        "internal",
      groupName: resolveGroupName(
        process.env.ALCHEMYST_GROUP_NAME,
        configFile.groupName,
        pn,
      ),
      projectName: pn,
    };

    return new ConfigStore(config);
  }

  setApiKey(
    apiKey: string,
    overrides?: Partial<
      Pick<Config, "baseUrl" | "defaultScope" | "groupName">
    >,
  ): void {
    this.config = { ...this.config, apiKey, ...overrides };
    this.client = createClient(this.config);
    writeConfigFile({
      apiKey,
      baseUrl: this.config.baseUrl,
      defaultScope: this.config.defaultScope,
      groupName: this.config.groupName,
    });
  }

  static fromConfig(config: Config): ConfigStore {
    return new ConfigStore(config);
  }
}
