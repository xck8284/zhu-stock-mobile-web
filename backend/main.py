from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="ZHU STOCK Mobile API",
    version="1.0.0"
)

# ===== CORS =====
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://zhu-stock-mobile-web.onrender.com",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# 系統狀態
# =========================
@app.get("/")
def root():
    return {
        "success": True,
        "system": "ZHU STOCK Mobile API",
        "version": "1.0.0"
    }

@app.get("/health")
def health():
    return {
        "status": "ok"
    }

# =========================
# 股票分析
# =========================
@app.get("/analysis")
def analysis():
    return {
        "bullish": [],
        "bearish": [],
        "message": "尚未建立分析系統"
    }

# =========================
# 會員管理
# =========================
@app.get("/admin/members")
def members():
    return []

# =========================
# 付款審核
# =========================
@app.get("/admin/payment-reports")
def payment_reports():
    return []

# =========================
# 推薦制度
# =========================
@app.get("/admin/referrals")
def referrals():
    return []

# =========================
# 用戶回饋
# =========================
@app.get("/admin/feedback")
def feedback():
    return []
