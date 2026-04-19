/**
 * useInterpolation — Phase 9: Smooth position animation between GPS pings.
 *
 * When a new target position arrives (from a WebSocket ping), this hook
 * animates the displayed position from the old coordinates to the new ones
 * using requestAnimationFrame.
 *
 * Key improvements:
 *   - Animation duration matches the ping interval so movement is continuous
 *   - Ease-in-out curve for natural motion
 *   - At zoom level 13-14, 50m+ movement per tick is clearly visible
 */

import { useEffect, useRef, useState } from 'react';

/**
 * @param {Object|null} targetPosition  - { lat, lng } from the latest ping
 * @param {number}      pingInterval    - ping interval in ms (matches actual interval)
 * @returns {Object|null} { lat, lng }  - the currently displayed (animated) position
 */
export default function useInterpolation(targetPosition, pingInterval = 2000) {
  const [displayPosition, setDisplayPosition] = useState(null);

  const currentPosRef = useRef(null);
  const animFrameRef = useRef(null);
  const startPosRef = useRef(null);
  const startTimeRef = useRef(null);

  // Ease-in-out quadratic for natural movement
  const easeInOutQuad = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

  useEffect(() => {
    if (!targetPosition || targetPosition.lat == null || targetPosition.lng == null) return;

    // First ping — snap immediately
    if (!currentPosRef.current) {
      const initial = { lat: targetPosition.lat, lng: targetPosition.lng };
      currentPosRef.current = initial;
      setDisplayPosition(initial);
      return;
    }

    // Cancel any in-flight animation
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }

    const startLat = currentPosRef.current.lat;
    const startLng = currentPosRef.current.lng;
    const endLat = targetPosition.lat;
    const endLng = targetPosition.lng;

    // If positions are identical, skip animation
    if (Math.abs(endLat - startLat) < 1e-8 && Math.abs(endLng - startLng) < 1e-8) {
      return;
    }

    // Animate over the full ping interval duration
    // So movement looks continuous between pings
    const duration = Math.max(pingInterval, 500);  // at least 500ms
    startTimeRef.current = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTimeRef.current;
      const rawT = Math.min(elapsed / duration, 1);
      const t = easeInOutQuad(rawT);

      const newPos = {
        lat: startLat + t * (endLat - startLat),
        lng: startLng + t * (endLng - startLng),
      };

      currentPosRef.current = newPos;
      setDisplayPosition({ ...newPos });

      if (rawT < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [targetPosition?.lat, targetPosition?.lng, pingInterval]);

  return displayPosition;
}


/**
 * useGhostPosition — Extrapolate position when signal is lost.
 *
 * In Phase 9, the server sends ghost positions directly via
 * the distance-based system. This hook is now simpler —
 * it just animates from the last known position toward the
 * ghost position received from the server.
 *
 * @param {Object|null} lastKnownPosition  - { lat, lng, heading, speed_kmh }
 * @param {boolean}     isOffline          - true when signal is in dead zone
 * @returns {Object|null} { lat, lng } - the extrapolated ghost position
 */
export function useGhostPosition(lastKnownPosition, isOffline) {
  const [ghostPos, setGhostPos] = useState(null);

  const baseRef = useRef(null);
  const offlineStartRef = useRef(null);
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (!isOffline || !lastKnownPosition) {
      setGhostPos(null);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      baseRef.current = null;
      offlineStartRef.current = null;
      return;
    }

    // Just went offline — record the base position
    if (!baseRef.current) {
      baseRef.current = { ...lastKnownPosition };
      offlineStartRef.current = performance.now();
    }

    const base = baseRef.current;
    const speedKmh = Math.max(base.speed_kmh || 0, 5);
    const headingDeg = base.heading || 0;
    const headingRad = (headingDeg * Math.PI) / 180;

    const kmPerDegLat = 111.32;
    const kmPerDegLng = 111.32 * Math.cos((base.lat * Math.PI) / 180);

    const animate = (now) => {
      const elapsedS = (now - offlineStartRef.current) / 1000;
      const cappedS = Math.min(elapsedS, 120);

      const distKm = (speedKmh / 3600) * cappedS;

      const dLat = (distKm * Math.cos(headingRad)) / kmPerDegLat;
      const dLng = (distKm * Math.sin(headingRad)) / kmPerDegLng;

      setGhostPos({
        lat: base.lat + dLat,
        lng: base.lng + dLng,
      });

      if (cappedS < 120) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOffline, lastKnownPosition?.lat, lastKnownPosition?.lng]);

  return ghostPos;
}
