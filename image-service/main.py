"""Kyarafit image-service stub. GET /health only; no rembg yet."""

from fastapi import FastAPI

app = FastAPI(title="Kyarafit Image Service", version="0.1.0")


@app.get("/health")
def health():
    return {"ok": True, "service": "image-service"}
