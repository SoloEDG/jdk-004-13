import type { GameDoc } from "../../../shared/types";
import { SlidersHorizontal } from "lucide-react";
import {
  ENEMY_CATALOG,
  ENEMY_KINDS,
  TOTAL_WAVES,
  WAVE_DURATION,
} from "../model/catalog";
import {
  configThreat,
  labelOf,
  planTotal,
  waveCost,
} from "../model/formation";

interface Props {
  doc: GameDoc;
  onEditFormation?: () => void;
}

export function WavePanel({ doc, onEditFormation }: Props) {
  const currentWave = Math.max(1, doc.wave);
  const waveIndex = currentWave - 1;
  const plan = doc.config.waves[waveIndex];
  const enteredPlan = doc.entered[waveIndex] ?? {
    chaser: 0,
    shooter: 0,
    elite: 0,
  };
  const enteredCount = planTotal(enteredPlan);
  const plannedCount = planTotal(plan);
  const queuedCount = doc.spawnQueue.length;

  return (
    <section className="panel">
      <div className="section-caption">
        <span>波次进程</span>
        <span className="badge">{TOTAL_WAVES} WAVES</span>
      </div>
      <div className="wave-num mono">
        {currentWave.toString().padStart(2, "0")}
        <span>/ {TOTAL_WAVES.toString().padStart(2, "0")}</span>
      </div>
      <div className="wave-steps">
        {Array.from({ length: TOTAL_WAVES }, (_, i) => (
          <i key={i} className={i < currentWave ? "active" : ""} />
        ))}
      </div>
      <div className="section-caption muted">
        <span>
          {doc.wave < 3
            ? "外围侦察群"
            : doc.wave < 6
              ? "重装突击群"
              : "深空精英群"}
        </span>
        <span className="mono">
          {Math.max(0, WAVE_DURATION - doc.waveTime).toFixed(0)}s
        </span>
      </div>
      <div className="bar">
        <i style={{ width: `${(doc.waveTime / WAVE_DURATION) * 100}%` }} />
      </div>

      <div className="formation-status">
        <div className="section-caption">
          <span>本波编队</span>
          <span className="mono muted">
            预算 {waveCost(plan)}/{doc.config.budgetCap[waveIndex]}
          </span>
        </div>
        {ENEMY_KINDS.map((kind) => (
          <div className="formation-row" key={kind}>
            <i
              className="formation-dot"
              style={{ background: ENEMY_CATALOG[kind].color }}
            />
            <span>{labelOf(kind)}</span>
            <strong className="mono">
              {enteredPlan[kind]}
              <small> / {plan[kind]}</small>
            </strong>
          </div>
        ))}
      </div>

      <div className="queue-status">
        <div>
          <span className="status-dot" /> 已进入
          <strong className="mono">{enteredCount}</strong>
        </div>
        <div>
          <span className="status-dot idle" /> 排队中
          <strong className="mono">{queuedCount}</strong>
        </div>
      </div>
      <div className="queue-status threat-line">
        <div>
          本波 <strong className="mono">{plannedCount}</strong> 只
        </div>
        <div>
          配置威胁 <strong className="mono">{configThreat(doc.config)}</strong>
        </div>
      </div>

      <p className="tiny">
        每 {WAVE_DURATION} 秒进入新波次。满员时敌人留在队列等待，不会丢失预算。
      </p>
      {doc.phase === "ready" && onEditFormation && (
        <button className="outline formation-edit" onClick={onEditFormation}>
          <SlidersHorizontal size={14} /> 调整编队预算
        </button>
      )}
    </section>
  );
}
