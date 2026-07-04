import { useEffect, useState } from "react";
import "./App.css";
import {
  fetchWebAnalysisStatus,
  fetchWebStockList,
  fetchWebWarrants,
  formatElapsed,
  runWebAnalysisRequest,
  waitForAnalysisComplete,
} from "./webAnalysis";

const API_BASE = "https://zhu-stock-app.onrender.com";

function getToken() {
  return localStorage.getItem("zhu_mobile_token");
}

function authHeaders(json = true) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

function parseError(data) {
  if (typeof data?.detail === "string") return data.detail;
  if (data?.message) return data.message;
  if (Array.isArray(data?.detail)) {
    return data.detail.map((item) => item.msg).join("，");
  }
  return "操作失敗";
}

function getMemberStatusLabel(info) {
  if (!info) return "未知";
  if (info.label) return info.label;
  if (info.license_label) return info.license_label;

  const status = info.subscription_status;
  if (status === "paid" || status === "subscribed" || status === "vip") return "已訂閱";
  if (status === "trial") return "免費試用中";
  if (info.trial_active) return "免費試用中";
  if (info.is_paid) return "已訂閱";
  return "已到期";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("zh-TW");
}

function App() {
  const [page, setPage] = useState("login");
  const [isCreator, setIsCreator] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showBankInfo, setShowBankInfo] = useState(false);
  const [registerMsg, setRegisterMsg] = useState("");
  const [registerStep, setRegisterStep] = useState("form");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [memberInfo, setMemberInfo] = useState(null);

  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regCode, setRegCode] = useState("");

  const [analysisMeta, setAnalysisMeta] = useState(null);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [localElapsed, setLocalElapsed] = useState(0);

  const loadAnalysisStatus = async () => {
    if (!getToken()) {
      const local = await fetchWebAnalysisStatus(API_BASE, authHeaders);
      if (local) setAnalysisMeta(local);
      return;
    }

    const data = await fetchWebAnalysisStatus(API_BASE, authHeaders);
    if (data) setAnalysisMeta(data);
  };

  const runWebAnalysis = async (force = false) => {
    if (!getToken()) {
      alert("請先登入");
      setPage("login");
      return;
    }

    setAnalysisRunning(true);
    setLocalElapsed(0);

    try {
      const result = await runWebAnalysisRequest(API_BASE, authHeaders, { force });

      if (!result.ok) {
        alert(result.message || "分析失敗，無法取得台股資料");
        return;
      }

      setAnalysisMeta(result.data);

      if (result.data?.job_status === "running") {
        const final = await waitForAnalysisComplete(API_BASE, authHeaders, (status) => {
          setAnalysisMeta(status);
        });

        if (final.data) setAnalysisMeta(final.data);

        if (final.ok) {
          alert(
            `分析完成\n結算日：${final.data?.settle_date || "—"}\n看多：${final.data?.bullish_count ?? 0} 檔\n看空：${final.data?.bearish_count ?? 0} 檔\n權證：${final.data?.warrant_count ?? 0} 筆`
          );
        } else if (final.message) {
          alert(final.message);
        }
      }
    } catch (error) {
      console.error(error);
      alert("分析失敗");
    } finally {
      setAnalysisRunning(false);
    }
  };

  const refreshMemberInfo = async (account) => {
    const savedAccount = account || localStorage.getItem("zhu_mobile_account");
    if (!savedAccount && !getToken()) return null;

    try {
      const response = await fetch(
        `${API_BASE}/license/status?account=${encodeURIComponent(savedAccount || "")}`,
        { headers: authHeaders(false) }
      );
      const data = await response.json();

      if (response.ok) {
        setMemberInfo((prev) => ({ ...(prev || {}), ...data }));
        if (data.is_creator != null) {
          setIsCreator(Boolean(data.is_creator));
        }
        return data;
      }
    } catch (err) {
      console.error(err);
    }

    return null;
  };

  useEffect(() => {
    const checkLoginStatus = async () => {
      const savedAccount = localStorage.getItem("zhu_mobile_account");
      if (!savedAccount) return;

      const data = await refreshMemberInfo(savedAccount);
      if (!data) {
        localStorage.removeItem("zhu_mobile_user");
        localStorage.removeItem("zhu_mobile_account");
        localStorage.removeItem("zhu_mobile_token");
        return;
      }

      if (data.is_creator != null) {
        setIsCreator(Boolean(data.is_creator));
      } else {
        const savedUser = localStorage.getItem("zhu_mobile_user");
        if (savedUser) {
          try {
            const parsed = JSON.parse(savedUser);
            setIsCreator(Boolean(parsed.user?.is_creator || parsed.is_creator));
          } catch {
            setIsCreator(false);
          }
        }
      }

      setPage("home");
      loadAnalysisStatus();
    };

    checkLoginStatus();
  }, []);

  useEffect(() => {
    if (page === "home" && getToken()) {
      loadAnalysisStatus();
    }
  }, [page]);

  useEffect(() => {
    const analyzing = analysisRunning || analysisMeta?.job_status === "running";
    if (!analyzing) {
      setLocalElapsed(0);
      return undefined;
    }
    const timer = setInterval(() => {
      setLocalElapsed((sec) => sec + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [analysisRunning, analysisMeta?.job_status]);

  useEffect(() => {
    if (analysisMeta?.job_status !== "running" || !getToken()) return undefined;
    const timer = setInterval(() => {
      loadAnalysisStatus();
    }, 3000);
    return () => clearInterval(timer);
  }, [analysisMeta?.job_status]);

  const login = async () => {
    if (!email || !password) {
      alert("請輸入 Email / 帳號與密碼");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          account: email,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("zhu_mobile_user", JSON.stringify(data));
        localStorage.setItem("zhu_mobile_account", email);
        localStorage.setItem("zhu_mobile_token", data.access_token);

        setMemberInfo(data);
        setIsCreator(Boolean(data.user?.is_creator));
        await refreshMemberInfo(email);
        await loadAnalysisStatus();
        setPage("home");
      } else {
        alert(parseError(data) || "登入失敗");
      }
    } catch (error) {
      console.error(error);
      alert("伺服器連線失敗");
    }
  };

  const logout = () => {
    localStorage.removeItem("zhu_mobile_user");
    localStorage.removeItem("zhu_mobile_account");
    localStorage.removeItem("zhu_mobile_token");

    setEmail("");
    setPassword("");
    setMemberInfo(null);
    setIsCreator(false);
    setPage("login");
  };

  const sendRegisterCode = async () => {
    if (!agreed) {
      setRegisterMsg("請先勾選同意免責聲明");
      return;
    }

    if (!regUsername || !regEmail || !regPassword || !regConfirm) {
      setRegisterMsg("請完整填寫帳號、Email、密碼");
      return;
    }

    if (regPassword !== regConfirm) {
      setRegisterMsg("密碼與確認密碼不一致");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/send-register-code`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          username: regUsername,
          email: regEmail,
          password: regPassword,
          confirm_password: regConfirm,
          phone: regPhone,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setRegisterStep("code");
        setRegisterMsg(
          data.dev_code
            ? `驗證碼已寄出（測試碼：${data.dev_code}）`
            : "驗證碼已寄到 Email，請查收"
        );
      } else {
        setRegisterMsg(parseError(data));
      }
    } catch (error) {
      console.error(error);
      setRegisterMsg("伺服器連線失敗");
    }
  };

  const verifyRegister = async () => {
    if (!regCode) {
      setRegisterMsg("請輸入 Email 驗證碼");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/verify-register-code`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          username: regUsername,
          email: regEmail,
          password: regPassword,
          confirm_password: regConfirm,
          phone: regPhone,
          code: regCode,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("zhu_mobile_user", JSON.stringify(data));
        localStorage.setItem("zhu_mobile_account", regEmail);
        localStorage.setItem("zhu_mobile_token", data.access_token);

        setEmail(regEmail);
        setPassword(regPassword);
        setMemberInfo(data);
        setIsCreator(false);
        setRegisterMsg("註冊成功，已啟用免費試用");
        await refreshMemberInfo(regEmail);
        setTimeout(() => setPage("home"), 600);
      } else {
        setRegisterMsg(parseError(data));
      }
    } catch (error) {
      console.error(error);
      setRegisterMsg("伺服器連線失敗");
    }
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

          <button onClick={() => login()}>登入</button>

          <p className="subText">創作者帳號登入後，底部導覽會出現「後台」。</p>

          <p className="link" onClick={() => setPage("register")}>
            還沒有帳號？前往註冊
          </p>
        </section>
      )}

      {page === "register" && (
        <section className="panel">
          <h2>註冊會員</h2>

          <input
            placeholder="帳號"
            value={regUsername}
            onChange={(e) => setRegUsername(e.target.value)}
          />
          <input
            placeholder="Email"
            value={regEmail}
            onChange={(e) => setRegEmail(e.target.value)}
          />
          <input
            placeholder="密碼"
            type="password"
            value={regPassword}
            onChange={(e) => setRegPassword(e.target.value)}
          />
          <input
            placeholder="確認密碼"
            type="password"
            value={regConfirm}
            onChange={(e) => setRegConfirm(e.target.value)}
          />
          <input
            placeholder="手機（選填）"
            value={regPhone}
            onChange={(e) => setRegPhone(e.target.value)}
          />

          {registerStep === "code" && (
            <input
              placeholder="Email 驗證碼"
              value={regCode}
              onChange={(e) => setRegCode(e.target.value)}
            />
          )}

          <div className="trialBox">
            <h3>🎁 免費試用一個月</h3>
            <p>新會員完成註冊後，可免費試用手機網頁版，會員帳號全平台共用。</p>
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

          {registerStep === "form" ? (
            <button disabled={!agreed} onClick={sendRegisterCode}>
              寄送 Email 驗證碼
            </button>
          ) : (
            <button disabled={!agreed} onClick={verifyRegister}>
              完成註冊
            </button>
          )}

          <p className="link" onClick={() => setPage("login")}>
            已有帳號？返回登入
          </p>
        </section>
      )}

      {page === "home" && (
        <HomePage
          setPage={setPage}
          isCreator={isCreator}
          memberInfo={memberInfo}
          analysisMeta={analysisMeta}
          analysisRunning={analysisRunning}
          localElapsed={localElapsed}
          onRunAnalysis={runWebAnalysis}
        />
      )}
      {page === "bullish" && (
        <StockListPage title="📈 看多清單" type="bullish" memberInfo={memberInfo} setPage={setPage} />
      )}
      {page === "bearish" && (
        <StockListPage title="📉 看空清單" type="bearish" memberInfo={memberInfo} setPage={setPage} />
      )}
      {page === "warrant" && <WarrantPage memberInfo={memberInfo} setPage={setPage} />}
      {page === "member" && (
        <MemberPage setPage={setPage} memberInfo={memberInfo} onRefresh={refreshMemberInfo} />
      )}
      {page === "referral" && <ReferralPage />}
      {page === "feedback" && <FeedbackPage />}
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
          {isCreator && (
            <button className={page === "admin" ? "active" : ""} onClick={() => setPage("admin")}>
              後台
            </button>
          )}
        </nav>
      )}
    </div>
  );
}

function HomePage({ setPage, isCreator, memberInfo, analysisMeta, onRunAnalysis, analysisRunning, localElapsed }) {
  const isAnalyzing = analysisRunning || analysisMeta?.job_status === "running";
  const serverProgress = Number(analysisMeta?.job_progress) || 0;
  const serverElapsed = Number(analysisMeta?.job_elapsed_sec) || 0;
  const elapsed = Math.max(localElapsed, serverElapsed);
  const progress = Math.max(
    serverProgress,
    isAnalyzing ? Math.min(95, Math.max(5, Math.round((elapsed / 90) * 100))) : 0
  );
  const orphanRunning = analysisMeta?.job_status === "running" && !analysisMeta?.job_started_at;
  const stuck = isAnalyzing && (orphanRunning || (elapsed >= 15 && serverProgress === 0 && !analysisMeta?.job_started_at));

  return (
    <>
      <section className="hero">
        <h2>今日分析中心</h2>
        <p>會員狀態：{getMemberStatusLabel(memberInfo)}</p>
        {memberInfo?.days_left != null && (
          <p>剩餘天數：{memberInfo.days_left} 天</p>
        )}
        {analysisMeta?.updated_at && (
          <p>
            最後更新：{analysisMeta.updated_at}
            {analysisMeta.settle_date ? `｜結算日 ${analysisMeta.settle_date}` : ""}
            {analysisMeta.bullish_count != null ? `｜看多 ${analysisMeta.bullish_count} 檔` : ""}
            {analysisMeta.bearish_count != null ? `｜看空 ${analysisMeta.bearish_count} 檔` : ""}
          </p>
        )}
        <p className="subText">每個交易日收盤後約 16:05 自動更新。看多/看空清單對齊桌面版（含上櫃補強、星等與 Alarm）。</p>

        {isAnalyzing && (
          <div className="analysisProgressBox">
            <div className="analysisProgressTop">
              <span>{analysisMeta?.job_message || "雲端分析進行中…"}</span>
              <strong>{progress}%</strong>
            </div>
            <div className="analysisProgressTrack">
              <div className="analysisProgressBar" style={{ width: `${Math.max(progress, 5)}%` }} />
            </div>
            <p className="subText">
              已耗時 {formatElapsed(elapsed)}（快取建立後約 1 分鐘；首次可能 3～5 分鐘）
            </p>
            {stuck && (
              <p className="message">分析似乎卡住了，請按下方「強制重新啟動」。</p>
            )}
          </div>
        )}

        {analysisMeta?.job_status === "failed" && !analysisMeta?.has_data && (
          <p className="message">{analysisMeta.job_error || analysisMeta.job_message || "上次分析失敗，請重新啟動"}</p>
        )}

        {stuck ? (
          <button onClick={() => onRunAnalysis(true)}>強制重新啟動</button>
        ) : (
          <button onClick={() => onRunAnalysis(false)} disabled={isAnalyzing}>
            {isAnalyzing ? "分析進行中…" : "立即更新分析"}
          </button>
        )}
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

function StockListPage({ title, type, memberInfo, setPage }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const licenseBlocked =
    memberInfo && memberInfo.allowed === false && !memberInfo.is_creator;

  useEffect(() => {
    if (licenseBlocked) {
      setLoading(false);
      setError(getMemberStatusLabel(memberInfo));
      return;
    }

    const loadStocks = async () => {
      setLoading(true);
      setError("");

      try {
        const { items } = await fetchWebStockList(type, API_BASE, authHeaders);
        setItems(Array.isArray(items) ? items : []);
      } catch (err) {
        console.error(err);
        setError(err?.message || "讀取失敗，請稍後再試");
      } finally {
        setLoading(false);
      }
    };

    loadStocks();
  }, [type, licenseBlocked, memberInfo]);

  const formatBias = (bias) => {
    if (bias === null || bias === undefined || bias === "") return "-";
    const text = String(bias);
    return text.includes("%") ? text : `${text}%`;
  };

  return (
    <section className="panel pageWithNav">
      <h2>{title}</h2>

      {loading && <div className="adminItem">載入中...</div>}
      {error && (
        <div className="message">
          {error}
          {licenseBlocked && (
            <div className="adminItem" onClick={() => setPage("subscribe")}>
              前往訂閱方案
            </div>
          )}
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="adminItem">
          尚無資料。每個交易日收盤後約 16:05 會自動更新；若剛收盤請稍候，或到首頁按「立即更新分析」。
        </div>
      )}

      {items.map((s, index) => {
        const code = s.stock_id || s.code || s.symbol || "-";
        const name = s.name || "";
        const stars = s.stars || s.star || "";
        const score = s.strong_score ?? s.score ?? "-";
        const bias = formatBias(s.bias);
        const market = s.market || "";
        const industry = s.industry || "";
        const shortAlarm = s.short_alarm || "";
        const longAlarm = s.long_alarm || "";

        return (
          <div className="stockItem" key={`${code}-${index}`}>
            <strong>
              {code} {name}
            </strong>
            {market && <span>{market}{industry ? `｜${industry}` : ""}</span>}
            <span>{stars}</span>
            {type === "bullish" && <small>StrongScore：{score}</small>}
            <small>乖離率：{bias}</small>
            {shortAlarm === "是" && <small className="alarm">短線Alarm</small>}
            {longAlarm === "是" && <small className="alarm">長線Alarm</small>}
            {s.settle_date && <small>週結：{s.settle_date}</small>}
            {s.memory_note && s.memory_note.includes("上櫃") && (
              <small>上櫃補強</small>
            )}
          </div>
        );
      })}
    </section>
  );
}

function WarrantPage({ memberInfo, setPage }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const licenseBlocked =
    memberInfo && memberInfo.allowed === false && !memberInfo.is_creator;

  useEffect(() => {
    if (licenseBlocked) {
      setLoading(false);
      setError(getMemberStatusLabel(memberInfo));
      return;
    }

    const loadWarrants = async () => {
      setLoading(true);
      setError("");

      try {
        const { items } = await fetchWebWarrants(API_BASE, authHeaders);
        setItems(Array.isArray(items) ? items : []);
      } catch (err) {
        console.error(err);
        setError(err?.message || "讀取失敗，請稍後再試");
      } finally {
        setLoading(false);
      }
    };

    loadWarrants();
  }, [licenseBlocked, memberInfo]);

  return (
    <section className="panel pageWithNav">
      <h2>🎯 權證專區</h2>
      <p className="subText">看多：週20MA＋趨勢突破守穩（同桌面版）。權證另篩 StrongScore≥100、5 星、剩餘 90～120 天。</p>

      {loading && <div className="adminItem">載入中...</div>}
      {error && (
        <div className="message">
          {error}
          {licenseBlocked && (
            <div className="adminItem" onClick={() => setPage("subscribe")}>
              前往訂閱方案
            </div>
          )}
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="adminItem">
          尚無權證資料。每個交易日收盤後約 16:05 會自動更新；若剛收盤請稍候。
        </div>
      )}

      {items.map((w, index) => {
        const code = w.code || w.stock_id || "-";
        const name = w.name || "";
        const issuer = w.issuer || w.broker || "-";
        const warrantType = w.type || "-";

        return (
          <div className="stockItem" key={`${code}-${index}`}>
            <strong>
              {code} {name}
            </strong>
            <span>類型：{warrantType}</span>
            <small>發行券商：{issuer}</small>
          </div>
        );
      })}
    </section>
  );
}

function MemberPage({ setPage, memberInfo, onRefresh }) {
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    await onRefresh();
    setLoading(false);
  };

  return (
    <section className="panel pageWithNav">
      <h2>會員狀態</h2>

      <div className="adminItem">目前狀態：{getMemberStatusLabel(memberInfo)}</div>
      <div className="adminItem">帳號：{memberInfo?.account || memberInfo?.user?.username || "—"}</div>
      <div className="adminItem">Email：{memberInfo?.email || memberInfo?.user?.email || "—"}</div>
      <div className="adminItem">方案：{memberInfo?.plan_type || "—"}</div>
      <div className="adminItem">剩餘天數：{memberInfo?.days_left ?? "—"} 天</div>
      <div className="adminItem">試用到期：{formatDate(memberInfo?.trial_end_at)}</div>
      <div className="adminItem">訂閱到期：{formatDate(memberInfo?.subscription_end_at)}</div>

      <button onClick={refresh} disabled={loading}>
        {loading ? "更新中..." : "刷新會員狀態"}
      </button>

      <div className="adminItem" onClick={() => setPage("subscribe")}>
        前往訂閱方案
      </div>

      <div className="adminItem" onClick={() => setPage("referral")}>
        推薦制度
      </div>

      <div className="adminItem" onClick={() => setPage("feedback")}>
        意見回饋
      </div>
    </section>
  );
}

function FeedbackPage() {
  const [topic, setTopic] = useState("功能建議");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");

  const submitFeedback = async () => {
    if (!content.trim()) {
      setMessage("請填寫回饋內容");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/feedback/submit`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          topic,
          content,
          app_version: "web-mobile",
          device_info: navigator.userAgent,
          feedback_id: crypto.randomUUID?.() || String(Date.now()),
        }),
      });
      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || "回饋已送出");
        setContent("");
      } else {
        setMessage(parseError(data));
      }
    } catch (error) {
      console.error(error);
      setMessage("伺服器連線失敗");
    }
  };

  return (
    <section className="panel pageWithNav">
      <h2>意見回饋</h2>
      <p className="subText">與桌面版相同，回饋會送交管理端處理。</p>

      <select value={topic} onChange={(e) => setTopic(e.target.value)}>
        <option value="功能建議">功能建議</option>
        <option value="操作問題">操作問題</option>
        <option value="資料疑問">資料疑問</option>
        <option value="其他">其他</option>
      </select>

      <textarea
        placeholder="請描述您的問題或建議"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={6}
      />

      {message && <div className="message">{message}</div>}

      <button onClick={submitFeedback}>送出回饋</button>
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
  const [selectedPlan, setSelectedPlan] = useState("monthly");
  const [transferLast5, setTransferLast5] = useState("");
  const [payerName, setPayerName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  const plans = [
    { id: "monthly", label: "月訂閱", price: 2888 },
    { id: "halfyear", label: "半年方案", price: 14888 },
    { id: "yearly", label: "年方案", price: 28888 },
  ];

  const submitPayment = async () => {
    if (!transferLast5) {
      setMessage("請填寫匯款末五碼");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/payments/report`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          plan_type: selectedPlan,
          amount: amount ? Number(amount) : plans.find((p) => p.id === selectedPlan)?.price,
          transfer_last5: transferLast5,
          payer_name: payerName,
          note,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || "付款回報已送出，待管理員審核");
      } else {
        setMessage(parseError(data));
      }
    } catch (error) {
      console.error(error);
      setMessage("伺服器連線失敗");
    }
  };

  return (
    <section className="panel pageWithNav">
      <h2>訂閱方案</h2>

      {plans.map((plan) => (
        <div
          key={plan.id}
          className={`planCard ${selectedPlan === plan.id ? "selected" : ""}`}
          onClick={() => setSelectedPlan(plan.id)}
        >
          <h3>{plan.label}</h3>
          <p>NT$ {plan.price.toLocaleString()}</p>
        </div>
      ))}

      <div className="notice">
        <h3>付款前聲明</h3>
        <p>本系統為資訊分析輔助工具，不保證任何獲利與投資成果。</p>
        <p>管理員確認收款後才會啟用會員權限。</p>
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
            placeholder="匯款人姓名（選填）"
            value={payerName}
            onChange={(e) => setPayerName(e.target.value)}
          />
          <input
            placeholder="匯款末五碼"
            value={transferLast5}
            onChange={(e) => setTransferLast5(e.target.value)}
          />
          <input
            placeholder="匯款金額"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <input
            placeholder="備註（選填）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {message && <div className="message">{message}</div>}

          <button onClick={submitPayment}>送出付款審核</button>
        </>
      )}
    </section>
  );
}

function AdminPage() {
  const [adminUsers, setAdminUsers] = useState([]);
  const [paymentReports, setPaymentReports] = useState([]);
  const [feedbackReports, setFeedbackReports] = useState([]);
  const [view, setView] = useState("menu");

  const loadAdminUsers = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/users`, {
        headers: authHeaders(false),
      });
      const data = await response.json();

      if (response.ok) {
        setAdminUsers(data.items || []);
        setView("users");
      } else {
        alert(parseError(data) || "讀取會員失敗");
      }
    } catch (err) {
      console.error(err);
      alert("讀取會員失敗");
    }
  };

  const loadPaymentReports = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/payment-reports`, {
        headers: authHeaders(false),
      });
      const data = await response.json();

      if (response.ok) {
        setPaymentReports(data.items || []);
        setView("payments");
      } else {
        alert(parseError(data) || "讀取付款資料失敗");
      }
    } catch (err) {
      console.error(err);
      alert("讀取付款資料失敗");
    }
  };

  const loadFeedbackReports = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/feedback`, {
        headers: authHeaders(false),
      });
      const data = await response.json();

      if (response.ok) {
        setFeedbackReports(data.items || []);
        setView("feedback");
      } else {
        alert(parseError(data) || "讀取回饋失敗");
      }
    } catch (err) {
      console.error(err);
      alert("讀取回饋失敗");
    }
  };

  const toggleUserActive = async (user) => {
    try {
      const response = await fetch(`${API_BASE}/admin/deactivate-user`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          account: user.username || user.email,
          is_active: !user.is_active,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert(data.message || "操作完成");
        loadAdminUsers();
      } else {
        alert(parseError(data) || "操作失敗");
      }
    } catch (err) {
      alert("操作失敗");
    }
  };

  const reviewPayment = async (reportId, action) => {
    const endpoint =
      action === "approve"
        ? `${API_BASE}/admin/approve-payment-report/${reportId}`
        : `${API_BASE}/admin/reject-payment-report/${reportId}?note=網頁版拒絕`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: authHeaders(false),
      });
      const data = await response.json();

      if (response.ok) {
        alert(data.message || "審核完成");
        loadPaymentReports();
      } else {
        alert(parseError(data) || "審核失敗");
      }
    } catch (err) {
      alert("審核失敗");
    }
  };

  return (
    <section className="panel pageWithNav">
      <h2>👑 創作者後台</h2>

      {view === "menu" && (
        <>
          <div className="adminItem" onClick={loadPaymentReports}>
            付款審核
          </div>
          <div className="adminItem" onClick={loadAdminUsers}>
            會員管理
          </div>
          <div className="adminItem" onClick={loadFeedbackReports}>
            會員回饋
          </div>
          <div className="adminItem" onClick={() => alert("推薦組織圖功能開發中")}>
            推薦組織圖
          </div>
        </>
      )}

      {view !== "menu" && (
        <button className="backBtn" onClick={() => setView("menu")}>
          返回後台選單
        </button>
      )}

      {view === "users" && adminUsers.length > 0 && (
        <div className="adminList">
          <h3>會員列表（{adminUsers.length}）</h3>

          {adminUsers.map((u) => (
            <div className="adminUserCard" key={u.id}>
              <div>帳號：{u.username}</div>
              <div>Email：{u.email}</div>
              <div>方案：{u.plan_type}</div>
              <div>狀態：{u.subscription_status}</div>
              <div>剩餘天數：{u.days_left}</div>
              {u.pending_review > 0 && <div>待審付款：{u.pending_review} 筆</div>}
              <button onClick={() => toggleUserActive(u)}>
                {u.is_active ? "停用會員" : "啟用會員"}
              </button>
            </div>
          ))}
        </div>
      )}

      {view === "payments" && (
        <div className="adminList">
          <h3>付款審核（{paymentReports.length}）</h3>

          {paymentReports.length === 0 && (
            <div className="adminItem">目前沒有待審資料</div>
          )}

          {paymentReports.map((report) => (
            <div className="adminUserCard" key={report.id}>
              <div>帳號：{report.username}</div>
              <div>方案：{report.plan_type}</div>
              <div>金額：{report.amount}</div>
              <div>末五碼：{report.transfer_last5}</div>
              <div>狀態：{report.status}</div>
              {report.status === "pending" && (
                <div className="adminActions">
                  <button onClick={() => reviewPayment(report.id, "approve")}>核准</button>
                  <button onClick={() => reviewPayment(report.id, "reject")}>拒絕</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {view === "feedback" && (
        <div className="adminList">
          <h3>會員回饋（{feedbackReports.length}）</h3>

          {feedbackReports.length === 0 && <div className="adminItem">目前沒有回饋</div>}

          {feedbackReports.map((item) => (
            <div className="adminUserCard" key={item.id}>
              <div>主題：{item.topic}</div>
              <div>帳號：{item.account || "—"}</div>
              <div>Email：{item.email || "—"}</div>
              <div>{item.content}</div>
              <div>時間：{formatDate(item.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default App;
