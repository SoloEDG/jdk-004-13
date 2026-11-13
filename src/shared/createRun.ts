import type { GameDoc, RunRecord, WaveConfigV2 } from "./types";
import { buildDefaultConfig } from "../features/waves/model/catalog";
import { buildSpawnQueue } from "../features/waves/model/schedule";
import { emptyPlan } from "../features/waves/model/formation";

export function createRun(
  seed = 204004,
  records: RunRecord[] = [],
  config: WaveConfigV2 = buildDefaultConfig(),
): GameDoc {
  return {
    version: 1,
    seed,
    initialSeed: seed,
    nextId: 1,
    phase: "ready",
    time: 0,
    player: {
      x: 500,
      y: 325,
      hp: 100,
      maxHp: 100,
      speed: 190,
      radius: 12,
      invincible: 0,
    },
    enemies: [],
    bullets: [],
    drops: [],
    weapons: [{ id: "pulse", level: 1, cooldown: 0 }],
    upgrades: {},
    choices: [],
    xp: 0,
    level: 1,
    pendingLevels: 0,
    wave: 0,
    waveTime: 0,
    // 每局按当前配置重建队列，连续重开不会沿用上一局未完成的出生任务。
    config,
    spawnQueue: buildSpawnQueue(config),
    entered: config.waves.map(() => emptyPlan()),
    stats: {
      kills: 0,
      damage: 0,
      taken: 0,
      collected: 0,
      shots: 0,
      byWeapon: { pulse: 0, orbit: 0, nova: 0 },
    },
    records,
    notice: "等待接入战场",
    victory: false,
  };
}
