"""Maps camera IDs and pixel bounding boxes to named facility zones."""
from dataclasses import dataclass
from typing import Dict, Tuple, Optional

# Camera → zone mapping (configured per facility layout)
CAMERA_ZONE_MAP: Dict[str, str] = {
    "cam_c1": "corridors_hallways",
    "cam_c2": "corridors_hallways",
    "cam_d1": "dining_hall",
    "cam_l1": "common_room_lounge",
    "cam_g1": "garden_outdoor",
    "cam_g2": "garden_outdoor",
    "cam_a1": "activity_therapy_room",
    "cam_n1": "nurse_station",
    "cam_b1": "bathroom_entry",
    "cam_s1": "stairwells_elevators",
}

# Zones that have NO internal camera (entry/exit tracking only)
ENTRY_ONLY_ZONES = {"bathroom_entry"}


@dataclass
class ZoneContext:
    zone: str
    camera_id: str
    has_internal_camera: bool


def get_zone(camera_id: str) -> ZoneContext:
    zone = CAMERA_ZONE_MAP.get(camera_id, "unknown")
    return ZoneContext(
        zone=zone,
        camera_id=camera_id,
        has_internal_camera=(zone not in ENTRY_ONLY_ZONES),
    )


def pixel_to_meters(
    x: float, y: float, frame_w: int, frame_h: int, fov_w_m: float = 10.0, fov_h_m: float = 6.0
) -> Tuple[float, float]:
    """Rough pixel→metre conversion using known field-of-view dimensions."""
    return (x / frame_w) * fov_w_m, (y / frame_h) * fov_h_m
