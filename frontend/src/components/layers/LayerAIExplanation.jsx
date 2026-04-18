/**
 * LayerAIExplanation.jsx — Shared AI Explanation panel for layer cards.
 * Shows the most recent AI decisions relevant to this layer.
 */

import React from 'react';

export default function LayerAIExplanation({ decisions, layerColor }) {
  if (!decisions || decisions.length === 0) return null;

  return (
    <div className="layer-ai-explanation">
      <div className="layer-ai-explanation-header">
        <span className="layer-ai-explanation-icon">🤖</span>
        <span>AI Explanation</span>
      </div>
      {decisions.map((d, i) => {
        const exp = d.explanation;
        if (!exp) return null;
        return (
          <div key={d._key || i} className={`layer-ai-entry ${d.isNew ? 'new' : ''}`}>
            <div className="layer-ai-entry-header">
              <span className="layer-ai-entry-time">{d.timestamp}</span>
              <span className="layer-ai-entry-decision" style={{ color: layerColor }}>
                {exp.decision}
              </span>
              {exp.confidence != null && (
                <span className="layer-ai-entry-conf">
                  {Math.round((typeof exp.confidence === 'number' ? exp.confidence : parseFloat(exp.confidence)) * 100)}%
                </span>
              )}
            </div>
            <p className="layer-ai-entry-reasoning">{exp.reasoning}</p>
            {exp.action && (
              <p className="layer-ai-entry-action">→ {exp.action}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
