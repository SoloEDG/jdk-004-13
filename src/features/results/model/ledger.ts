import type { GameDoc, FrameEvents, RunRecord } from "../../../shared/types";
import { configThreat } from "../../waves/model/formation";
export function applyEvents(doc: GameDoc, events: FrameEvents): void {
  doc.stats.kills += events.kills.length;
  doc.stats.damage += events.damage;
  doc.stats.taken += events.taken;
  doc.stats.shots += events.shots;
  doc.stats.collected += events.collected;
  for (const weapon of ["pulse", "orbit", "nova"] as const)
    doc.stats.byWeapon[weapon] += events.weaponDamage?.[weapon] || 0;
}
export function makeRecord(doc: GameDoc): RunRecord {
  return {
    id: `${doc.initialSeed}-${Date.now().toString(36)}`,
    duration: doc.time,
    wave: doc.wave,
    level: doc.level,
    kills: doc.stats.kills,
    damage: Math.round(doc.stats.damage),
    weapons: doc.weapons.map((w) => `${w.id}:${w.level}`),
    victory: doc.victory,
    // 按配置版本统计：同一份配置的多局记录可据此聚合对比。
    configVersion: doc.config.version,
    configId: doc.config.configId,
    threat: configThreat(doc.config),
  };
}
