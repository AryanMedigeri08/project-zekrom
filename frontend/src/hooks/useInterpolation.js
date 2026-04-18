/**
 * useInterpolation — Smooth position animation between GPS pings.
 *
 * When a new target position arrives (from a WebSocket ping), this hook
 * animates the displayed position from the old coordinates to the new ones
 * using requestAnimationFrame and an easeOutCubic curve.
 *
 * This prevents the bus marker from "jumping" — instead it glides smoothly,
 * which is critical UX when ping intervals are long (6s or 12s).
 */

import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * @param {Object|null} targetPosition  - { lat, lng } from the latest ping
 * @param {number}      duration        - animation duration in ms (matches ping interval)
 * @returns {Object|null} { lat, lng }  - the currently displayed (animated) position
 */
export default function useInterpolation(targetPosition, duration = 2000) {
  const [displayPosition, setDisplayPosition] = useState(null);

  // Refs hold mutable state that doesn't trigger re-renders
  const currentPosRef = useRef(null);      // the position we're currently showing
  const animFrameRef = useRef(null);       // requestAnimationFrame ID
  const startPosRef = useRef(null);        // animation start position
  const startTimeRef = useRef(null);       // animation start timestamp

  // ---- Ease function: cubic ease-out for a natural deceleration feel ----
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  useEffect(() => {
    // Nothing to animate to
    if (!targetPosition || targetPosition.lat == null || targetPosition.lng == null) return;

    // First ping — snap immediately, no animation
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

    // Capture the starting point and time
    startPosRef.current = { ...currentPosRef.current };
    startTimeRef.current = performance.now();

    const targetLat = targetPosition.lat;
    const targetLng = targetPosition.lng;

    const animate = (now) => {
      const elapsed = now - startTimeRef.current;
      const rawProgress = Math.min(elapsed / duration, 1);
      const progress = easeOutCubic(rawProgress);

      const newPos = {
        lat: startPosRef.current.lat + (targetLat - startPosRef.current.lat) * progress,
        lng: startPosRef.current.lng + (targetLng - startPosRef.current.lng) * progress,
      };

      currentPosRef.current = newPos;
      setDisplayPosition({ ...newPos });

      if (rawProgress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
    // We intentionally depend on lat/lng primitives, not the object reference
  }, [targetPosition?.lat, targetPosition?.lng, duration]);

  return displayPosition;
}


/**
 * useGhostPosition — Extrapolate position when signal is lost.
 *
 * Uses the last known speed and heading to project where the bus
 * *probably* is, since we have no fresh GPS data.  The ghost position
 * is updated every animation frame for smooth movement.
 *
 * @param {Object|null} lastKnownPosition  - { lat, lng, heading, speed_kmh }
 * @param {boolean}     isOffline          - true when signal is in dead zone
 * @returns {Object|null} { lat, lng } - the extrapolated ghost position
 */
export function useGhostPosition(lastKnownPosition, isOffline) {
  const [ghostPos, setGhostPos] = useState(null);

  const baseRef = useRef(null);        // position when we went offline
  const offlineStartRef = useRef(null); // timestamp when offline started
  const animFrameRef = useRef(null);

  useEffect(() => {
    if (!isOffline || !lastKnownPosition) {
      // Online — clear ghost
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
    const speedKmh = Math.max(base.speed_kmh || 0, 5); // minimum ghost speed
    const headingDeg = base.heading || 0;
    const headingRad = (headingDeg * Math.PI) / 180;

    // 1 km ≈ 0.009° latitude (approximate, good enough for local distances)
    // 1 km ≈ 0.009° / cos(lat) longitude
    const kmPerDegLat = 111.32;
    const kmPerDegLng = 111.32 * Math.cos((base.lat * Math.PI) / 180);

    const animate = (now) => {
      const elapsedS = (now - offlineStartRef.current) / 1000;

      // Cap ghost extrapolation at 120 seconds to avoid absurd projection
      const cappedS = Math.min(elapsedS, 120);

      const distKm = (speedKmh / 3600) * cappedS;

      // Project position along heading
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
