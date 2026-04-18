/**
 * MapLegend.jsx — Phase 6: Themed, larger fonts.
 */

import React from 'react';
import { useMap } from 'react-leaflet';
import { useEffect, useRef } from 'react';
import L from 'leaflet';

export default function MapLegend() {
  const map = useMap();
  const legendRef = useRef(null);

  useEffect(() => {
    if (legendRef.current) return;

    const Legend = L.Control.extend({
      options: { position: 'bottomleft' },
      onAdd() {
        const div = L.DomUtil.create('div', 'map-legend');
        div.innerHTML = `
          <h4>Routes</h4>
          <div class="legend-item"><div class="legend-line" style="background:#22c55e"></div> Low Traffic</div>
          <div class="legend-item"><div class="legend-line" style="background:#eab308"></div> Medium Traffic</div>
          <div class="legend-item"><div class="legend-line" style="background:#ef4444"></div> High Traffic</div>
          <div class="legend-item"><div class="legend-line" style="background:#4b5563"></div> Traveled</div>

          <h4 style="margin-top:8px">Dead Zones</h4>
          <div class="legend-item"><div class="legend-line" style="background:#7c3aed; border:1px dashed #7c3aed"></div> Blackout Zone</div>
          <div class="legend-item"><div class="legend-line" style="background:#f59e0b; border:1px dotted #f59e0b"></div> Weak Zone</div>

          <h4 style="margin-top:8px">Markers</h4>
          <div class="legend-item"><div class="legend-dot" style="background:#22c55e"></div> Strong (&gt;70%)</div>
          <div class="legend-item"><div class="legend-dot" style="background:#eab308"></div> Weak (40-70%)</div>
          <div class="legend-item"><div class="legend-dot" style="background:#ef4444"></div> Critical (&lt;40%)</div>
          <div class="legend-item"><div class="legend-dot" style="background:#6366f1"></div> MITAOE Dest.</div>
        `;
        L.DomEvent.disableClickPropagation(div);
        return div;
      },
    });

    const legend = new Legend();
    legend.addTo(map);
    legendRef.current = legend;

    return () => {
      if (legendRef.current) { legendRef.current.remove(); legendRef.current = null; }
    };
  }, [map]);

  return null;
}
