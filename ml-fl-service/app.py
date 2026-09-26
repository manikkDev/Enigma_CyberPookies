import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from data.schema import SCHEMAS
from settings import settings

app = FastAPI(title="Arth Saathi ML/FL Service", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict[str, str]:
    return {"service": "ml-fl-service", "status": "ready"}


@app.get("/health")
def health() -> dict[str, object]:
    return {
        "ok": True,
        "service": "ml-fl-service",
        "phase": 1,
        "port": settings.PORT,
    }


@app.get("/datasets")
def datasets() -> list[dict[str, object]]:
    root = Path(settings.PARTITIONS_DIR)
    available = []
    for key, schema in SCHEMAS.items():
        for partition in sorted((root / key).glob("hfl_*")):
            metadata_path = partition / "meta.json"
            if metadata_path.exists():
                available.append(
                    {
                        "dataset": key,
                        "task": schema.task,
                        "partition": partition.name,
                        "meta": json.loads(metadata_path.read_text()),
                    }
                )
    return available
