import { useState } from "react";
import "./App.css";

function App() {
  const [page, setPage] = useState("login");
  const [isCreator, setIsCreator] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const login = (creator = false) => {
    setIsCreator(creator);
    setPage("home");
  };

  const logout = () => {
    setIsCreator(false);
    setPage("login");
  };

  const isLoggedIn = page !== "login" && page !== "register";

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>股市原之助</h1>
          <p>ZHU STOCK APP｜手機網頁版</p>
        </div>
        {isLoggedIn && <button className="logout" onClick={logout}>登出</button>}
      </header>

      {page === "login" && (
        <section className="panel">
          <h2>會員登入</h2>
          <input placeholder="Email / 帳號" />
          <input placeholder="密碼" type="password" />
          <button onClick={() => login(false)}>一般會員登入</button>
          <button className="creatorBtn" onClick={() => login(true)}>
            創作者最高權限登入測試
          </button>
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
          <input placeholder="推薦碼（選填）" />

          <div className="notice">
            <h3>免責聲明</h3>
            <p>
              本系統僅供資料整理、技術分析與研究參考，不構成任何投資建議。
              所有交易決策由使用者自行判斷，盈虧自負。
            </p>
          </div>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            我已閱讀並同意免責聲明
          </label>

          <button disabled={!agreed} onClick={() => setPage("home")}>
            註冊並開始免費試用一個月
          </button>

          <p className="link" onClick={() => setPage("login")}>
            已有帳號？返回登入
          </p>
        </section>
      )}

      {page === "home" && <HomePage setPage={setPage} isCreator={isCreator} />}
      {page === "bullish" && <ListPage title="📈 看多清單" setPage={setPage} />}
      {page === "bearish" && <ListPage title="📉 看空清單" setPage={setPage} />}
      {page === "warrant" && <ListPage title="🎯 權證專區" setPage={setPage} />}
      {page === "member" && <MemberPage setPage={setPage} />}
      {page === "referral" && <ReferralPage setPage={setPage} />}
      {page === "admin" && isCreator && <AdminPage setPage={setPage} />}

      {isLoggedIn && (
        <nav className="bottomNav">
          <button className={page === "home" ? "active" : ""} onClick={() => setPage("home")}>首頁</button>
          <button className={page === "bullish" ? "active" : ""} onClick={() => setPage("bullish")}>看多</button>
          <button className={page === "bearish" ? "active" : ""} onClick={() => setPage("bearish")}>看空</button>
          <button className={page === "warrant" ? "active" : ""} onClick={() => setPage("warrant")}>權證</button>
          <button className={page === "member" ? "active" : ""} onClick={() => setPage("member")}>會員</button>
          {isCreator && (
            <button className={page === "admin" ? "active" : ""} onClick={() => setPage("admin")}>後台</button>
          )}
        </nav>
      )}
    </div>
  );
}

function HomePage({ setPage, isCreator }) {
  return (
    <>
      <section className="hero">
        <h2>今日分析中心</h2>
        <p>會員狀態：免費試用 / 已訂閱 / 已到期</p>
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

function ListPage({ title }) {
  const sample = [
    { code: "2330", name: "台積電", score: 128, star: "★★★★★" },
    { code: "2317", name: "鴻海", score: 116, star: "★★★★★" },
    { code: "2454", name: "聯發科", score: 108, star: "★★★★★" },
  ];

  return (
    <section className="panel pageWithNav">
      <h2>{title}</h2>
      {sample.map((s) => (
        <div className="stockItem" key={s.code}>
          <strong>{s.code} {s.name}</strong>
          <span>{s.star}</span>
          <small>StrongScore：{s.score}</small>
        </div>
      ))}
    </section>
  );
}

function MemberPage({ setPage }) {
  return (
    <section className="panel pageWithNav">
      <h2>會員狀態</h2>
      <div className="adminItem">目前狀態：測試中</div>
      <div className="adminItem">免費試用：一個月</div>
      <div className="adminItem">訂閱期限：尚未串接</div>
      <div className="adminItem" onClick={() => setPage("referral")}>推薦制度</div>
    </section>
  );
}

function ReferralPage() {
  return (
    <section className="panel pageWithNav">
      <h2>推薦制度</h2>
      <p>被推薦者訂閱半年方案，推薦者額外獲得 1 個月。</p>
      <p>被推薦者訂閱年方案，推薦者額外獲得 2 個月。</p>
    </section>
  );
}

function AdminPage() {
  return (
    <section className="panel pageWithNav">
      <h2>👑 創作者最高權限</h2>
      <div className="adminItem">付款審核</div>
      <div className="adminItem">會員管理</div>
      <div className="adminItem">推薦組織圖</div>
      <div className="adminItem">用戶回饋</div>
      <div className="adminItem">手機版資料同步狀態</div>
    </section>
  );
}

export default App;