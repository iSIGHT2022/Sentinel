try:
    from celery import Celery
    from celery.schedules import crontab
    from config import settings

    celery_app = Celery(
        "sentinel",
        broker=settings.redis_url,
        backend=settings.redis_url,
        include=["workers.tasks"],
    )

    celery_app.conf.update(
        task_serializer="json",
        result_serializer="json",
        accept_content=["json"],
        timezone="UTC",
        enable_utc=True,
        beat_schedule={
            "daily-digest": {
                "task": "workers.tasks.generate_daily_digest",
                "schedule": crontab(hour=6, minute=0),
            },
            "breakfast-skip-check": {
                "task": "workers.tasks.check_meal_attendance",
                "schedule": crontab(hour=9, minute=30),
                "args": ["breakfast"],
            },
            "lunch-skip-check": {
                "task": "workers.tasks.check_meal_attendance",
                "schedule": crontab(hour=13, minute=30),
                "args": ["lunch"],
            },
            "dinner-skip-check": {
                "task": "workers.tasks.check_meal_attendance",
                "schedule": crontab(hour=20, minute=0),
                "args": ["dinner"],
            },
            "cleanup-old-alerts": {
                "task": "workers.tasks.cleanup_resolved_alerts",
                "schedule": crontab(hour=2, minute=0),
            },
        },
    )

except ImportError:
    # Local dev stub — no Redis/Celery required
    class _Conf:
        def update(self, **kwargs):
            pass

    class _Task:
        def delay(self, *args, **kwargs):
            pass

    class _Celery:
        conf = _Conf()

        def task(self, fn=None, **kwargs):
            if fn is not None:
                return _Task()
            return lambda f: _Task()

    celery_app = _Celery()
