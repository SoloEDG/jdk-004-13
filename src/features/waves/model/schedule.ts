import type {
  EnemyKind,
  SpawnEntry,
  WaveConfigV2,
  WavePlan,
} from "../../../shared/types";
import { ENEMY_KINDS } from "./catalog";
import { WAVE_DURATION } from "./catalog";

/**
 * 单波内某类敌人的进入时刻（相对本波起点的秒数）。
 * 同波敌人在整波时长内均匀分布，首只在波次起点立即进入。
 */
export function kindTimeline(
  plan: WavePlan,
  kind: EnemyKind,
  waveDuration = WAVE_DURATION,
): number[] {
  const count = plan[kind];
  if (count <= 0) return [];
  if (count === 1) return [0];
  return Array.from({ length: count }, (_, i) =>
    round3((i * waveDuration) / (count - 1)),
  );
}

/** 单波的全部出生任务，时间按升序排列。 */
export function buildWaveEntries(
  plan: WavePlan,
  wave: number,
  idOffset: { value: number },
): SpawnEntry[] {
  const start = (wave - 1) * WAVE_DURATION;
  const entries: SpawnEntry[] = [];
  for (const kind of ENEMY_KINDS) {
    for (const offset of kindTimeline(plan, kind)) {
      entries.push({
        id: idOffset.value++,
        wave,
        at: round3(start + offset),
        kind,
      });
    }
  }
  return entries.sort((a, b) => a.at - b.at);
}

/**
 * 编队预算决定实际出生序列：把 8 波编队展开为按绝对进入时间
 * 全局排序的队列，开局时一次性构建，运行中只出队不重排。
 */
export function buildSpawnQueue(config: WaveConfigV2): SpawnEntry[] {
  const idOffset = { value: 1 };
  const queue: SpawnEntry[] = [];
  config.waves.forEach((plan, index) => {
    queue.push(...buildWaveEntries(plan, index + 1, idOffset));
  });
  return queue.sort((a, b) => a.at - b.at || a.id - b.id);
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
