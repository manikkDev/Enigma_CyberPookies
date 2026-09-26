from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
        "phase": 0,
        "port": settings.PORT,
    }
