/**
 * NetworkStrip.jsx — Horizontal health strip below navbar showing all 5 buses inline.
 *
 * Each bus: label (route color) + mini sparkline + signal % or ghost indicator.
 */

import React, { useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { useTheme } from '../context/ThemeContext';

function getSignalColor(sig) {
  if (sig >= 70) return '#22c55e';
  if (sig >= 40) return '#eab308';
  return '#ef4444';
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
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '0 12px', flex: 1, minWidth: 0,
    }}>
      {/* Bus label */}
      <span style={{
        fontSize: '13px', fontWeight: 700, color: bus?.color || 'var(--color-text)',
        whiteSpace: 'nowrap',
      }}>
        {bus?.label || '—'}
      </span>

      {/* Mini sparkline */}
      <div style={{ width: '64px', height: '28px', flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`ns-${bus?.id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={sigColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={sigColor} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke={sigColor} strokeWidth={1.5}
              fill={`url(#ns-${bus?.id})`} isAnimationActive={false} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Signal value or ghost */}
      {isGhost ? (
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#f97316', whiteSpace: 'nowrap' }}>
          EST.
        </span>
      ) : (
        <span style={{ fontSize: '13px', fontWeight: 700, color: sigColor, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
          {sig}%
        </span>
      )}

      {/* Dead zone indicator */}
      {bus?.in_dead_zone && (
        <span style={{
          fontSize: '11px', fontWeight: 700, color: '#7c3aed',
          padding: '1px 5px', borderRadius: '4px',
          background: 'rgba(124,58,237,0.12)', whiteSpace: 'nowrap',
        }}>DZ</span>
      )}
    </div>
  );
}

export default function NetworkStrip({ buses, signalHistory }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
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
      height: '52px',
      display: 'flex',
      alignItems: 'center',
      borderBottom: `1px solid var(--color-border)`,
      background: 'var(--color-nav-bg)',
      flexShrink: 0,
      padding: '0 16px',
      gap: '4px',
    }}>
      {/* Label */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        paddingRight: '12px', borderRight: '1px solid var(--color-border)',
        flexShrink: 0,
      }}>
        <svg style={{ width: '16px', height: '16px', color: ghostCount > 0 ? '#ef4444' : '#22c55e' }}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.348 14.651a3.75 3.75 0 010-5.303m5.304 0a3.75 3.75 0 010 5.303m-7.425 2.122a6.75 6.75 0 010-9.546m9.546 0a6.75 6.75 0 010 9.546" />
        </svg>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2 }}>
            Network Health
          </div>
          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', lineHeight: 1.2 }}>
            Avg: {avgSig}% {ghostCount > 0 && `• ${ghostCount} ghost`}
          </div>
        </div>
      </div>

      {/* Per-bus strips */}
      {busEntries.map(([busId, bus]) => (
        <React.Fragment key={busId}>
          <div style={{ width: '1px', height: '28px', background: 'var(--color-border)', flexShrink: 0 }} />
          <BusStrip bus={{ ...bus, id: busId }} history={signalHistory?.[busId]} />
        </React.Fragment>
      ))}
    </div>
  );
}
