const STORAGE_KEY = "zhu_web_analysis_v1";
const TWSE_API = "/twse-api/exchangeReport/MI_INDEX";
const TWSE_OPENAPI_DAY_ALL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL";

const MAX_RESULTS = 50;
const MIN_DAILY_VOLUME_LOTS = 2000;
const MIN_TRADING_DAYS = 20;
// 完整策略（週K、趨勢線、StrongScore≥100、5星、週量≥1萬）僅後端 web_strategy 執行
const SCORE_THRESHOLD = 100;
const MIN_WEEKLY_VOLUME_LOTS = 10000;
const MIN_STARS = 5;

function cleanText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseNumber(value, isInt = false) {
  const text = cleanText(value).replace(/,/g, "").replace(/--/g, "");
  if (!text) return null;
  const num = Number(text);
  if (Number.isNaN(num)) return null;
  return isInt ? Math.trunc(num) : num;
}

function isValidStockCode(code) {
  return /^\d{4}$/.test(String(code));
}

function scoreToStars(score) {
  if (score >= 130) return "★★★★★";
  if (score >= 105) return "★★★★☆";
  if (score >= 80) return "★★★☆☆";
  if (score >= 60) return "★★☆☆☆";
  return "★☆☆☆☆";
}

function movingAverage(values, size) {
  if (values.length < size) return null;
  const window = values.slice(-size);
  return window.reduce((sum, n) => sum + n, 0) / window.length;
}

async function fetchTwseDaily(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  const url = `${TWSE_API}?response=json&date=${y}${m}${d}&type=ALLBUT0999`;

  try {
    const response = await fetch(url);
    const text = await response.text();
    if (!text) return [];

    const payload = JSON.parse(text);
    const stat = cleanText(payload.stat);
    if (["沒有符合條件的資料", "很抱歉", "查詢日期大於今日"].some((x) => stat.includes(x))) {
      return [];
    }

    const tables = payload.tables || [];
    const target = tables.find((table) => {
      const fields = (table.fields || []).map(cleanText).join("|");
      return ["證券代號", "證券名稱", "成交股數", "收盤價"].every((x) => fields.includes(x));
    });

    if (!target) return [];

    const fields = (target.fields || []).map(cleanText);
    const rows = [];

    for (const raw of target.data || []) {
      const row = Object.fromEntries(fields.map((field, index) => [field, raw[index] ?? ""]));
      const code = cleanText(row["證券代號"]).slice(0, 4);
      if (!isValidStockCode(code)) continue;

      const close = parseNumber(row["收盤價"]);
      const volumeShares = parseNumber(row["成交股數"], true);
      if (close === null || volumeShares === null) continue;

      rows.push({
        stock_id: code,
        name: cleanText(row["證券名稱"]),
        close,
        volume_lots: Math.trunc(volumeShares / 1000),
      });
    }

    return rows;
  } catch (err) {
    console.error(err);
    return [];
  }
}

async function fetchOpenApiDailyAll() {
  try {
    const response = await fetch(TWSE_OPENAPI_DAY_ALL);
    if (!response.ok) return [];

    const rows = await response.json();
    if (!Array.isArray(rows)) return [];

    return rows
      .map((row) => {
        const code = cleanText(row.Code).slice(0, 4);
        if (!isValidStockCode(code)) return null;

        const close = parseNumber(row.ClosingPrice);
        const volumeLots = Math.trunc((parseNumber(row.TradeVolume, true) || 0) / 1000);
        const change = parseNumber(row.Change);

        if (close === null || volumeLots < MIN_DAILY_VOLUME_LOTS) return null;

        return {
          stock_id: code,
          code,
          name: cleanText(row.Name),
          close,
          volume_lots: volumeLots,
          change: change ?? 0,
        };
      })
      .filter(Boolean);
  } catch (err) {
    console.error(err);
    return [];
  }
}

function analyzeFromOpenApiRows(rows) {
  const bullish = rows
    .filter((row) => row.change > 0)
    .sort((a, b) => b.change - a.change || b.volume_lots - a.volume_lots)
    .slice(0, MAX_RESULTS)
    .map((row) => {
      const score = Math.min(140, Math.round(80 + row.change * 8 + Math.log10(row.volume_lots + 1) * 5));
      return {
        stock_id: row.stock_id,
        code: row.code,
        name: row.name,
        industry: "上市",
        direction: "看多",
        strong_score: score,
        stars: scoreToStars(score),
        bias: `${row.change.toFixed(2)}%`,
        volume_lots: row.volume_lots,
        close: row.close,
      };
    });

  const bearish = rows
    .filter((row) => row.change < 0)
    .sort((a, b) => a.change - b.change || b.volume_lots - a.volume_lots)
    .slice(0, MAX_RESULTS)
    .map((row) => {
      const score = Math.min(140, Math.round(80 + Math.abs(row.change) * 8 + Math.log10(row.volume_lots + 1) * 5));
      return {
        stock_id: row.stock_id,
        code: row.code,
        name: row.name,
        industry: "上市",
        direction: "看空",
        strong_score: score,
        stars: scoreToStars(score),
        bias: `${row.change.toFixed(2)}%`,
        volume_lots: row.volume_lots,
        close: row.close,
      };
    });

  return { bullish, bearish };
}

async function collectMarketHistory(maxCalendarDays = 45) {
  const history = new Map();
  const cursor = new Date();
  let attempts = 0;

  while (attempts < maxCalendarDays) {
    const dailyRows = await fetchTwseDaily(cursor);
    for (const item of dailyRows) {
      if (!history.has(item.stock_id)) history.set(item.stock_id, []);
      history.get(item.stock_id).push(item);
    }

    cursor.setDate(cursor.getDate() - 1);
    attempts += 1;

    const readyCount = [...history.values()].filter((rows) => rows.length >= MIN_TRADING_DAYS).length;
    if (readyCount >= 300) break;
  }

  return history;
}

function calcBullishScore(close, ma5, ma20, volumeLots, volumeMa20) {
  let score = 45;
  if (ma20 && close >= ma20) score += 15;
  if (ma5 && ma20 && ma5 >= ma20) score += 20;
  if (ma5 && close >= ma5) score += 10;
  if (volumeMa20 && volumeLots >= volumeMa20) score += 10;
  if (volumeLots >= MIN_DAILY_VOLUME_LOTS) score += 10;
  return score;
}

function calcBearishScore(close, ma5, ma20, volumeLots, volumeMa20) {
  let score = 45;
  if (ma20 && close < ma20) score += 20;
  if (ma5 && ma20 && ma5 < ma20) score += 15;
  if (ma5 && close <= ma5) score += 10;
  if (volumeMa20 && volumeLots >= volumeMa20) score += 10;
  if (volumeLots >= MIN_DAILY_VOLUME_LOTS) score += 10;
  return score;
}

function analyzeMarket(history) {
  const bullish = [];
  const bearish = [];

  for (const [code, allRows] of history.entries()) {
    if (allRows.length < MIN_TRADING_DAYS) continue;

    const rows = allRows.slice(-MIN_TRADING_DAYS);
    const closes = rows.map((row) => row.close);
    const volumes = rows.map((row) => row.volume_lots);
    const latest = rows[rows.length - 1];
    const close = closes[closes.length - 1];
    const ma5 = movingAverage(closes, 5);
    const ma20 = movingAverage(closes, 20);
    const volumeMa20 = movingAverage(volumes, 20);
    const volumeLots = volumes[volumes.length - 1];

    if (!ma20 || volumeLots < MIN_DAILY_VOLUME_LOTS) continue;

    const bias = Number((((close - ma20) / ma20) * 100).toFixed(2));
    const bullScore = calcBullishScore(close, ma5, ma20, volumeLots, volumeMa20);
    const bearScore = calcBearishScore(close, ma5, ma20, volumeLots, volumeMa20);

    const baseItem = {
      stock_id: code,
      code,
      name: latest.name,
      industry: "上市",
      volume_lots: volumeLots,
      close: Number(close.toFixed(2)),
    };

    if (bullScore >= SCORE_THRESHOLD && close >= ma20 && bias >= 0) {
      bullish.push({
        ...baseItem,
        direction: "看多",
        strong_score: bullScore,
        stars: scoreToStars(bullScore),
        bias: `${bias}%`,
      });
    }

    if (bearScore >= SCORE_THRESHOLD && close < ma20 && bias < 0) {
      bearish.push({
        ...baseItem,
        direction: "看空",
        strong_score: bearScore,
        stars: scoreToStars(bearScore),
        bias: `${bias}%`,
      });
    }
  }

  bullish.sort((a, b) => b.strong_score - a.strong_score || b.volume_lots - a.volume_lots);
  bearish.sort((a, b) => b.strong_score - a.strong_score || b.volume_lots - a.volume_lots);

  return {
    bullish: bullish.slice(0, MAX_RESULTS),
    bearish: bearish.slice(0, MAX_RESULTS),
  };
}

function buildWarrants(bullishRows) {
  return bullishRows.slice(0, 10).map((stock) => ({
    code: `${stock.stock_id}C`,
    stock_id: `${stock.stock_id}C`,
    name: `${stock.name}認購（觀察）`,
    type: "認購",
    issuer: "待篩選",
    stock_code: stock.stock_id,
  }));
}

export async function runRealTwseAnalysis() {
  const history = await collectMarketHistory();
  let { bullish, bearish } = analyzeMarket(history);
  let source = "web-twse-local";
  let market = "TWSE上市（20日均線）";

  if (bullish.length === 0 && bearish.length === 0) {
    const openApiRows = await fetchOpenApiDailyAll();
    const openApiResult = analyzeFromOpenApiRows(openApiRows);
    bullish = openApiResult.bullish;
    bearish = openApiResult.bearish;
    source = "web-twse-openapi";
    market = "TWSE上市（最新交易日）";
  }

  const warrants = buildWarrants(bullish);

  const result = {
    updated_at: new Date().toLocaleString("zh-TW"),
    source,
    market,
    bullish,
    bearish,
    warrants,
    bullish_count: bullish.length,
    bearish_count: bearish.length,
    warrant_count: warrants.length,
  };

  if (bullish.length > 0 || bearish.length > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));
  }

  return result;
}

export function getLocalWebAnalysis() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function fetchWebStockList(type, apiBase, headersFn) {
  try {
    const response = await fetch(`${apiBase}/web/${type}`, {
      headers: headersFn(false),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        items: Array.isArray(data.items) ? data.items : [],
        source: "server",
      };
    }
  } catch (err) {
    console.error(err);
  }

  return { items: [], source: "none" };
}

export async function fetchWebWarrants(apiBase, headersFn) {
  try {
    const response = await fetch(`${apiBase}/web/warrants`, {
      headers: headersFn(false),
    });

    if (response.ok) {
      const data = await response.json();
      return {
        items: Array.isArray(data.items) ? data.items : [],
        source: "server",
      };
    }
  } catch (err) {
    console.error(err);
  }

  return { items: [], source: "none" };
}

export async function runWebAnalysisRequest(apiBase, headersFn) {
  try {
    const response = await fetch(`${apiBase}/web/run-analysis`, {
      method: "POST",
      headers: headersFn(false),
    });

    let data = {};
    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (response.ok) {
      if (data.updated_at || data.bullish_count != null) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      }
      return { ok: true, data, mode: "server" };
    }

    return {
      ok: false,
      data,
      mode: "server-error",
      message: data.detail || data.message || "後端分析失敗，請稍後再試",
    };
  } catch (err) {
    console.error(err);
    return {
      ok: false,
      data: {},
      mode: "network-error",
      message: "無法連線後端。資料僅在雲端更新，請確認網路或稍後再試",
    };
  }
}

export async function fetchWebAnalysisStatus(apiBase, headersFn) {
  try {
    const response = await fetch(`${apiBase}/web/analysis-status`, {
      headers: headersFn(false),
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (err) {
    console.error(err);
  }

  return null;
}
