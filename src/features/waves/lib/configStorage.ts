import type { WaveConfigV2 } from "../../../shared/types";
import { buildDefaultConfig } from "../model/catalog";
import { validateConfig } from "../model/formation";

const STORAGE_KEY = "void-signal.formation.v2";

export function loadConfig(): WaveConfigV2 {
  try {
    if (typeof window === "undefined") return buildDefaultConfig();
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaultConfig();
    const parsed = JSON.parse(raw) as WaveConfigV2;
    return validateConfig(parsed) ? buildDefaultConfig() : parsed;
  } catch {
    return buildDefaultConfig();
  }
}

export function saveConfig(config: WaveConfigV2): boolean {
  if (validateConfig(config)) return false;
  try {
    if (typeof window !== "undefined")
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedConfig(): void {
  try {
    if (typeof window !== "undefined")
      window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* 存储不可用时静默降级为默认配置。 */
  }
}
