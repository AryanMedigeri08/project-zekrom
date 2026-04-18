/**
 * MapLegend — Leaflet control component showing route and bus color coding.
 */

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

export default function MapLegend() {
  const map = useMap();

  useEffect(() => {
    const legend = L.control({ position: 'bottomleft' });

    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'map-legend');
      div.innerHTML = `
        <div style="display: flex; gap: 20px;">
          <div>
            <h4>Route Status</h4>
            <div class="legend-item">
              <div class="legend-line" style="background: #22c55e;"></div>
              <span>Low Traffic</span>
            </div>
            <div class="legend-item">
              <div class="legend-line" style="background: #eab308;"></div>
              <span>Moderate Traffic</span>
            </div>
            <div class="legend-item">
              <div class="legend-line" style="background: #ef4444;"></div>
              <span>High Traffic</span>
            </div>
            <div class="legend-item">
              <div class="legend-line" style="background: #d1d5db;"></div>
              <span>Route Traveled</span>
            </div>
          </div>
          <div>
            <h4>Bus Signal</h4>
            <div class="legend-item">
              <div class="legend-dot" style="background: #22c55e;"></div>
              <span>Strong (70-100%)</span>
            </div>
            <div class="legend-item">
              <div class="legend-dot" style="background: #eab308;"></div>
              <span>Moderate (40-70%)</span>
            </div>
            <div class="legend-item">
              <div class="legend-dot" style="background: #ef4444;"></div>
              <span>Weak (0-40%)</span>
            </div>
            <div class="legend-item">
              <div class="legend-dot" style="background: #e2e8f0; border: 1px dashed #94a3b8;"></div>
              <span>Ghost (Signal Lost)</span>
            </div>
          </div>
        </div>
      `;
      return div;
    };

    legend.addTo(map);
    return () => legend.remove();
  }, [map]);

  return null;
}
