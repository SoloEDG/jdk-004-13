import type {
  EnemyKind,
  WaveConfigV1,
  WaveConfigV2,
  WavePlan,
} from "../../../shared/types";
import {
  BUDGET_CAP,
  DEFAULT_CONFIG_ID,
  ELITE_CAP_PER_WAVE,
  ENEMY_KINDS,
  ENEMY_LIMIT,
  KIND_BUDGET,
  KIND_THREAT,
  TOTAL_WAVES,
  WAVE_DURATION,
  buildDefaultConfig,
} from "./catalog";

export type ConfigErrorCode =
  | "shape"
  | "negative-budget"
  | "over-budget"
  | "over-elite";

export interface ConfigError {
  code: ConfigErrorCode;
  message: string;
  wave?: number;
}

export interface ConfigImport {
  ok: boolean;
  config?: WaveConfigV2;
  error?: ConfigError;
}

export function emptyPlan(): WavePlan {
  return { chaser: 0, shooter: 0, elite: 0 };
}

export function waveCost(plan: WavePlan): number {
  return (Object.keys(KIND_BUDGET) as EnemyKind[]).reduce(
    (sum, kind) => sum + plan[kind] * KIND_BUDGET[kind],
    0,
  );
}

export function waveThreat(plan: WavePlan): number {
  return ENEMY_KINDS.reduce(
    (sum, kind) => sum + plan[kind] * KIND_THREAT[kind],
    0,
  );
}

export function planTotal(plan: WavePlan): number {
  return plan.chaser + plan.shooter + plan.elite;
}

export function configThreat(config: WaveConfigV2): number {
  return config.waves.reduce((sum, plan) => sum + waveThreat(plan), 0);
}

export function configCost(config: WaveConfigV2): number {
  return config.waves.reduce((sum, plan) => sum + waveCost(plan), 0);
}

function isFiniteNonNegativeInt(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0
  );
}

function isValidPlanShape(value: unknown): value is WavePlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Record<string, unknown>;
  return ENEMY_KINDS.every(
    (kind) => typeof plan[kind] === "number" && Number.isFinite(plan[kind]),
  );
}

/**
 * 整份校验：任何一波出现负预算、超预算或超额精英都拒绝整份配置，
 * 不做部分接受。错误按规则优先级返回第一条。
 */
export function validateConfig(config: WaveConfigV2): ConfigError | null {
  if (
    config.version !== 2 ||
    !Array.isArray(config.waves) ||
    config.waves.length !== TOTAL_WAVES ||
    !Array.isArray(config.budgetCap) ||
    config.budgetCap.length !== TOTAL_WAVES ||
    !isFiniteNonNegativeInt(config.eliteCap) ||
    !isFiniteNonNegativeInt(config.enemyCap) ||
    typeof config.configId !== "string" ||
    !config.waves.every(isValidPlanShape) ||
    !config.budgetCap.every((cap) => isFiniteNonNegativeInt(cap))
  ) {
    return { code: "shape", message: "配置结构不完整或字段类型错误" };
  }
  for (let i = 0; i < config.waves.length; i++) {
    const plan = config.waves[i];
    const wave = i + 1;
    // 负预算：任何一类敌人数量为负即拒绝整份配置。
    if (ENEMY_KINDS.some((kind) => plan[kind] < 0)) {
      return {
        code: "negative-budget",
        wave,
        message: `第 ${wave} 波出现负预算，整份配置已拒绝`,
      };
    }
    if (ENEMY_KINDS.some((kind) => !Number.isInteger(plan[kind]))) {
      return {
        code: "shape",
        wave,
        message: `第 ${wave} 波敌人数量必须为整数`,
      };
    }
  }
  for (let i = 0; i < config.waves.length; i++) {
    const plan = config.waves[i];
    const wave = i + 1;
    if (waveCost(plan) > config.budgetCap[i]) {
      return {
        code: "over-budget",
        wave,
        message: `第 ${wave} 波预算 ${waveCost(plan)} 超过上限 ${config.budgetCap[i]}，整份配置已拒绝`,
      };
    }
  }
  for (let i = 0; i < config.waves.length; i++) {
    const plan = config.waves[i];
    const wave = i + 1;
    if (plan.elite > config.eliteCap) {
      return {
        code: "over-elite",
        wave,
        message: `第 ${wave} 波精英 ${plan.elite} 超过上限 ${config.eliteCap}，整份配置已拒绝`,
      };
    }
  }
  return null;
}

/**
 * 开局前的单次编队调整：先复制再试算，任何一次违规都保持原配置不变。
 */
export function editPlan(
  config: WaveConfigV2,
  waveIndex: number,
  kind: EnemyKind,
  delta: number,
): { config: WaveConfigV2; error?: ConfigError } {
  if (waveIndex < 0 || waveIndex >= config.waves.length || delta === 0)
    return { config };
  const next: WaveConfigV2 = {
    ...config,
    waves: config.waves.map((plan) => ({ ...plan })),
    budgetCap: [...config.budgetCap],
  };
  const current = next.waves[waveIndex][kind];
  const value = current + delta;
  if (value < 0) {
    return {
      config,
      error: {
        code: "negative-budget",
        wave: waveIndex + 1,
        message: `第 ${waveIndex + 1} 波不能再减少 ${labelOf(kind)}`,
      },
    };
  }
  next.waves[waveIndex][kind] = value;
  const error = validateConfig(next);
  return error ? { config, error } : { config: next };
}

export function labelOf(kind: EnemyKind): string {
  return kind === "chaser" ? "追猎者" : kind === "shooter" ? "游击者" : "精英体";
}

/**
 * 旧版固定节奏配置迁移：按原出生速率与概率把每波展开为整数编队，
 * 保持原来的平均强度；迁移结果仍需通过当前预算与精英上限校验。
 */
export function migrateV1(raw: WaveConfigV1): ConfigImport {
  if (
    !raw ||
    typeof raw !== "object" ||
    raw.version !== 1 ||
    !Number.isFinite(raw.waveDuration) ||
    !Number.isFinite(raw.totalWaves) ||
    !Number.isFinite(raw.enemyCap) ||
    !Number.isFinite(raw.spawnRateBase) ||
    !Number.isFinite(raw.spawnRatePerWave) ||
    !Number.isFinite(raw.shooterFromWave) ||
    !Number.isFinite(raw.shooterChance) ||
    !Number.isFinite(raw.eliteFromWave) ||
    !Number.isFinite(raw.eliteChance) ||
    raw.totalWaves !== TOTAL_WAVES ||
    raw.waveDuration !== WAVE_DURATION ||
    raw.enemyCap <= 0 ||
    raw.spawnRateBase < 0 ||
    raw.spawnRatePerWave < 0 ||
    raw.shooterChance < 0 ||
    raw.eliteChance < 0 ||
    raw.shooterChance + raw.eliteChance > 1
  ) {
    return {
      ok: false,
      error: {
        code: "shape",
        message: "旧版配置参数不完整或取值非法，整份配置已拒绝",
      },
    };
  }
  const waves: WavePlan[] = [];
  for (let i = 0; i < raw.totalWaves; i++) {
    const wave = i + 1;
    const expected =
      raw.waveDuration *
      (raw.spawnRateBase + wave * raw.spawnRatePerWave);
    // 每波总数严格等于旧出生速率的取整期望，保持原平均强度。
    const total = Math.round(expected);
    const eliteChance = wave >= raw.eliteFromWave ? raw.eliteChance : 0;
    const shooterChance = wave >= raw.shooterFromWave ? raw.shooterChance : 0;
    let elite = Math.round(total * eliteChance);
    let shooter = Math.round(total * shooterChance);
    // 取整误差由追猎者吸收，保证三类数量之和恒等于该波总期望。
    if (elite + shooter > total) {
      shooter = Math.max(0, total - elite);
      elite = Math.min(elite, total);
    }
    const chaser = Math.max(0, total - elite - shooter);
    waves.push({ chaser, shooter, elite });
  }
  const migrated: WaveConfigV2 = {
    version: 2,
    configId: raw.configId
      ? `${raw.configId}.migrated-v1`
      : "legacy.formation.migrated-v1",
    waves,
    budgetCap: [...BUDGET_CAP],
    eliteCap: ELITE_CAP_PER_WAVE,
    enemyCap: ENEMY_LIMIT,
  };
  const error = validateConfig(migrated);
  return error ? { ok: false, error } : { ok: true, config: migrated };
}

/**
 * 导入入口：支持当前 V2 与旧版 V1；任何校验失败都拒绝整份配置。
 */
export function importConfig(jsonText: string): ConfigImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return {
      ok: false,
      error: { code: "shape", message: "JSON 解析失败，整份配置已拒绝" },
    };
  }
  if (!parsed || typeof parsed !== "object") {
    return {
      ok: false,
      error: { code: "shape", message: "配置根节点必须是对象" },
    };
  }
  const version = (parsed as { version?: unknown }).version;
  if (version === 1) return migrateV1(parsed as WaveConfigV1);
  if (version === 2) {
    const config = parsed as WaveConfigV2;
    const error = validateConfig(config);
    return error ? { ok: false, error } : { ok: true, config };
  }
  return {
    ok: false,
    error: { code: "shape", message: `未知配置版本：${String(version)}` },
  };
}

export function exportConfig(config: WaveConfigV2): string {
  return JSON.stringify(config, null, 2);
}

export { buildDefaultConfig, DEFAULT_CONFIG_ID };
