from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Backend
    backend_url: str = "http://localhost:8000"
    edge_api_key: str = "change_me"

    # Models
    yolo_model_path: str = "models/yolov8x-pose.pt"
    reid_model_path: str = "models/osnet_x1_0.pth"
    device: str = "cuda"           # "cuda" or "cpu"
    inference_fps: int = 15
    frame_skip: int = 2            # process every Nth frame

    # Camera RTSP sources (comma-separated)
    camera_sources: str = ""

    # Redis
    redis_url: str = "redis://localhost:6379/1"

    # Detection thresholds
    fall_confidence_threshold: float = 0.75
    gait_window_frames: int = 30
    wandering_distance_threshold_m: float = 50.0
    bathroom_duration_alert_minutes: int = 20

    @property
    def camera_list(self) -> List[str]:
        return [s.strip() for s in self.camera_sources.split(",") if s.strip()]

    class Config:
        env_file = ".env"


settings = Settings()
