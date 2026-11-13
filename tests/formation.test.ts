import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun } from "../src/shared/createRun";
import { simulate } from "../src/app/simulate";
import { stepWaves } from "../src/features/waves";
import { stepResults } from "../src/features/results";
import {
  ENEMY_LIMIT,
  buildDefaultConfig,
  buildSpawnQueue,
  configThreat,
  editPlan,
  importConfig,
  migrateV1,
  planTotal,
  validateConfig,
  waveCost,
} from "../src/features/waves";
import type {
  FrameEvents,
  Input,
  WaveConfigV1,
  WaveConfigV2,
} from "../src/shared/types";

const input: Input = { x: 0, y: 0, aim: { x: 700, y: 325 }, firing: false };
const events = (): FrameEvents => ({
  kills: [],
  damage: 0,
  taken: 0,
  shots: 0,
  collected: 0,
});

test("default formation keeps the legacy average strength (544 spawns)", () => {
  const config = buildDefaultConfig();
  const total = config.waves.reduce((sum, plan) => sum + planTotal(plan), 0);
  assert.equal(total, 544);
  assert.equal(buildSpawnQueue(config).length, 544);
});

test("spawn queue is globally ordered by absolute entry time", () => {
  const queue = buildSpawnQueue(buildDefaultConfig());
  for (let i = 1; i < queue.length; i++)
    assert.ok(queue[i].at >= queue[i - 1].at);
  assert.equal(queue[0].at, 0);
  assert.equal(queue[0].wave, 1);
});

test("validator rejects over-budget and over-elite configs as a whole", () => {
  const overBudget = buildDefaultConfig();
  overBudget.budgetCap[0] = 1;
  assert.equal(validateConfig(overBudget)?.code, "over-budget");

  const overElite = buildDefaultConfig();
  overElite.eliteCap = 2;
  assert.equal(validateConfig(overElite)?.code, "over-elite");

  const negative = buildDefaultConfig();
  negative.waves[0].chaser = -3;
  assert.equal(validateConfig(negative)?.code, "negative-budget");

  const broken = { ...buildDefaultConfig(), waves: [] } as unknown as WaveConfigV2;
  assert.equal(validateConfig(broken)?.code, "shape");

  assert.equal(validateConfig(buildDefaultConfig()), null);
});

test("editPlan refuses a single illegal adjustment and keeps the config intact", () => {
  const config = buildDefaultConfig();
  const snapshot = JSON.stringify(config);
  const result = editPlan(config, 0, "elite", 999);
  assert.ok(result.error);
  assert.equal(JSON.stringify(result.config), snapshot);

  const legal = editPlan(config, 0, "chaser", 1);
  assert.equal(legal.error, undefined);
  assert.equal(legal.config.waves[0].chaser, config.waves[0].chaser + 1);
});

test("a full battlefield keeps spawn entries queued instead of dropping budget", () => {
  const d = createRun();
  d.phase = "playing";
  const due = d.spawnQueue.filter((e) => e.at <= d.time);
  assert.ok(due.length >= 1);
  // 占满战场上限，所有到点任务必须留在队列。
  d.enemies = Array.from({ length: ENEMY_LIMIT }, (_, i) => ({
    id: 1000 + i,
    kind: "chaser" as const,
    x: 0,
    y: 0,
    hp: 5,
    maxHp: 5,
    radius: 8,
    cooldown: 0,
  }));
  const queuedBefore = d.spawnQueue.length;
  stepWaves(d, 1 / 60);
  assert.equal(d.spawnQueue.length, queuedBefore);
  assert.equal(d.enemies.length, ENEMY_LIMIT);
  // 再推进若干帧，队列依旧不被消耗（预算不丢弃）。
  stepWaves(d, 1 / 60);
  stepWaves(d, 1 / 60);
  assert.equal(d.spawnQueue.length, queuedBefore);
  // 腾出一个位置后，队首任务立即进入且 entered 计数同步。
  d.enemies.pop();
  stepWaves(d, 0);
  assert.equal(d.spawnQueue.length, queuedBefore - 1);
  assert.ok(
    d.entered[0].chaser + d.entered[0].shooter + d.entered[0].elite === 1,
  );
});

test("upgrade freeze never advances waves or consumes the spawn queue", () => {
  const d = createRun();
  d.phase = "upgrade";
  const queuedBefore = d.spawnQueue.length;
  const waveBefore = d.wave;
  const timeBefore = d.time;
  simulate(d, input, 1 / 60);
  assert.equal(d.spawnQueue.length, queuedBefore);
  assert.equal(d.wave, waveBefore);
  assert.equal(d.time, timeBefore);
});

test("restart builds a fresh queue and never inherits unfinished spawn tasks", () => {
  const first = createRun();
  first.phase = "playing";
  // 消耗一部分出生任务。
  for (let i = 0; i < 120; i++) simulate(first, input, 1 / 60);
  assert.ok(first.spawnQueue.length < buildSpawnQueue(first.config).length);

  const second = createRun(first.initialSeed, first.records, first.config);
  const freshQueue = buildSpawnQueue(first.config);
  assert.equal(second.spawnQueue.length, freshQueue.length);
  assert.deepEqual(second.spawnQueue, freshQueue);
  assert.equal(second.enemies.length, 0);
  assert.equal(second.time, 0);
  assert.equal(second.wave, 0);
});

test("legacy v1 import preserves average strength and passes validation", () => {
  const legacy: WaveConfigV1 = {
    version: 1,
    waveDuration: 30,
    totalWaves: 8,
    enemyCap: 180,
    spawnRateBase: 1.05,
    spawnRatePerWave: 0.27,
    shooterFromWave: 2,
    shooterChance: 0.28,
    eliteFromWave: 3,
    eliteChance: 0.08,
  };
  const result = migrateV1(legacy);
  assert.equal(result.ok, true);
  const migrated = result.config!;
  const total = migrated.waves.reduce((s, p) => s + planTotal(p), 0);
  assert.equal(total, 544);
  assert.equal(validateConfig(migrated), null);
  assert.equal(migrated.waves[0].shooter, 0);
  assert.equal(migrated.waves[0].elite, 0);
  assert.ok(migrated.waves[7].elite > 0);
});

test("import rejects illegal legacy parameters and over-cap payloads entirely", () => {
  const badLegacy = {
    version: 1,
    waveDuration: 30,
    totalWaves: 8,
    enemyCap: 180,
    spawnRateBase: -4,
    spawnRatePerWave: 0.27,
    shooterFromWave: 2,
    shooterChance: 0.28,
    eliteFromWave: 3,
    eliteChance: 0.08,
  } as WaveConfigV1;
  assert.equal(migrateV1(badLegacy).ok, false);

  const overCap = buildDefaultConfig();
  overCap.eliteCap = 1;
  assert.equal(importConfig(JSON.stringify(overCap)).ok, false);

  assert.equal(importConfig("{not json").ok, false);
  assert.equal(importConfig(JSON.stringify({ version: 9 })).ok, false);
});

test("import accepts a valid v2 payload and round-trips through export", () => {
  const config = buildDefaultConfig();
  const result = importConfig(JSON.stringify(config));
  assert.equal(result.ok, true);
  assert.deepEqual(result.config, config);
});

test("results are tagged with the active config version and threat value", () => {
  const d = createRun();
  d.phase = "playing";
  d.player.hp = 0;
  stepResults(d, events());
  const record = d.records[0];
  assert.equal(record.configVersion, 2);
  assert.equal(record.configId, d.config.configId);
  assert.equal(record.threat, configThreat(d.config));
});

test("threat and budget helpers reflect formation edits", () => {
  const config = buildDefaultConfig();
  const before = waveCost(config.waves[0]);
  const edited = editPlan(config, 0, "shooter", 2).config;
  assert.equal(waveCost(edited.waves[0]), before + 4);
});
