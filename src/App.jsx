import { useEffect, useState } from "react";
import "./App.css";
import { bullishStocks, bearishStocks } from "./analysisData";
import { adminFetch } from "./mobileApi";

const API_BASE = "https://zhu-stock-app.onrender.com";

function App() {
  const [page, setPage] = useState("login");
  const [isCreator, setIsCreator] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showBankInfo, setShowBankInfo] = useState(false);
  const [registerMsg, setRegisterMsg] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [memberInfo, setMemberInfo] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("zhu_mobile_user");

    if (!savedUser) return;

    try {
      const data = JSON.parse(savedUser);
      setMemberInfo(data);
      setIsCreator(true);
      setPage("home");
    } catch (err) {
      console.error(err);
      localStorage.removeItem("zhu_mobile_token");
      localStorage.removeItem("zhu_mobile_user");
      localStorage.removeItem("zhu_mobile_account");
    }
  }, []);

  const login = async () => {
    if (!email || !password) {
      alert("請輸入 Email / 帳號與密碼");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account: email,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(result.detail || "登入失敗");
        return;
      }

      localStorage.setItem("zhu_mobile_token", result.access_token);

      const data = {
        account: result.username || email,
        plan: result.plan || result.plan_type || "-",
        days_left: result.days_left ?? 0,
        label: result.plan_label || result.label || "會員",
        allowed: true,
        is_creator: Boolean(result.is_creator || result.user?.is_creator || result.data?.is_creator),
      };

      localStorage.setItem("zhu_mobile_user", JSON.stringify(data));
      localStorage.setItem("zhu_mobile_account", data.account);

      setMemberInfo(data);
      setIsCreator(
  Boolean(
    data.is_creator ||
    data.user?.is_creator ||
    data.creator ||
    data.role === "creator" ||
    data.role === "admin"
  )
);
      setPage("home");
    } catch (err) {
      console.error(err);
      alert("連線失敗");
    }
  };

  const logout = () => {
    localStorage.removeItem("zhu_mobile_token");
    localStorage.removeItem("zhu_mobile_user");
    localStorage.removeItem("zhu_mobile_account");

    setEmail("");
    setPassword("");
    setIsCreator(false);
    setMemberInfo(null);
    setPage("login");
  };

  const register = () => {
    if (!agreed) {
      setRegisterMsg("請先勾選同意免責聲明");
      return;
    }

    setRegisterMsg("註冊成功，已啟用免費試用一個月");

    setTimeout(() => {
      setPage("home");
    }, 900);
  };

  const isLoggedIn = page !== "login" && page !== "register";

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>股市原之助</h1>
          <p>ZHU STOCK APP｜手機網頁版</p>
        </div>

        {isLoggedIn && (
          <button className="logout" onClick={logout}>
            登出
          </button>
        )}
      </header>

      {page === "login" && (
        <section className="panel">
          <h2>會員登入</h2>

          <input
            placeholder="Email / 帳號"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            placeholder="密碼"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button onClick={login}>會員登入</button>

          <p className="link" onClick={() => setPage("register")}>
            還沒有帳號？前往註冊
          </p>
        </section>
      )}

      {page === "register" && (
        <section className="panel">
          <h2>註冊會員</h2>

          <input placeholder="Email" />
          <input placeholder="密碼" type="password" />
          <input placeholder="確認密碼" type="password" />
          <input placeholder="推薦碼（選填）" />

          <div className="trialBox">
            <h3>🎁 免費試用一個月</h3>
            <p>
              新會員完成註冊後，可免費試用 ZHU STOCK APP 一個月。
              試用期間可體驗手機網頁版功能。
            </p>
          </div>

          <div className="notice">
            <h3>免責聲明</h3>
            <p>本系統僅供資料整理、技術分析與研究參考，不構成任何投資建議。</p>
            <p>所有投資決策與盈虧結果，均由使用者自行承擔。</p>
          </div>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            我已閱讀並同意免責聲明
          </label>

          {registerMsg && <div className="message">{registerMsg}</div>}

          <button disabled={!agreed} onClick={register}>
            註冊並開始免費試用一個月
          </button>

          <p className="link" onClick={() => setPage("login")}>
            已有帳號？返回登入
          </p>
        </section>
      )}

      <HomePage setPage={setPage} isCreator={isCreator} memberInfo={memberInfo} />
      {page === "bullish" && <StockListPage title="📈 看多清單" type="bullish" />}
      {page === "bearish" && <StockListPage title="📉 看空清單" type="bearish" />}
      {page === "warrant" && <WarrantPage />}
      {page === "member" && <MemberPage setPage={setPage} />}
      {page === "referral" && <ReferralPage />}
      {page === "subscribe" && (
        <SubscribePage showBankInfo={showBankInfo} setShowBankInfo={setShowBankInfo} />
      )}
      {page === "admin" && isCreator && <AdminPage />}

      {isLoggedIn && (
        <nav className="bottomNav">
          <button className={page === "home" ? "active" : ""} onClick={() => setPage("home")}>
            首頁
          </button>
          <button className={page === "bullish" ? "active" : ""} onClick={() => setPage("bullish")}>
            看多
          </button>
          <button className={page === "bearish" ? "active" : ""} onClick={() => setPage("bearish")}>
            看空
          </button>
          <button className={page === "warrant" ? "active" : ""} onClick={() => setPage("warrant")}>
            權證
          </button>
          <button className={page === "member" ? "active" : ""} onClick={() => setPage("member")}>
            會員
          </button>
          <button
  className={page === "admin" ? "active" : ""}
  onClick={() => setPage("admin")}
>
  後台
</button>
        </nav>
      )}
    </div>
  );
}

function HomePage({ setPage, isCreator, memberInfo }) {
  return (
    <>
      <section className="hero">
        <h2>今日分析中心</h2>
        <p>
          會員狀態：
          {memberInfo?.label || (memberInfo?.allowed ? "可使用" : "已到期")}
        </p>
      </section>

      <section className="card-grid">
        <div className="card bullish" onClick={() => setPage("bullish")}>
          <h3>📈 看多清單</h3>
          <p>高機率強勢標的</p>
        </div>

        <div className="card bearish" onClick={() => setPage("bearish")}>
          <h3>📉 看空清單</h3>
          <p>弱勢觀察標的</p>
        </div>

        <div className="card warrant" onClick={() => setPage("warrant")}>
          <h3>🎯 權證專區</h3>
          <p>會員限定功能</p>
        </div>

        <div className="card holdings" onClick={() => setPage("referral")}>
          <h3>🤝 推薦制度</h3>
          <p>查看推薦獎勵規則</p>
        </div>
      </section>

      {isCreator && (
        <section className="creatorBox" onClick={() => setPage("admin")}>
          <h3>👑 創作者後台</h3>
          <p>付款審核 / 會員管理 / 推薦資料</p>
        </section>
      )}
    </>
  );
}

function StockListPage({ title, type }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setData(type === "bullish" ? bullishStocks : bearishStocks);
    setLoading(false);
  }, [type]);

  return (
    <section className="panel pageWithNav">
      <h2>{title}</h2>

      {loading && <p>資料讀取中...</p>}
      {!loading && data.length === 0 && <p>目前沒有資料</p>}

      {data.map((s) => (
        <div className="stockItem" key={s.stock_id || s.code}>
          <strong>
            {s.stock_id || s.code} {s.name}
          </strong>
          <span>{s.stars || s.star}</span>
          <small>StrongScore：{s.strong_score || s.score}</small>
          <small>乖離率：{s.bias}</small>
        </div>
      ))}
    </section>
  );
}

function WarrantPage() {
  const sample = [
    { code: "088888", name: "台積電元大購01", issuer: "元大", type: "認購" },
    { code: "077777", name: "鴻海凱基購02", issuer: "凱基", type: "認購" },
    { code: "066666", name: "聯發科群益購03", issuer: "群益金鼎", type: "認購" },
  ];

  return (
    <section className="panel pageWithNav">
      <h2>🎯 權證專區</h2>
      <p className="subText">五顆星、StrongScore ≥ 100、乖離率 &lt; 50 的標的優先觀察。</p>

      {sample.map((w) => (
        <div className="stockItem" key={w.code}>
          <strong>
            {w.code} {w.name}
          </strong>
          <span>類型：{w.type}</span>
          <small>發行券商：{w.issuer}</small>
        </div>
      ))}
    </section>
  );
}

function MemberPage({ setPage }) {
  return (
    <section className="panel pageWithNav">
      <h2>會員狀態</h2>

      <div className="adminItem">目前狀態：免費試用中</div>
      <div className="adminItem">免費試用：一個月</div>
      <div className="adminItem">訂閱期限：尚未串接</div>
      <div className="adminItem">權證專區：尚未串接</div>

      <div className="adminItem" onClick={() => setPage("subscribe")}>
        前往訂閱方案
      </div>

      <div className="adminItem" onClick={() => setPage("referral")}>
        推薦制度
      </div>
    </section>
  );
}

function ReferralPage() {
  return (
    <section className="panel pageWithNav">
      <h2>推薦制度</h2>

      <div className="notice">
        <p>被推薦者訂閱半年方案，推薦者額外獲得 1 個月。</p>
        <p>被推薦者訂閱年方案，推薦者額外獲得 2 個月。</p>
        <p>推薦獎勵需經管理端核對後生效。</p>
      </div>
    </section>
  );
}

function SubscribePage({ showBankInfo, setShowBankInfo }) {
  const [planType, setPlanType] = useState("");
  const [payerName, setPayerName] = useState("");
  const [last5, setLast5] = useState("");
  const [amount, setAmount] = useState("");

  const submitPaymentReport = async () => {
    const token = localStorage.getItem("zhu_mobile_token");

    if (!token) {
      alert("請重新登入");
      return;
    }

    if (!planType || !payerName || !last5 || !amount) {
      alert("請完整填寫付款資料");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/payments/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan_type: planType,
          amount: Number(amount),
          transfer_last5: last5,
          payer_name: payerName,
          transfer_time: new Date().toISOString(),
          note: "",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.detail || "送出失敗");
        return;
      }

      alert(data.message || "付款審核已送出");
    } catch (err) {
      console.error(err);
      alert("連線失敗");
    }
  };

  return (
    <section className="panel pageWithNav">
      <h2>訂閱方案</h2>

      <div className="planCard">
        <h3>月訂閱</h3>
        <p>NT$ 2888</p>
      </div>

      <div className="planCard">
        <h3>半年方案</h3>
        <p>NT$ 14888</p>
      </div>

      <div className="planCard">
        <h3>年方案</h3>
        <p>NT$ 28888</p>
      </div>

      <div className="notice">
        <h3>付款前聲明</h3>
        <p>本系統為資訊分析輔助工具，不保證任何獲利與投資成果。</p>
        <p>系統不會自動開通，管理員確認收款後才會啟用會員權限。</p>
        <p>若於免費試用期間提前訂閱，正式會員時間將於試用結束後開始計算。</p>
        <p>付款後請填寫匯款銀行、末五碼與金額，送出後由管理員人工審核。</p>
      </div>

      {!showBankInfo && (
        <button onClick={() => setShowBankInfo(true)}>我同意，顯示匯款帳號</button>
      )}

      {showBankInfo && (
        <>
          <div className="bankBox">
            <h3>匯款帳號</h3>

            <div className="bankItem">
              <strong>元大銀行</strong>
              <p>銀行代碼：806</p>
              <p>帳號：20342720080940</p>
            </div>

            <div className="bankItem">
              <strong>兆豐銀行</strong>
              <p>銀行代碼：017</p>
              <p>帳號：03910980975</p>
            </div>
          </div>

          <input
            placeholder="選擇訂閱方案 monthly / quarterly / yearly"
            value={planType}
            onChange={(e) => setPlanType(e.target.value)}
          />

          <input
            placeholder="匯款銀行 / 付款人"
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
          />

          <input
            placeholder="匯款末五碼"
            value={last5}
            onChange={(e) => setLast5(e.target.value)}
          />

          <input
            placeholder="匯款金額"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <button onClick={submitPaymentReport}>送出付款審核</button>
        </>
      )}
    </section>
  );
}

function AdminPage() {
  const [adminUsers, setAdminUsers] = useState([]);
  const [paymentReports, setPaymentReports] = useState([]);
  const [adminPage, setAdminPage] = useState("");

  const authHeaders = () => {
    const token = localStorage.getItem("zhu_mobile_token");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const loadAdminUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/users`, {
        headers: authHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.detail || "讀取會員失敗");
        return;
      }

      setAdminUsers(data.items || []);
    } catch (err) {
      console.error(err);
      alert("讀取會員失敗");
    }
  };

  const loadPaymentReports = async () => {
    try {
      const token = localStorage.getItem("zhu_mobile_token");

const data = await adminFetch("/admin/payment-reports", token);

setPaymentReports(data.items || []);
    } catch (err) {
      console.error(err);
      alert("讀取付款審核失敗");
    }
  };

  const approvePayment = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/admin/approve-payment-report/${id}`, {
        method: "POST",
        headers: authHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.detail || "審核失敗");
        return;
      }

      alert(data.message || "付款已核准");
      loadPaymentReports();
      loadAdminUsers();
    } catch (err) {
      console.error(err);
      alert("審核失敗");
    }
  };

  const rejectPayment = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/admin/reject-payment-report/${id}`, {
        method: "POST",
        headers: authHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.detail || "退回失敗");
        return;
      }

      alert(data.message || "付款已退回");
      loadPaymentReports();
    } catch (err) {
      console.error(err);
      alert("退回失敗");
    }
  };

  return (
    <section className="panel pageWithNav">
      <h2>👑 創作者最高權限</h2>

      <div
        className="adminItem"
        onClick={() => {
          setAdminPage("payment");
          loadPaymentReports();
        }}
      >
        付款審核
      </div>

      <div
        className="adminItem"
        onClick={() => {
          setAdminPage("member");
          loadAdminUsers();
        }}
      >
        會員管理
      </div>

      <div className="adminItem" onClick={() => alert("推薦組織圖功能待重建")}>
        推薦組織圖
      </div>

      <div className="adminItem" onClick={() => alert("用戶回饋功能待重建")}>
        用戶回饋
      </div>

      <div className="adminItem" onClick={() => alert("手機版資料目前使用網頁版獨立資料")}>
        手機版資料同步狀態
      </div>

      {adminPage === "payment" && (
        <div className="adminList">
          <h3>付款審核（{paymentReports.length}）</h3>

          {paymentReports.length === 0 && <p>目前沒有付款回報</p>}

          {paymentReports.map((r) => (
            <div className="adminUserCard" key={r.id}>
              <div>帳號：{r.username}</div>
              <div>Email：{r.email}</div>
              <div>方案：{r.plan_type}</div>
              <div>匯款後五碼：{r.transfer_last5 || "-"}</div>
              <div>金額：{r.amount}</div>
              <div>付款人：{r.payer_name || "-"}</div>
              <div>狀態：{r.status}</div>
              <div>
                建立日：
                {r.created_at ? new Date(r.created_at).toLocaleString("zh-TW") : "-"}
              </div>

              <button className="adminBtn" onClick={() => approvePayment(r.id)}>
                審核通過
              </button>

              <button className="adminBtn" onClick={() => rejectPayment(r.id)}>
                退回申請
              </button>
            </div>
          ))}
        </div>
      )}

      {adminPage === "member" && (
        <div className="adminList">
          <h3>會員列表（{adminUsers.length}）</h3>

          {adminUsers.length === 0 && <p>目前沒有會員資料</p>}

          {adminUsers.map((u) => (
            <div className="adminUserCard" key={u.id}>
              <div>帳號：{u.username}</div>
              <div>姓名：{u.full_name || "-"}</div>
              <div>Email：{u.email}</div>
              <div>手機：{u.phone || "-"}</div>
              <div>方案：{u.plan_type}</div>
              <div>狀態：{u.subscription_status}</div>
              <div>剩餘天數：{u.days_left}</div>
              <div>
                到期日：
                {u.subscription_end_at
                  ? new Date(u.subscription_end_at).toLocaleDateString("zh-TW")
                  : "-"}
              </div>
              <div>
                註冊日：
                {u.created_at ? new Date(u.created_at).toLocaleDateString("zh-TW") : "-"}
              </div>

              <button
                onClick={async () => {
                  const response = await fetch(`${API_BASE}/admin/deactivate-user`, {
                    method: "POST",
                    headers: authHeaders(),
                    body: JSON.stringify({
                      account: u.username,
                      is_active: !u.is_active,
                    }),
                  });

                  const data = await response.json();

                  if (!response.ok) {
                    alert(data.detail || "操作失敗");
                    return;
                  }

                  loadAdminUsers();
                }}
              >
                {u.is_active ? "停用會員" : "啟用會員"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default App;
