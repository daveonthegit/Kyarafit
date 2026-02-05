"""Kyarafit image-service: background removal with rembg."""

import os
from io import BytesIO

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response

try:
    from rembg.sessions import sessions_names as REMBG_MODELS
except ImportError:
    REMBG_MODELS = ["u2net", "u2netp", "u2net_human_seg", "u2net_cloth_seg", "silueta"]


# Config from env
def _env_int(key: str, default: int) -> int:
    try:
        return int(os.getenv(key, str(default)))
    except ValueError:
        return default


def get_config():
    return {
        "host": os.getenv("HOST", "0.0.0.0"),
        "port": _env_int("PORT", 8000),
        "max_file_size": _env_int("MAX_FILE_SIZE", 10 * 1024 * 1024),  # 10MB
        "default_model": os.getenv("DEFAULT_MODEL", "u2net"),
    }


app = FastAPI(title="Kyarafit Image Service", version="0.2.0")
config = get_config()


@app.get("/health")
def health():
    return {"ok": True, "status": "ok", "service": "image-service"}


@app.get("/models")
def models():
    return {
        "models": REMBG_MODELS,
        "default": (
            config["default_model"]
            if config["default_model"] in REMBG_MODELS
            else "u2net"
        ),
    }


def _remove_bg(image_bytes: bytes, model: str | None = None) -> bytes:
    from rembg import new_session, remove

    session_model = (model or config["default_model"]) or "u2net"
    if session_model not in REMBG_MODELS:
        session_model = "u2net"
    session = new_session(session_model)
    input_img = BytesIO(image_bytes)
    output_img = remove(input_img.read(), session=session)
    return output_img


ALLOWED_IMAGE_TYPES = (
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
)
ALLOWED_EXT = (".jpg", ".jpeg", ".png", ".webp", ".gif")


def _validate_size(body: bytes) -> None:
    if len(body) == 0:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(body) > config["max_file_size"]:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Max size is {config['max_file_size']} bytes",
        )


def _process_remove_bg(body: bytes) -> Response:
    try:
        out_png = _remove_bg(body)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Background removal failed: {str(e)}",
        ) from e
    return Response(
        content=out_png,
        media_type="image/png",
        headers={"Content-Disposition": "attachment; filename=removed-bg.png"},
    )


@app.post("/remove-bg", response_class=Response)
async def remove_bg_endpoint(request: Request):
    """Remove background from image; returns PNG bytes. Accepts multipart file or raw body."""
    content_type = (
        (request.headers.get("content-type") or "").split(";")[0].strip().lower()
    )
    if "multipart/form-data" in content_type:
        form = await request.form()
        file = form.get("file")
        if not file or not hasattr(file, "read"):
            raise HTTPException(
                status_code=400, detail="No file in form; use 'file' field"
            )
        file = file  # type: ignore
        body = await file.read()
        fn = getattr(file, "filename", "") or ""
        ft = getattr(file, "content_type", "") or ""
        if ft and ft.strip().lower() not in ALLOWED_IMAGE_TYPES:
            if not any((fn or "").lower().endswith(ext) for ext in ALLOWED_EXT):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid file type. Allowed: jpg, jpeg, png, webp, gif",
                )
    else:
        body = await request.body()
        # Raw body: allow image/* or application/octet-stream
        if (
            content_type
            and not content_type.startswith("image/")
            and content_type != "application/octet-stream"
        ):
            raise HTTPException(
                status_code=400,
                detail="Invalid content type. Use multipart form with 'file' or raw body with image/*",
            )
    _validate_size(body)
    return _process_remove_bg(body)
