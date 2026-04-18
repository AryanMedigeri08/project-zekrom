/**
 * AIDecisionLog — Rich expandable AI decision log panel.
 *
 * Color-coded by decision type, collapsible reasoning sections,
 * confidence bars, and expected duration.
 */

import React, { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000';

const BORDER_COLORS = {
  'Ghost Bus Activated': 'border-l-purple-500',
  'Buffer Flush Executed': 'border-l-green-500',
  'Ping Interval Adjusted': 'border-l-yellow-500',
  'ETA Recalculated': 'border-l-blue-500',
  'Dead Zone Entry': 'border-l-red-500',
};

const BG_COLORS = {
  'Ghost Bus Activated': 'bg-purple-50/60',
  'Buffer Flush Executed': 'bg-green-50/60',
  'Ping Interval Adjusted': 'bg-yellow-50/60',
  'ETA Recalculated': 'bg-blue-50/60',
  'Dead Zone Entry': 'bg-red-50/60',
};

const BotIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>
);

function ConfidenceBar({ value }) {
  const pct = Math.round((value || 0) * 100);
  const color = pct >= 75 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[9px] font-bold tabular-nums" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function AIDecisionLog() {
  const [entries, setEntries] = useState([]);
  const [expandedIdx, setExpandedIdx] = useState(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/system-log`);
        if (resp.ok) {
          const data = await resp.json();
          setEntries(data.filter(e => e.explanation).slice(-8));
        }
      } catch { /* */ }
    };
    poll();
    const iv = setInterval(poll, 2000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="card-panel p-3 flex flex-col gap-1.5 h-full overflow-hidden">
      <div className="flex items-center gap-1.5 pb-1 border-b border-gray-100">
        <span className="text-indigo-500"><BotIcon /></span>
        <span className="text-[10px] font-bold text-gray-600 tracking-wide uppercase">AI Decisions</span>
        <span className="ml-auto text-[9px] text-gray-400">{entries.length} events</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1">
        {entries.length === 0 && (
          <p className="text-[10px] text-gray-300 italic text-center py-4">No AI decisions yet</p>
        )}
        {entries.map((entry, i) => {
          const exp = entry.explanation || {};
          const decision = exp.decision || entry.message || '';
          const borderCls = BORDER_COLORS[decision] || 'border-l-gray-300';
          const bgCls = BG_COLORS[decision] || 'bg-gray-50';
          const isExpanded = expandedIdx === i;

          return (
            <div key={i} className={`border-l-[3px] ${borderCls} ${bgCls} rounded-r-lg px-2.5 py-1.5 transition-all`}>
              {/* Header row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-indigo-400"><BotIcon /></span>
                  <span className="text-[9px] font-mono text-gray-400">{entry.timestamp}</span>
                  <span className="text-[10px] font-semibold text-gray-700">{decision}</span>
                  {exp.bus_id && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">
                      {exp.bus_id.replace('bus_0', '').replace('bus_', '')}
                    </span>
                  )}
                </div>
              </div>

              {/* Trigger */}
              {exp.trigger && (
                <p className="text-[9px] text-gray-500 mt-0.5">Trigger: {exp.trigger}</p>
              )}

              {/* Expand toggle */}
              <button onClick={() => setExpandedIdx(isExpanded ? null : i)}
                className="text-[9px] text-indigo-500 font-semibold mt-0.5 hover:text-indigo-700 transition-colors">
                {isExpanded ? '▼ Hide Reasoning' : '▶ View Reasoning'}
              </button>

              {/* Expanded reasoning */}
              {isExpanded && (
                <div className="mt-1.5 pt-1.5 border-t border-gray-200/60 space-y-1.5">
                  {exp.reasoning && (
                    <p className="text-[10px] text-gray-600 leading-relaxed">{exp.reasoning}</p>
                  )}
                  <div className="flex items-center gap-4 flex-wrap">
                    {exp.confidence != null && (
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400">Confidence:</span>
                        <ConfidenceBar value={exp.confidence} />
                      </div>
                    )}
                    {exp.expected_duration && (
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-gray-400">Duration:</span>
                        <span className="text-[10px] font-semibold text-gray-700">{exp.expected_duration}</span>
                      </div>
                    )}
                  </div>
                  {exp.action && (
                    <p className="text-[9px] text-indigo-600 font-medium">Action: {exp.action}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
