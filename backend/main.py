import os
import asyncio

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from starlette.background import BackgroundTask


app = FastAPI(title="ZHU STOCK Mobile API", version="2.0.0")

_upstream_client: httpx.AsyncClient | None = None


@app.on_event("startup")
async def open_upstream_client():
    global _upstream_client
    _upstream_client = httpx.AsyncClient(
        timeout=httpx.Timeout(30.0, read=1800.0),
        limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
    )


@app.on_event("shutdown")
async def close_upstream_client():
    global _upstream_client
    if _upstream_client is not None:
        await _upstream_client.aclose()
        _upstream_client = None

UPSTREAM_API_BASE = os.getenv(
    "UPSTREAM_API_BASE", "https://zhu-stock-app.onrender.com"
).rstrip("/")
MOBILE_WEB_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "MOBILE_WEB_ORIGINS",
        "https://zhu-stock-mobile-web.onrender.com,http://localhost:5173",
    ).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=MOBILE_WEB_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "content-length",
    "content-encoding",
}


@app.get("/")
def root():
    return {
        "success": True,
        "system": "ZHU STOCK Mobile API",
        "version": "2.0.0",
        "mode": "mobile-gateway",
    }


@app.get("/health")
async def health():
    upstream_ok = False
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(f"{UPSTREAM_API_BASE}/web/health")
            upstream_ok = response.is_success
    except httpx.HTTPError:
        pass

    return {
        "status": "ok",
        "upstream": "ok" if upstream_ok else "unavailable",
    }


@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
async def mobile_gateway(path: str, request: Request):
    """Forward mobile requests to the shared cloud data service.

    This keeps desktop code untouched while sharing member, payment and
    feedback records through the existing cloud service.
    """
    target_url = f"{UPSTREAM_API_BASE}/{path}"
    headers = {
        key: value
        for key, value in request.headers.items()
        if key.lower() not in HOP_BY_HOP_HEADERS
        and key.lower() not in {"host", "origin", "referer", "accept-encoding"}
    }

    body = await request.body()
    client = _upstream_client
    if client is None:
        client = httpx.AsyncClient(timeout=httpx.Timeout(30.0, read=1800.0))

    try:
        upstream_request = client.build_request(
            request.method,
            target_url,
            params=request.query_params,
            headers=headers,
            content=body,
        )
        upstream = await client.send(upstream_request, stream=True)
        # Render can briefly throttle bursts while a free instance is waking.
        # Retrying safe reads prevents the mobile UI from failing on that transient.
        if upstream.status_code == 429 and request.method in {"GET", "HEAD"}:
            await upstream.aclose()
            await asyncio.sleep(1.0)
            retry_request = client.build_request(
                request.method,
                target_url,
                params=request.query_params,
                headers=headers,
                content=body,
            )
            upstream = await client.send(retry_request, stream=True)
    except httpx.TimeoutException:
        return Response(
            content='{"detail":"雲端服務回應逾時，請稍後再試"}',
            status_code=504,
            media_type="application/json",
        )
    except httpx.HTTPError:
        return Response(
            content='{"detail":"暫時無法連線雲端服務"}',
            status_code=502,
            media_type="application/json",
        )

    if upstream.status_code == 429 and "json" not in upstream.headers.get("content-type", ""):
        await upstream.aclose()
        return Response(
            content='{"detail":"請求過於頻繁，請稍候再試"}',
            status_code=429,
            media_type="application/json",
        )

    response_headers = {
        key: value
        for key, value in upstream.headers.items()
        if key.lower() not in HOP_BY_HOP_HEADERS
    }
    return StreamingResponse(
        upstream.aiter_bytes(),
        status_code=upstream.status_code,
        headers=response_headers,
        background=BackgroundTask(upstream.aclose),
    )
