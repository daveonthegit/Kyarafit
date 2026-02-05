"""Tests for image-service."""

import pytest
from httpx import ASGITransport, AsyncClient

from main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    """Test the health endpoint returns ok and status."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["ok"] is True
        assert data.get("status") == "ok"
        assert data["service"] == "image-service"


@pytest.mark.asyncio
async def test_models_endpoint():
    """Test the models endpoint returns list of models."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/models")
        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert isinstance(data["models"], list)
        assert "u2net" in data["models"]
        assert "default" in data


@pytest.mark.asyncio
async def test_remove_bg_returns_png():
    """Test POST /remove-bg with a tiny PNG returns image/png."""
    # Minimal valid PNG (1x1 transparent pixel)
    tiny_png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
        b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01"
        b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/remove-bg",
            content=tiny_png,
            headers={"Content-Type": "image/png"},
        )
        assert response.status_code == 200
        assert response.headers.get("content-type", "").startswith("image/png")
        assert len(response.content) > 0
