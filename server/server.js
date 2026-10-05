import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = path.join(__dirname, "saves.json");
const LOG_FILE = path.join(__dirname, "client_errors.log");

// Danh sách các game được hỗ trợ
const SUPPORTED_GAMES = {
  "tiem-tra-nho": "Tiệm Trà Nhỏ (Milk Tea Simulator)",
  "banh-mi": "Bánh Mì Bé Xíu (Vietnamese Bread Simulator)",
  "tiem-my-cay": "Tiệm Mì Cay (Spicy Noodle Simulator)",
  "tiem-xoi": "Tiệm Xôi Bà Tám (Sticky Rice Simulator)"
};

// Đọc dữ liệu đã lưu từ file JSON
let saves = {};
if (fs.existsSync(DB_FILE)) {
  try {
    saves = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    console.log("[Database] Đã tải " + Object.keys(saves).length + " bản sao lưu từ saves.json");
  } catch (e) {
    console.error("[Database] Lỗi đọc saves.json, tạo mới:", e.message);
  }
}

// Lưu dữ liệu ra file
function persist() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(saves, null, 2), "utf8");
  } catch (e) {
    console.error("[Database] Lỗi ghi saves.json:", e.message);
  }
}

// Ghi log lỗi từ client
function logClientError(errData) {
  try {
    const line = "[" + new Date().toISOString() + "] " + JSON.stringify(errData) + "\n";
    fs.appendFileSync(LOG_FILE, line, "utf8");
  } catch (e) {
    console.error("[ErrorLogger] Lỗi ghi file log:", e.message);
  }
}

// Sinh mã 8 số ngẫu nhiên không trùng lặp (Tiệm Trà Nhỏ, v.v.)
function generate8DigitCode() {
  let code;
  let attempts = 0;
  do {
    code = Math.floor(10000000 + Math.random() * 90000000).toString();
    attempts++;
    if (attempts > 10000) break;
  } while (saves[code]);
  return code;
}

// Sinh mã 8 chữ cái in hoa không trùng lặp (Tiệm Mì Cay: [A-Z]{8})
function generate8AlphaCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code;
  let attempts = 0;
  do {
    code = "";
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    attempts++;
    if (attempts > 10000) break;
  } while (saves[code]);
  return code;
}

// Helper giải mã body (hỗ trợ cả gzip khi client nén bằng CompressionStream)
async function parseRequestBody(c) {
  const enc = (c.req.header("content-encoding") || "").toLowerCase();
  const rawBuf = Buffer.from(await c.req.arrayBuffer());
  let str;
  if (enc.includes("gzip") || (rawBuf.length >= 2 && rawBuf[0] === 0x1f && rawBuf[1] === 0x8b)) {
    str = zlib.gunzipSync(rawBuf).toString("utf8");
  } else {
    str = rawBuf.toString("utf8");
  }
  return JSON.parse(str);
}

const app = new Hono();

// Cho phép tất cả các domain gọi API (CORS)
app.use("*", cors());

// Trang chủ / Health check
app.get("/", (c) => {
  const savesList = Object.values(saves);
  const stats = {};
  for (const key of Object.keys(SUPPORTED_GAMES)) {
    stats[key] = savesList.filter(s => (s.game || "tiem-tra-nho") === key).length;
  }

  return c.json({
    status: "online",
    message: "Máy chủ Cloud Storage đa game (Tiệm Trà Nhỏ, Bánh Mì, Mì Cay, Tiệm Xôi)",
    supportedGames: SUPPORTED_GAMES,
    totalSaves: Object.keys(saves).length,
    statsPerGame: stats,
    endpoints: {
      save: "POST /save hoặc POST /api/save",
      load: "GET /load?code=... hoặc GET /api/load?code=...",
      errorReport: "POST /api/err",
      leaderboard: "GET/POST /api/lb",
      sync: "GET /api/sync",
      status: "GET /api/status"
    }
  });
});

app.get("/api/status", (c) => {
  return c.json({
    status: "ok",
    uptime: process.uptime(),
    totalSaves: Object.keys(saves).length,
    timestamp: new Date().toISOString()
  });
});

// Endpoint xử lý lưu tiến trình (Hỗ trợ cả Tiệm Trà Nhỏ dạng {key, data} và Tiệm Mì Cay dạng {op, code, claim, data, sig})
async function handleSave(c) {
  try {
    const body = await parseRequestBody(c);

    // TRƯỜNG HỢP 1: Giao thức Tiệm Mì Cay (có op: "create" | "put" | "reset" | "get" | "meta")
    if (body.op) {
      const { op, code, claim, revision = 0, data, sig } = body;
      const now = Date.now();

      if (op === "meta") {
        if (!code || !saves[code]) {
          return c.json({ error: "Không tìm thấy tiệm" }, 404);
        }
        const record = saves[code];
        return c.json({
          code,
          revision: record.revision || 0,
          day: record.data && record.data.day ? record.data.day : 1,
          savedSig: record.sig || "",
          at: record.updatedAtTs || now
        });
      }

      if (op === "get") {
        if (!code || !saves[code]) {
          return c.json({ error: "Không tìm thấy tiệm" }, 404);
        }
        const record = saves[code];
        return c.json({
          code,
          revision: record.revision || 0,
          data: record.data,
          sig: record.sig || "",
          day: record.data && record.data.day ? record.data.day : 1,
          at: record.updatedAtTs || now
        });
      }

      if (op === "create") {
        const newCode = generate8AlphaCode();
        const rev = 1;
        const recordDay = data && data.day ? data.day : 1;
        saves[newCode] = {
          game: "tiem-my-cay",
          code: newCode,
          claim: claim || "",
          revision: rev,
          data,
          sig: sig || "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          updatedAtTs: now
        };
        persist();
        return c.json({
          code: newCode,
          revision: rev,
          day: recordDay,
          savedSig: sig || "",
          at: now
        });
      }

      if (op === "put" || op === "reset") {
        let targetCode = code;
        if (!targetCode || !saves[targetCode]) {
          targetCode = targetCode && /^[A-Z]{8}$/.test(targetCode) ? targetCode : generate8AlphaCode();
        }
        const existing = saves[targetCode];
        if (existing && existing.claim && claim && existing.claim !== claim) {
          return c.json({ error: "Mã tiệm thuộc về tài khoản thiết bị khác" }, 403);
        }
        const nextRev = (revision || 0) + 1;
        const recordDay = data && data.day ? data.day : 1;
        saves[targetCode] = {
          game: "tiem-my-cay",
          code: targetCode,
          claim: claim || (existing ? existing.claim : ""),
          revision: nextRev,
          data,
          sig: sig || "",
          createdAt: existing ? existing.createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          updatedAtTs: now
        };
        persist();
        return c.json({
          code: targetCode,
          revision: nextRev,
          day: recordDay,
          savedSig: sig || "",
          at: now
        });
      }

      return c.json({ error: "Lệnh không hỗ trợ: " + op }, 400);
    }

    // TRƯỜNG HỢP 2: Giao thức Tiệm Trà Nhỏ / game khác ({key, code, data, game})
    const { key, code, data, game = "tiem-tra-nho" } = body;

    if (!data) {
      return c.json({ error: "Thiếu dữ liệu màn chơi (data)" }, 400);
    }
    if (!key) {
      return c.json({ error: "Thiếu khóa xác thực thiết bị (key)" }, 400);
    }

    let targetCode = code;
    if (targetCode && /^[a-zA-Z0-9]{8}$/.test(targetCode)) {
      if (saves[targetCode]) {
        if (saves[targetCode].key && saves[targetCode].key !== key) {
          return c.json({ error: "Mã 8 số này thuộc về thiết bị khác" }, 403);
        }
        saves[targetCode].data = data;
        saves[targetCode].game = game;
        saves[targetCode].updatedAt = new Date().toISOString();
      } else {
        saves[targetCode] = {
          game,
          key,
          data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      }
    } else {
      targetCode = generate8DigitCode();
      saves[targetCode] = {
        game,
        key,
        data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    persist();
    return c.json({ code: targetCode, game });
  } catch (err) {
    return c.json({ error: "Lỗi xử lý lưu: " + err.message }, 500);
  }
}

app.post("/save", handleSave);
app.post("/api/save", handleSave);

// Endpoint xử lý tải tiến trình (Hỗ trợ cả /load và /api/load)
function handleLoad(c) {
  const codeParam = c.req.query("code");
  if (!codeParam) {
    return c.json({ error: "Vui lòng cung cấp mã 8 ký tự (?code=...)" }, 400);
  }

  const cleanCode = codeParam.replace(/[\s.-]/g, "").toUpperCase();
  const record = saves[cleanCode] || saves[codeParam.replace(/[\s.-]/g, "")];
  if (!record || !record.data) {
    return c.json({ error: "Không tìm thấy dữ liệu cho mã " + cleanCode }, 404);
  }

  return c.json({
    code: cleanCode,
    data: record.data,
    sig: record.sig,
    game: record.game || "tiem-tra-nho",
    updatedAt: record.updatedAt
  });
}

app.get("/load", handleLoad);
app.get("/api/load", handleLoad);

// Endpoint nhận báo cáo lỗi từ client
app.post("/api/err", async (c) => {
  try {
    let payload;
    const contentType = c.req.header("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = await c.req.json();
    } else {
      payload = await c.req.text();
    }
    logClientError(payload);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 400);
  }
});

// Endpoint Bảng xếp hạng (Leaderboard) cho Tiệm Mì Cay & các game
let leaderboards = {
  "tiem-my-cay": [
    { name: "Chủ Quán 01", s: 9999000, day: 30 },
    { name: "Mì Cay Đệ Nhất", s: 8500000, day: 25 },
    { name: "Tô Mì Siêu Cấp", s: 7200000, day: 20 },
    { name: "Sợi Mì Bay", s: 6100000, day: 18 },
    { name: "Bếp Lửa Hồng", s: 5000000, day: 15 }
  ]
};

app.get("/api/lb", (c) => {
  return c.json({
    top: leaderboards["tiem-my-cay"] || [],
    wtop: leaderboards["tiem-my-cay"] || []
  });
});

app.post("/api/lb", async (c) => {
  try {
    const body = await parseRequestBody(c);
    if (body && body.name && Number.isFinite(body.score)) {
      leaderboards["tiem-my-cay"].push({
        name: String(body.name).slice(0, 20),
        s: Number(body.score),
        day: Number(body.day || 1)
      });
      leaderboards["tiem-my-cay"].sort((a, b) => b.s - a.s);
      leaderboards["tiem-my-cay"] = leaderboards["tiem-my-cay"].slice(0, 50);
    }
    return c.json({
      top: leaderboards["tiem-my-cay"] || [],
      wtop: leaderboards["tiem-my-cay"] || []
    });
  } catch (e) {
    return c.json({ top: leaderboards["tiem-my-cay"] || [] });
  }
});

// Endpoint Thử thách ngày (Challenge)
app.all("/api/chal", async (c) => {
  const dayStr = new Date().toISOString().slice(0, 10);
  return c.json({
    day: dayStr,
    token: "chal_token_" + Date.now(),
    n: 1,
    me: { left: 3, best: 0, rank: 1 },
    top: [
      { name: "Vua Nấu Mì", s: 10000 },
      { name: "Đầu Bếp Tài Ba", s: 9200 }
    ]
  });
});

// Endpoint Ghẹo quán (Prank)
app.all("/api/prank", async (c) => {
  return c.json({
    left: 5,
    name: "Quán Hàng Xóm",
    gifts: []
  });
});

// Endpoint PvP
app.all("/api/pvp", async (c) => {
  return c.json({
    now: Date.now(),
    room: null
  });
});

// Endpoint AI đánh giá
app.post("/api/ai", async (c) => {
  return c.json({
    ok: true,
    feedback: "Tô mì cay màu sắc bắt mắt, cấp độ cay rất vừa miệng khách!"
  });
});

// Endpoint đồng bộ mã cũ
app.get("/api/sync", (c) => {
  const code = c.req.query("code");
  return c.json({ ok: false, error: "Không tìm thấy mã cũ" }, 404);
});

export default app;

// Khởi động server trên cổng 8787 khi chạy trực tiếp qua node
const PORT = process.env.PORT || 8787;
serve({
  fetch: app.fetch,
  port: Number(PORT)
}, (info) => {
  console.log("🍵 Server Cloud Storage API đang chạy tại: http://localhost:" + info.port);
  console.log("🎮 Hỗ trợ: " + Object.values(SUPPORTED_GAMES).join(", "));
});
