import { useMemo, useState } from "react";
import { AlertTriangle, Download, RotateCcw, Upload, X } from "lucide-react";
import type { EnemyKind, WaveConfigV2 } from "../../../shared/types";
import {
  ENEMY_CATALOG,
  ENEMY_KINDS,
  KIND_BUDGET,
  KIND_THREAT,
  TOTAL_WAVES,
  WAVE_DURATION,
  buildDefaultConfig,
} from "../model/catalog";
import {
  configCost,
  configThreat,
  editPlan,
  exportConfig,
  importConfig,
  labelOf,
  planTotal,
  waveCost,
  waveThreat,
} from "../model/formation";
import { kindTimeline } from "../model/schedule";

interface Props {
  config: WaveConfigV2;
  onApply: (next: WaveConfigV2) => void;
  onSave: (next: WaveConfigV2) => void;
  onClose: () => void;
}

export function FormationEditor({ config, onApply, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<WaveConfigV2>(config);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  const totals = useMemo(
    () => ({
      cost: configCost(draft),
      threat: configThreat(draft),
      enemies: draft.waves.reduce((sum, plan) => sum + planTotal(plan), 0),
    }),
    [draft],
  );

  const change = (waveIndex: number, kind: EnemyKind, delta: number) => {
    const result = editPlan(draft, waveIndex, kind, delta);
    if (result.error) setError(result.error.message);
    else {
      setError(null);
      setDraft(result.config);
    }
  };

  const reset = () => {
    setDraft(buildDefaultConfig());
    setError(null);
  };

  const apply = () => {
    onApply(draft);
    onSave(draft);
    onClose();
  };

  const runImport = () => {
    const result = importConfig(importText);
    if (!result.ok || !result.config) {
      setError(result.error?.message ?? "配置导入失败，整份配置已拒绝");
      return;
    }
    setDraft(result.config);
    setError(null);
    setImportOpen(false);
    setImportText("");
  };

  const download = () => {
    const blob = new Blob([exportConfig(draft)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.configId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overlay editor-overlay">
      <div className="editor-dialog">
        <button className="close" onClick={onClose}>
          <X size={15} />
        </button>
        <div className="eyebrow">FORMATION BUDGET</div>
        <h2>编队预算 · 出生序列编排</h2>
        <p className="editor-sub">
          调整每波各类敌人数量，预算决定实际出生序列；进入时间在每波 {WAVE_DURATION}{" "}
          秒内均匀分布。仅开局前可编辑。
        </p>

        <div className="editor-summary">
          <div>
            <strong className="mono">{totals.enemies}</strong>
            <small>出生总数</small>
          </div>
          <div>
            <strong className="mono">{totals.cost}</strong>
            <small>总预算点数</small>
          </div>
          <div>
            <strong className="mono">{totals.threat}</strong>
            <small>总威胁值</small>
          </div>
          <div>
            <strong className="mono">{TOTAL_WAVES}</strong>
            <small>波次</small>
          </div>
        </div>

        <div className="editor-legend">
          {ENEMY_KINDS.map((kind) => (
            <span key={kind} className={`legend-dot ${kind}`}>
              <i style={{ background: ENEMY_CATALOG[kind].color }} />
              {ENEMY_CATALOG[kind].label}
              <em>
                成本 {KIND_BUDGET[kind]} · 威胁 {KIND_THREAT[kind]}
              </em>
            </span>
          ))}
        </div>

        <div className="editor-waves">
          {draft.waves.map((plan, waveIndex) => {
            const cost = waveCost(plan);
            const cap = draft.budgetCap[waveIndex];
            const over = cost > cap;
            return (
              <div
                key={waveIndex}
                className={`editor-wave ${over ? "over" : ""}`}
              >
                <div className="editor-wave-head">
                  <strong>第 {waveIndex + 1} 波</strong>
                  <span className={`mono ${over ? "danger" : ""}`}>
                    {cost}/{cap} 预算
                  </span>
                  <span className="mono muted">威胁 {waveThreat(plan)}</span>
                </div>
                <div className="editor-timeline">
                  {ENEMY_KINDS.map((kind) => (
                    <div className="timeline-row" key={kind}>
                      <span className={`timeline-kind ${kind}`}>
                        {labelOf(kind)}
                      </span>
                      <div className="timeline-track">
                        {kindTimeline(plan, kind).map((at, i) => (
                          <i
                            key={i}
                            className={kind}
                            style={{
                              left: `${(at / WAVE_DURATION) * 100}%`,
                              background: ENEMY_CATALOG[kind].color,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="editor-controls">
                  {ENEMY_KINDS.map((kind) => (
                    <div className="stepper" key={kind}>
                      <button
                        aria-label={`减少第${waveIndex + 1}波${labelOf(kind)}`}
                        onClick={() => change(waveIndex, kind, -1)}
                      >
                        −
                      </button>
                      <span className="mono">
                        <i
                          className={`stepper-dot ${kind}`}
                          style={{ background: ENEMY_CATALOG[kind].color }}
                        />
                        {plan[kind]}
                      </span>
                      <button
                        aria-label={`增加第${waveIndex+1}波${labelOf(kind)}`}
                        onClick={() => change(waveIndex, kind, 1)}
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
                {plan.elite > draft.eliteCap && (
                  <div className="editor-wave-error">
                    精英 {plan.elite} 超过上限 {draft.eliteCap}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="editor-banner">
            <AlertTriangle size={14} /> {error}
          </div>
        )}

        {importOpen && (
          <div className="import-box">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="粘贴 V2 编队配置或旧版 V1 固定节奏配置的 JSON…"
              rows={6}
            />
            <div className="import-actions">
              <button className="primary small" onClick={runImport}>
                导入并校验
              </button>
              <button className="ghost" onClick={() => setImportOpen(false)}>
                取消
              </button>
            </div>
          </div>
        )}

        <div className="editor-footer">
          <div className="editor-footer-left">
            <button className="ghost" onClick={() => setImportOpen((v) => !v)}>
              <Upload size={14} /> 导入配置
            </button>
            <button className="ghost" onClick={download}>
              <Download size={14} /> 导出
            </button>
            <button className="ghost" onClick={reset}>
              <RotateCcw size={14} /> 恢复默认
            </button>
          </div>
          <button className="primary" onClick={apply}>
            应用编队并部署
          </button>
        </div>
        <p className="tiny">
          负预算、超预算或超额精英的配置会被整份拒绝；旧版配置导入时保持原平均强度。
        </p>
      </div>
    </div>
  );
}
