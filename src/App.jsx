import { useEffect, useState } from "react";
import "./App.css";

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
  const checkLoginStatus = async () => {
    const savedAccount = localStorage.getItem("zhu_mobile_account");

    if (!savedAccount) return;

    try {
      const response = await fetch(
        `${API_BASE}/license/status?account=${savedAccount}`
      );

      const data = await response.json();

      if (response.ok) {
        setMemberInfo(data);
        setIsCreator(Boolean(data.is_creator));

        localStorage.setItem(
          "zhu_mobile_user",
          JSON.stringify(data)
        );

        setPage("home");
      } else {
        localStorage.removeItem("zhu_mobile_user");
        localStorage.removeItem("zhu_mobile_account");
      }
    } catch (err) {
      console.error(err);
    }
  };

  checkLoginStatus();
}, []);

  const login = async (creator = false) => {
    if (creator) {
  setIsCreator(true);
}

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
  password: password,
}),
      });

      const data = await response.json();

      if (response.ok) {
  localStorage.setItem("zhu_mobile_user", JSON.stringify(data));
  localStorage.setItem("zhu_mobile_account", email);

  setMemberInfo(data);

  setIsCreator(Boolean(data.is_creator) || creator);
  setPage("home");
} 
else {
  const errorText =
    typeof data.detail === "string"
      ? data.detail
      : data.message
      ? data.message
      : JSON.stringify(data);

  alert(errorText || "登入失敗");
}
    } catch (error) {
      console.error(error);
      alert("伺服器連線失敗");
    }
  };

  const logout = () => {
  localStorage.removeItem("zhu_mobile_user");
  localStorage.removeItem("zhu_mobile_account");

  setEmail("");
  setPassword("");
  setIsCreator(false);
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
          <input placeholder="確認密碼" type="password" />
          <input placeholder="推薦碼（選填）" />

          <div className="trialBox">
            <h3>🎁 免費試用一個月</h3>
            <p>
              新會員完成註冊後，可免費試用 ZHU STOCK APP 一個月。
              試用期間可體驗手機網頁版功能，後續訂閱狀態將與電腦版會員系統同步。
            </p>
          </div>

          <div className="notice">
            <h3>免責聲明</h3>
            <p>
              本系統僅供資料整理、技術分析與研究參考，不構成任何投資建議、
              理財建議、招攬或推薦買賣。
            </p>
            <p>所有投資決策、下單行為與盈虧結果，均由使用者自行判斷並自行承擔。</p>
            <p>
              本系統不保證任何分析結果、技術訊號、選股條件之正確性、
              即時性與可獲利性。
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
        <SubscribePage
          showBankInfo={showBankInfo}
          setShowBankInfo={setShowBankInfo}
        />
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

function HomePage({ setPage, isCreator, memberInfo }) {
  return (
    <>
      <section className="hero">
        <h2>今日分析中心</h2>
        <p>
  會員狀態：
  {memberInfo?.is_paid
    ? "已訂閱"
    : memberInfo?.trial_active
    ? "免費試用中"
    : "已到期"}
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
  const bullish = [
    { code: "2330", name: "台積電", score: 128, star: "★★★★★", bias: "18.2%" },
    { code: "2317", name: "鴻海", score: 116, star: "★★★★★", bias: "12.7%" },
    { code: "2454", name: "聯發科", score: 108, star: "★★★★★", bias: "10.5%" },
  ];

  const bearish = [
    { code: "2603", name: "長榮", score: 102, star: "★★★★☆", bias: "-9.8%" },
    { code: "2615", name: "萬海", score: 96, star: "★★★★☆", bias: "-7.4%" },
    { code: "3481", name: "群創", score: 91, star: "★★★★☆", bias: "-6.3%" },
  ];

  const data = type === "bullish" ? bullish : bearish;

  return (
    <section className="panel pageWithNav">
      <h2>{title}</h2>

      {data.map((s) => (
        <div className="stockItem" key={s.code}>
          <strong>
            {s.code} {s.name}
          </strong>
          <span>{s.star}</span>
          <small>StrongScore：{s.score}</small>
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
        <button onClick={() => setShowBankInfo(true)}>
          我同意，顯示匯款帳號
        </button>
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

          <input placeholder="選擇訂閱方案（月 / 半年 / 年）" />
          <input placeholder="匯款銀行" />
          <input placeholder="匯款末五碼" />
          <input placeholder="匯款金額" />

          <button>送出付款審核</button>
        </>
      )}
    </section>
  );
}

function AdminPage() {

  const [adminUsers, setAdminUsers] = useState([]);
  const loadAdminUsers = async () => {
  try {

    const response = await fetch(
      `${API_BASE}/admin/users`
    );

    const data = await response.json();

    console.log(data);

    alert(`成功取得 ${data.length} 位會員`);

  } catch (err) {
    console.error(err);
    alert("讀取會員失敗");
  }
};
  return (
    <section className="panel pageWithNav">
      <h2>👑 創作者最高權限</h2>

      <div
  className="adminItem"
  onClick={() => alert("付款審核功能開發中")}
>
  付款審核
</div>
      <div className="adminItem" onClick={loadAdminUsers}>
  會員管理
</div>
      <div className="adminItem" onClick={() => alert("推薦組織圖功能開發中")}>
  推薦組織圖
</div>

<div className="adminItem" onClick={() => alert("用戶回饋功能開發中")}>
  用戶回饋
</div>

<div className="adminItem" onClick={() => alert("手機版資料同步狀態正常")}>
  手機版資料同步狀態
</div>
    </section>
  );
}

export default App;