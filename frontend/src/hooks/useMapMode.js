/**
 * useMapMode — Central state machine for 2D/3D map transitions.
 *
 * States: '2d' → 'transitioning-to-3d' → '3d' → 'transitioning-to-2d' → '2d'
 */

import { useState, useCallback } from 'react';

export default function useMapMode() {
  const [mode, setMode] = useState('2d');          // '2d' | '3d'
  const [selectedBusId, setSelectedBusId] = useState(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayDirection, setOverlayDirection] = useState('entering');

  const selectBus = useCallback((busId) => {
    setOverlayDirection('entering');
    setShowOverlay(true);
    setSelectedBusId(busId);

    setTimeout(() => {
      setMode('3d');
      setShowOverlay(false);
    }, 450);
  }, []);

  const returnToFleet = useCallback(() => {
    setOverlayDirection('exiting');
    setShowOverlay(true);

    setTimeout(() => {
      setMode('2d');
      setSelectedBusId(null);
      setShowOverlay(false);
    }, 450);
  }, []);

  return {
    mode,
    selectedBusId,
    showOverlay,
    overlayDirection,
    selectBus,
    returnToFleet,
  };
}
