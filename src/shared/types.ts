export type Vec = { x: number; y: number };
export type Phase = "ready" | "playing" | "paused" | "upgrade" | "ended";
export type WeaponId = "pulse" | "orbit" | "nova";
export type EnemyKind = "chaser" | "shooter" | "elite";
// 单波编队：三类敌人的显式数量，由编队预算决定实际出生序列。
export interface WavePlan {
  chaser: number;
  shooter: number;
  elite: number;
}
// 队列中的一次出生任务，at 为该局开始后的绝对秒数。
export interface SpawnEntry {
  id: number;
  wave: number;
  at: number;
  kind: EnemyKind;
}
// 当前版本的可视化编队预算配置。
export interface WaveConfigV2 {
  version: 2;
  configId: string;
  waves: WavePlan[];
  budgetCap: number[];
  eliteCap: number;
  enemyCap: number;
}
// 旧版固定节奏配置（连续出生参数），导入时迁移为 V2 并保持平均强度。
export interface WaveConfigV1 {
  version: 1;
  configId?: string;
  waveDuration: number;
  totalWaves: number;
  enemyCap: number;
  spawnRateBase: number;
  spawnRatePerWave: number;
  shooterFromWave: number;
  shooterChance: number;
  eliteFromWave: number;
  eliteChance: number;
}
export interface Player extends Vec {
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  invincible: number;
}
export interface Enemy extends Vec {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  radius: number;
  cooldown: number;
}
export interface Bullet extends Vec {
  id: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  owner: "player" | "enemy";
  weapon: WeaponId | "enemy";
  pierce: number;
  hit: number[];
}
export interface Drop extends Vec {
  id: number;
  kind: "xp" | "heal" | "magnet";
  value: number;
  life: number;
}
export interface Weapon {
  id: WeaponId;
  level: number;
  cooldown: number;
}
export interface Upgrade {
  id: string;
  name: string;
  description: string;
  category: string;
  max: number;
}
export interface RunStats {
  kills: number;
  damage: number;
  taken: number;
  collected: number;
  shots: number;
  byWeapon: Record<WeaponId, number>;
}
export interface RunRecord {
  id: string;
  duration: number;
  wave: number;
  level: number;
  kills: number;
  damage: number;
  weapons: string[];
  victory: boolean;
  // 按配置版本统计：旧记录缺省为 v1 固定节奏。
  configVersion?: number;
  configId?: string;
  threat?: number;
}
export interface GameDoc {
  version: 1;
  seed: number;
  initialSeed: number;
  nextId: number;
  phase: Phase;
  time: number;
  player: Player;
  enemies: Enemy[];
  bullets: Bullet[];
  drops: Drop[];
  weapons: Weapon[];
  upgrades: Record<string, number>;
  choices: string[];
  xp: number;
  level: number;
  pendingLevels: number;
  wave: number;
  waveTime: number;
  // 编队配置（开局前可调整），出生队列由它展开且每局重建。
  config: WaveConfigV2;
  spawnQueue: SpawnEntry[];
  // 已进入战场的敌人，按波次与种类计数，供面板与战场同步显示。
  entered: WavePlan[];
  stats: RunStats;
  records: RunRecord[];
  notice: string;
  victory: boolean;
}
export interface Input {
  x: number;
  y: number;
  aim: Vec;
  firing: boolean;
}
export interface KillEvent {
  enemy: Enemy;
  weapon: WeaponId;
}
export interface FrameEvents {
  weaponDamage?: Partial<Record<WeaponId, number>>;
  kills: KillEvent[];
  damage: number;
  taken: number;
  shots: number;
  collected: number;
}
export const WIDTH = 1000;
export const HEIGHT = 650;
