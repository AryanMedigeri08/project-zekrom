/**
 * NetworkStrip.jsx — Professional Clean Telemetry Bar
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
      display: 'flex', alignItems: 'center', gap: '16px',
      padding: '0 20px', flex: 1, minWidth: 0,
    }}>
      {/* Bus label */}
      <span style={{
        fontSize: '13px', fontWeight: 600, color: bus?.color || 'var(--color-text)',
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
                <stop offset="5%" stopColor={sigColor} stopOpacity={0.2} />
                <stop offset="95%" stopColor={sigColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke={sigColor} strokeWidth={2}
              fill={`url(#ns-${bus?.id})`} isAnimationActive={false} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Signal value or ghost */}
      {isGhost ? (
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--signal-amber)', whiteSpace: 'nowrap' }}>
          ETA
        </span>
      ) : (
        <span className="font-data-display" style={{ fontSize: '15px', color: sigColor, whiteSpace: 'nowrap' }}>
          {sig}%
        </span>
      )}

      {/* Dead zone indicator */}
      {bus?.in_dead_zone && (
        <span style={{
          fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)',
          padding: '2px 6px', borderRadius: '4px',
          background: 'var(--color-border-darker)', whiteSpace: 'nowrap'
        }}>Dead Zone</span>
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
      background: 'rgba(255, 255, 255, 0.4)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      flexShrink: 0,
      padding: '0 16px',
    }}>
      {/* Label */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        paddingRight: '20px', borderRight: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <div style={{ 
          width: '32px', height: '32px', borderRadius: '8px',
          background: ghostCount > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <span className="material-symbols-outlined" style={{ 
            fontSize: '18px', 
            color: ghostCount > 0 ? 'var(--signal-amber)' : 'var(--signal-green)'
          }}>
            {ghostCount > 0 ? 'warning' : 'rss_feed'}
          </span>
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.2 }}>
            Network Telemetry
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: 1.2 }}>
            Avg <span className="font-data-display" style={{ color: 'var(--color-text-secondary)', marginLeft: '2px' }}>{avgSig}%</span> {ghostCount > 0 && `• ${ghostCount} disconnected`}
          </div>
        </div>
      </div>

      {/* Per-bus strips */}
      {busEntries.map(([busId, bus], index) => (
        <React.Fragment key={busId}>
          {index > 0 && <div style={{ width: '1px', height: '32px', background: 'var(--color-border)', flexShrink: 0 }} />}
          <BusStrip bus={{ ...bus, id: busId }} history={signalHistory?.[busId]} />
        </React.Fragment>
      ))}
    </div>
  );
}
