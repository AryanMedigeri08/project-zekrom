"""
Route Builder — OSRM integration for road-following routes.

Fetches actual road geometry from the free OSRM public API.
Routes are fetched once at startup and cached in memory.
Falls back to straight-line waypoints if OSRM is unreachable.
"""

import math
import requests
import time
from typing import List, Tuple, Dict, Any, Optional


OSRM_BASE = "http://router.project-osrm.org/route/v1/driving"


def _haversine_km(lat1, lng1, lat2, lng2) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def build_road_following_route(
    waypoints: List[Tuple[float, float]],
    route_name: str = "",
) -> List[Tuple[float, float]]:
    try:
        coords_str = ";".join(f"{lng},{lat}" for lat, lng in waypoints)
        url = f"{OSRM_BASE}/{coords_str}?overview=full&geometries=geojson&steps=true"

        response = requests.get(url, timeout=15)
        response.raise_for_status()
        data = response.json()

        if data.get("code") != "Ok" or not data.get("routes"):
            raise ValueError(f"OSRM returned non-Ok: {data.get('code')}")

        coordinates = data["routes"][0]["geometry"]["coordinates"]
        road_points = [(coord[1], coord[0]) for coord in coordinates]

        print(f"  [OK] {route_name}: {len(road_points)} road points from OSRM")
        return road_points

    except Exception as e:
        print(f"  [WARN] {route_name}: OSRM failed ({e}), using straight-line fallback")
        return list(waypoints)


def get_route_distance_km(
    waypoints: List[Tuple[float, float]],
) -> float:
    try:
        coords_str = ";".join(f"{lng},{lat}" for lat, lng in waypoints)
        url = f"{OSRM_BASE}/{coords_str}?overview=false"
        data = requests.get(url, timeout=10).json()
        if data.get("code") == "Ok" and data.get("routes"):
            return data["routes"][0]["distance"] / 1000.0
    except Exception:
        pass

    total = 0.0
    for i in range(len(waypoints) - 1):
        total += _haversine_km(
            waypoints[i][0], waypoints[i][1],
            waypoints[i + 1][0], waypoints[i + 1][1],
        )
    return total


def map_stops_to_geometry(
    stops: List[Tuple[float, float]],
    geometry: List[Tuple[float, float]],
) -> List[int]:
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
    print("Fetching road-following routes from OSRM...")
    result = {}

    for route_id, route_def in route_definitions.items():
        stops = route_def["stops"]
        stop_coords = [(s["lat"], s["lng"]) for s in stops]

        if result:
            time.sleep(1)

        geometry = build_road_following_route(stop_coords, route_def.get("name", route_id))
        distance = get_route_distance_km(stop_coords)
        stop_indices = map_stops_to_geometry(stop_coords, geometry)

        result[route_id] = {
            "name": route_def.get("name", route_id),
            "color": route_def.get("color", "#888888"),
            "stops": stops,
            "geometry": geometry,
            "stop_indices": stop_indices,
            "distance_km": round(distance, 2),
        }

    print(f"[OK] All {len(result)} routes loaded.\n")
    return result

