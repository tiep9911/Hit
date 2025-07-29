const WebSocket = require("ws");
const express = require("express");
const app = express();
const PORT = process.env.PORT || 5050;

const WS_URL = "wss://mynygwais.hytsocesk.com/websocket";
const accessToken = "1-0145210c67b14454531b06399b829270";
const ID = "binhtool90";

let ws;
let lastPingTime = Date.now();
let pingCounter = 1;
let lastResults = [];
let currentData = {
  id: ID,
  time: null,
  phien_truoc: {},
  phien_ke_tiep: {},
  pattern: "",
  du_doan: ""
};

function timestamp() {
  return new Date().toLocaleTimeString("vi-VN", { hour12: false });
}

function predictFromMD5(md5) {
  if (!md5 || typeof md5 !== "string") return "Không rõ";
  const char = md5[0].toLowerCase();
  const num = parseInt(char, 16);
  return isNaN(num) ? "Không rõ" : (num % 2 === 0 ? "Xỉu" : "Tài");
}

function connectWebSocket() {
  ws = new WebSocket(WS_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Origin: "https://i.hit.club",
      Host: "mynygwais.hytsocesk.com"
    }
  });

  ws.on("open", () => {
    console.log(`[✅ ${timestamp()}] WebSocket đã kết nối`);
    lastPingTime = Date.now();

    ws.send(JSON.stringify([
      1, "MiniGame", "", "", {
        agentId: "1",
        accessToken,
        reconnect: false
      }
    ]));

    // Gửi cmd 2001 lần đầu sau 1s
    setTimeout(() => {
      ws.send(JSON.stringify([
        6, "MiniGame", "taixiuKCBPlugin", { cmd: 2000 }
      ]));
    }, 1000);

    autoKeepAlive();
  });

  ws.on("message", (msg) => {
    lastPingTime = Date.now();

    try {
      const data = JSON.parse(msg);
      if (!Array.isArray(data) || data[0] !== 5 || typeof data[1] !== "object") return;
      const d = data[1].d;
      if (!d || typeof d.cmd !== "number") return;

      const { cmd, sid, md5 } = d;

      if (cmd === 2005) {
        currentData.phien_ke_tiep = { sid, md5 };
        console.log(`[⏭️ ${timestamp()}] Phiên kế tiếp: ${sid} | MD5: ${md5}`);
      }

      if (cmd === 2006 && d.d1 !== undefined) {
        const { d1, d2, d3 } = d;
        const total = d1 + d2 + d3;
        const result = total >= 11 ? "Tài" : "Xỉu";

        lastResults.push(result === "Tài" ? "t" : "x");
        if (lastResults.length > 10) lastResults.shift();

        const pattern = lastResults.join("");
        const du_doan = predictFromMD5(md5);

        currentData.phien_truoc = {
          sid,
          ket_qua: `${d1}-${d2}-${d3} = ${total} (${result})`,
          md5
        };
        currentData.pattern = pattern;
        currentData.du_doan = du_doan;
        currentData.time = timestamp();

        console.log(`[🎲 ${timestamp()}] Phiên ${sid}: ${d1}-${d2}-${d3} = ${total} ➜ ${result}`);
        console.log(`           ➜ MD5: ${md5} | Dự đoán: ${du_doan} | Pattern: ${pattern}`);
      }
    } catch (err) {
      console.log("[‼️] Lỗi xử lý:", err.message);
    }
  });

  ws.on("close", () => {
    console.log(`[❌ ${timestamp()}] Mất kết nối WebSocket. Đang reconnect...`);
    reconnectWebSocket();
  });

  ws.on("error", (err) => {
    console.log(`[‼️] WebSocket lỗi:`, err.message);
  });
}

// 🧠 Hàm tự động reconnect
function reconnectWebSocket() {
  try { ws.terminate(); } catch (e) {}
  setTimeout(connectWebSocket, 3000);
}

// ✅ Gửi ping "7" + gọi lại cmd:2001 định kỳ
function autoKeepAlive() {
  setInterval(() => {
    try {
      ws.send(JSON.stringify(["7", "MiniGame", "1", pingCounter++]));
      ws.send(JSON.stringify([
        6, "MiniGame", "taixiuKCBPlugin", { cmd: 2001 }
      ]));
    } catch (e) {}
  }, 10000); // mỗi 10s
}

// ✅ Kiểm tra zombie socket (im lặng > 30s thì reconnect)
setInterval(() => {
  const now = Date.now();
  const diff = now - lastPingTime;
  if (diff > 30000) {
    console.log(`[⛔] Không phản hồi trong ${diff}ms. Reconnect...`);
    reconnectWebSocket();
  }
}, 15000);

// REST API
app.get("/data", (req, res) => {
  res.json(currentData);
});
app.get("/", (req, res) => {
  res.send("🎲 Tool Tài Xỉu WebSocket - by binhtool90 đang chạy...");
});
app.listen(PORT, () => {
  console.log(`[🌐] Server đang chạy tại http://localhost:${PORT}`);
  connectWebSocket();
});
