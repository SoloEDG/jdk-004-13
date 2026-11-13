import type { GameDoc } from "../../../shared/types";
import { distance, normalize } from "../../../shared/math";
import { spawnEnemy } from "../lib/spawn";
import { ENEMY_CATALOG, WAVE_DURATION, TOTAL_WAVES } from "./catalog";

export function stepWaves(doc: GameDoc, dt: number): void {
  if (doc.victory) return;
  // 升级冻结（以及暂停）期间不推进波次、不消耗出生队列。
  if (doc.phase !== "playing") return;

  if (doc.wave === 0) {
    doc.wave = 1;
    doc.notice = "第 1 波 · 信号已连接";
  }

  doc.waveTime += dt;
  let finalWaveElapsed = false;
  while (doc.waveTime >= WAVE_DURATION) {
    doc.waveTime -= WAVE_DURATION;
    if (doc.wave >= TOTAL_WAVES) {
      // 最后一波时间走完：队列清空才判定撤离，迟到的敌人先全部入场。
      finalWaveElapsed = true;
      doc.waveTime = 0;
      break;
    }
    doc.wave++;
    doc.notice = `第 ${doc.wave} 波 · 威胁升级`;
  }

  // 编队预算决定出生序列：按进入时间出队。
  // 战场达到敌人上限时，任务留在队列等待后续帧，绝不丢弃预算。
  while (doc.spawnQueue.length > 0 && doc.spawnQueue[0].at <= doc.time) {
    if (doc.enemies.length >= doc.config.enemyCap) break;
    const entry = doc.spawnQueue.shift()!;
    doc.enemies.push(spawnEnemy(doc, entry.kind));
    doc.entered[entry.wave - 1][entry.kind]++;
  }

  if (finalWaveElapsed && doc.spawnQueue.length === 0) {
    doc.victory = true;
    doc.notice = "全部波次已清除";
    return;
  }

  for (const enemy of doc.enemies) {
    const toward = normalize(doc.player.x - enemy.x, doc.player.y - enemy.y),
      range = distance(enemy, doc.player);
    const standOff =
      enemy.kind === "shooter" ? (range < 170 ? -1 : range < 245 ? 0 : 1) : 1;
    const speed = ENEMY_CATALOG[enemy.kind].speed * (1 + doc.wave * 0.035);
    enemy.x += toward.x * speed * standOff * dt;
    enemy.y += toward.y * speed * standOff * dt;
    enemy.cooldown -= dt;
    if (enemy.kind !== "chaser" && enemy.cooldown <= 0) {
      enemy.cooldown = enemy.kind === "elite" ? 1.8 : 2.6;
      const angle = Math.atan2(toward.y, toward.x),
        spread = enemy.kind === "elite" ? [-0.24, 0, 0.24] : [0];
      for (const offset of spread) {
        doc.bullets.push({
          id: doc.nextId++,
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(angle + offset) * 160,
          vy: Math.sin(angle + offset) * 160,
          radius: 5,
          damage: enemy.kind === "elite" ? 16 : 10,
          life: 5,
          owner: "enemy",
          weapon: "enemy",
          pierce: 0,
          hit: [],
        });
      }
    }
  }
}
