import type { EnemyKind, WaveConfigV2, WavePlan } from "../../../shared/types";

export const WAVE_DURATION = 30;
export const TOTAL_WAVES = 8;
// 战场同时可容纳的敌人上限。放不下的出生任务留在队列，而不是丢弃预算。
export const ENEMY_LIMIT = 180;
// 每波精英数量上限，超额精英的配置会被整份拒绝。
export const ELITE_CAP_PER_WAVE = 8;

export const ENEMY_CATALOG: Record<
  EnemyKind,
  { hp: number; speed: number; radius: number; color: string; label: string }
> = {
  chaser: { hp: 18, speed: 62, radius: 12, color: "#fb7185", label: "追猎者" },
  shooter: { hp: 28, speed: 40, radius: 14, color: "#fbbf24", label: "游击者" },
  elite: { hp: 100, speed: 45, radius: 22, color: "#c084fc", label: "精英体" },
};

// 编队预算：每种敌人占用的预算点数。
export const KIND_BUDGET: Record<EnemyKind, number> = {
  chaser: 1,
  shooter: 2,
  elite: 5,
};

// 威胁值：面板预览与结算统计使用，独立于预算成本。
export const KIND_THREAT: Record<EnemyKind, number> = {
  chaser: 2,
  shooter: 4,
  elite: 12,
};

export const ENEMY_KINDS: EnemyKind[] = ["chaser", "shooter", "elite"];

// 每波预算上限（点数），默认编队之上保留约 20% 调整空间。
export const BUDGET_CAP: number[] = [48, 72, 106, 122, 139, 150, 169, 187];

// 默认编队由旧固定节奏（spawnRate = 1.05 + wave*0.27，
// 第 2 波起 28% 游击者、第 3 波起 8% 精英）按期望值取整展开，
// 与 migrateV1 的输出逐项一致，保持原有平均强度（每波总数=旧速率取整期望）。
export const DEFAULT_WAVES: WavePlan[] = [
  { chaser: 40, shooter: 0, elite: 0 },
  { chaser: 35, shooter: 13, elite: 0 },
  { chaser: 36, shooter: 16, elite: 4 },
  { chaser: 41, shooter: 18, elite: 5 },
  { chaser: 46, shooter: 20, elite: 6 },
  { chaser: 52, shooter: 22, elite: 6 },
  { chaser: 56, shooter: 25, elite: 7 },
  { chaser: 61, shooter: 27, elite: 8 },
];

export const DEFAULT_CONFIG_ID = "formation.default.v2";

export function buildDefaultConfig(): WaveConfigV2 {
  return {
    version: 2,
    configId: DEFAULT_CONFIG_ID,
    waves: DEFAULT_WAVES.map((w) => ({ ...w })),
    budgetCap: [...BUDGET_CAP],
    eliteCap: ELITE_CAP_PER_WAVE,
    enemyCap: ENEMY_LIMIT,
  };
}
