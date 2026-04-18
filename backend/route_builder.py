"""
Route Builder — OSRM integration for road-following routes.

Fetches actual road geometry from the free OSRM public API.
Routes are fetched once at startup and cached in memory.
Falls back to straight-line waypoints if OSRM is unreachable.
"""

import requests
import time
from typing import List, Tuple, Dict, Any, Optional


OSRM_BASE = "http://router.project-osrm.org/route/v1/driving"


def build_road_following_route(
    waypoints: List[Tuple[float, float]],
    route_name: str = "",
) -> List[Tuple[float, float]]:
    """
    Takes a list of (lat, lng) stop coordinates.
    Returns a dense list of (lat, lng) points that follow actual roads.

    Uses OSRM public API — no API key required.
    Falls back to straight-line waypoints on failure.
    """
    try:
        # OSRM expects lng,lat format (not lat,lng)
        coords_str = ";".join(f"{lng},{lat}" for lat, lng in waypoints)
        url = f"{OSRM_BASE}/{coords_str}?overview=full&geometries=geojson&steps=true"

        response = requests.get(url, timeout=15)
        response.raise_for_status()
        data = response.json()

        if data.get("code") != "Ok" or not data.get("routes"):
            raise ValueError(f"OSRM returned non-Ok: {data.get('code')}")

        # Extract the full road geometry — OSRM returns [lng, lat]
        coordinates = data["routes"][0]["geometry"]["coordinates"]

        # Convert to [lat, lng] format
        road_points = [(coord[1], coord[0]) for coord in coordinates]

        print(f"  ✓ {route_name}: {len(road_points)} road points from OSRM")
        return road_points

    except Exception as e:
        print(f"  ⚠ {route_name}: OSRM failed ({e}), using straight-line fallback")
        return list(waypoints)


def get_route_distance_km(
    waypoints: List[Tuple[float, float]],
) -> float:
    """Returns total route distance in km from OSRM, or estimate on failure."""
    try:
        coords_str = ";".join(f"{lng},{lat}" for lat, lng in waypoints)
        url = f"{OSRM_BASE}/{coords_str}?overview=false"
        data = requests.get(url, timeout=10).json()
        if data.get("code") == "Ok" and data.get("routes"):
            return data["routes"][0]["distance"] / 1000.0
    except Exception:
        pass

    # Fallback: estimate from haversine
    from config import haversine_km
    total = 0.0
    for i in range(len(waypoints) - 1):
        total += haversine_km(
            waypoints[i][0], waypoints[i][1],
            waypoints[i + 1][0], waypoints[i + 1][1],
        )
    return total


def map_stops_to_geometry(
    stops: List[Tuple[float, float]],
    geometry: List[Tuple[float, float]],
) -> List[int]:
    """
    For each stop, find the nearest point index in the dense road geometry.
    Returns a list of geometry indices corresponding to each stop.
    """
    indices = []
    for stop_lat, stop_lng in stops:
        best_idx = 0
        best_dist = float("inf")
        for idx, (g_lat, g_lng) in enumerate(geometry):
            dist = (g_lat - stop_lat) ** 2 + (g_lng - stop_lng) ** 2
            if dist < best_dist:
                best_dist = dist
                best_idx = idx
        indices.append(best_idx)
    return indices


def fetch_all_routes(route_definitions: Dict[str, Any]) -> Dict[str, Any]:
    """
    Fetch road-following geometry for all routes at startup.
    Returns a dict with route_id -> { geometry, stop_indices, distance_km, ... }
    """
    print("Fetching road-following routes from OSRM...")
    result = {}

    for route_id, route_def in route_definitions.items():
        stops = route_def["stops"]
        stop_coords = [(s["lat"], s["lng"]) for s in stops]

        # Add a small delay between OSRM calls to be polite
        if result:
            time.sleep(1)

        geometry = build_road_following_route(stop_coords, route_def["name"])
        distance = get_route_distance_km(stop_coords)
        stop_indices = map_stops_to_geometry(stop_coords, geometry)

        result[route_id] = {
            "name": route_def["name"],
            "color_id": route_def["color_id"],
            "stops": stops,
            "geometry": geometry,
            "stop_indices": stop_indices,
            "distance_km": round(distance, 2),
        }

    print(f"✓ All {len(result)} routes loaded.\n")
    return result
