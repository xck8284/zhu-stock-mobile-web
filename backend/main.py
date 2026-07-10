import os

import httpx
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response


app = FastAPI(title="ZHU STOCK Mobile API", version="2.0.0")

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
        and key.lower() not in {"host", "origin", "referer"}
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, read=1800.0)) as client:
            upstream = await client.request(
                method=request.method,
                url=target_url,
                params=request.query_params,
                headers=headers,
                content=await request.body(),
            )
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

    response_headers = {
        key: value
        for key, value in upstream.headers.items()
        if key.lower() not in HOP_BY_HOP_HEADERS
    }
    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers=response_headers,
    )
