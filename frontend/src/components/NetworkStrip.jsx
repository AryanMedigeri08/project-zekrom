/**
 * NetworkStrip.jsx — Mission Control Signal Health Bar
 */

import React, { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

function getSignalColor(sig) {
  if (sig >= 70) return 'var(--signal-green)';
  if (sig >= 40) return 'var(--signal-amber)';
  return 'var(--signal-red)';
}

function BusStrip({ bus, history }) {
  const sig = bus?.signal_strength ?? 0;
  const isGhost = bus?.is_ghost;
  const sigColor = getSignalColor(sig);
  
  const chartData = useMemo(() => {
    const d = [...(history || [])];
    while (d.length < 20) d.unshift({ time: '', value: 0 });
    return d.slice(-20);
  }, [history]);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '0 16px', flex: 1, minWidth: 0,
    }}>
      {/* Bus label */}
      <span className="font-label-caps" style={{
        fontSize: '12px', color: bus?.color || 'var(--color-text)',
        whiteSpace: 'nowrap',
      }}>
        {bus?.label || '—'}
      </span>

      {/* Mini sparkline */}
      <div style={{ width: '80px', height: '24px', flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`ns-${bus?.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={sigColor} stopOpacity={0.4} />
                <stop offset="95%" stopColor={sigColor} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke={sigColor} strokeWidth={2}
              fill={`url(#ns-${bus?.id})`} isAnimationActive={false} dot={false} 
              style={{ filter: `drop-shadow(0 0 4px ${sigColor})` }}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Signal value or ghost */}
      {isGhost ? (
        <span className="font-label-caps" style={{ fontSize: '12px', color: 'var(--signal-amber)', whiteSpace: 'nowrap', textShadow: '0 0 8px rgba(249, 115, 22, 0.5)' }}>
          ESTIMATED
        </span>
      ) : (
        <span className="font-data-display" style={{ fontSize: '16px', color: sigColor, whiteSpace: 'nowrap', textShadow: `0 0 8px ${sigColor}80` }}>
          {sig}%
        </span>
      )}

      {/* Dead zone indicator */}
      {bus?.in_dead_zone && (
        <span className="font-label-caps glow-cyan" style={{
          fontSize: '10px', color: 'var(--signal-cyan)',
          padding: '2px 6px', borderRadius: '4px',
          background: 'rgba(0, 242, 255, 0.1)', whiteSpace: 'nowrap',
          border: '1px solid var(--signal-cyan)'
        }}>DZ</span>
      )}
    </div>
  );
}

export default function NetworkStrip({ buses, signalHistory }) {
  const busEntries = useMemo(() =>
    Object.entries(buses || {}).sort(([a], [b]) => a.localeCompare(b)),
    [buses]
  );

  // Overall status
  const allSigs = busEntries.map(([, b]) => b.signal_strength ?? 85);
  const avgSig = allSigs.length ? Math.round(allSigs.reduce((a, b) => a + b, 0) / allSigs.length) : 0;
  const ghostCount = busEntries.filter(([, b]) => b.is_ghost).length;

  return (
    <div style={{
      height: '56px',
      display: 'flex',
      alignItems: 'center',
      borderBottom: `1px solid var(--color-border)`,
      background: 'rgba(255, 255, 255, 0.02)',
      flexShrink: 0,
      padding: '0 16px',
      gap: '8px',
    }}>
      {/* Label */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        paddingRight: '16px', borderRight: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <span className="material-symbols-outlined" style={{ 
          fontSize: '24px', 
          color: ghostCount > 0 ? 'var(--signal-amber)' : 'var(--signal-green)',
          textShadow: `0 0 10px ${ghostCount > 0 ? 'var(--signal-amber)' : 'var(--signal-green)'}` 
        }}>
          {ghostCount > 0 ? 'warning' : 'rss_feed'}
        </span>
        <div>
          <div className="font-label-caps" style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.2 }}>
            Network Telemetry
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.2, fontFamily: 'Inter' }}>
            Avg: <span className="font-data-display">{avgSig}%</span> {ghostCount > 0 && `• ${ghostCount} ghost`}
          </div>
        </div>
      </div>

      {/* Per-bus strips */}
      {busEntries.map(([busId, bus]) => (
        <React.Fragment key={busId}>
          <div style={{ width: '1px', height: '32px', background: 'var(--color-border)', flexShrink: 0 }} />
          <BusStrip bus={{ ...bus, id: busId }} history={signalHistory?.[busId]} />
        </React.Fragment>
      ))}
    </div>
  );
}
