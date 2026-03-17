import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

export type LoadedEnvFile = {
  path: string;
  loaded: boolean;
};

/**
 * Load .env.lawmind so LawMind commands use this file as source of truth.
 *
 * Precedence: .env.lawmind overrides process.env when present, so that
 * running from the install dir (e.g. ~/.lawmind/openclaw) always uses
 * the configured keys/URLs instead of stale shell exports (e.g. 127.0.0.1).
 */
export function loadLawMindEnv(cwd = process.cwd()): LoadedEnvFile {
  const envPath = path.resolve(cwd, ".env.lawmind");
  if (!fs.existsSync(envPath)) {
    return { path: envPath, loaded: false };
  }

  dotenv.config({
    path: envPath,
    override: true,
  });
  return { path: envPath, loaded: true };
}
