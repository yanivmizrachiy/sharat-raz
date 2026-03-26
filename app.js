const API = "http://127.0.0.1:8791";
const el = (id) => document.getElementById(id);
let deferredPrompt = null;

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) }
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

function setText(id, value) { const n = el(id); if (n) n.textContent = value; }

async function refreshStatus() {
  try {
    const data = await api("/status");
    setText("summary", "האפליקציה מחוברת ל־API המקומי ופועלת");
    setText("githubState", "מסונכרן");
    setText("salonState", data.pc_state || "לא ידוע");
    setText("roomState", "בהמשך");
    setText("n8nState", data.n8n_state || "לא ידוע");
    el("output").textContent = JSON.stringify(data.last_result || {}, null, 2);
  } catch (e) {
    setText("summary", "אין גישה ל־API המקומי ב־Termux");
    setText("githubState", "שגיאה");
    setText("salonState", "--");
    setText("roomState", "--");
    setText("n8nState", "--");
    el("output").textContent = "שגיאה: " + e.message;
  }
}

async function sendCommand(target, action, params = {}) {
  try {
    const data = await api("/command", {
      method: "POST",
      body: JSON.stringify({ target, action, params })
    });
    el("output").textContent = JSON.stringify(data, null, 2);
    await refreshStatus();
  } catch (e) {
    el("output").textContent = "שגיאת שליחה: " + e.message;
  }
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  el("installBtn")?.classList.remove("hidden");
});

el("installBtn")?.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  el("installBtn").classList.add("hidden");
});

el("refreshBtn")?.addEventListener("click", refreshStatus);

document.querySelectorAll(".quick").forEach(btn => {
  btn.addEventListener("click", async () => {
    const action = btn.dataset.action;
    if (action === "open-github") return location.href = "https://github.com/yanivmizrachiy/sharat-raz";
    if (action === "open-my-assistant") return location.href = "https://github.com/yanivmizrachiy/my-assistant";
    if (action === "open-server-core") return location.href = "https://github.com/yanivmizrachiy/server-core";
    if (action === "salon-connect") return sendCommand("pc", "hostname", {});
    if (action === "room-connect") return sendCommand("room-pc", "hostname", {});
    if (action === "status") return refreshStatus();
  });
});

el("sendBtn")?.addEventListener("click", async () => {
  const target = el("target").value.trim();
  const action = el("action").value.trim();
  const raw = el("params").value.trim();
  let params = {};
  if (raw) {
    try { params = JSON.parse(raw); } catch { el("output").textContent = "JSON לא תקין"; return; }
  }
  if (!action) { el("output").textContent = "חסר action"; return; }
  await sendCommand(target, action, params);
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(console.error);
}

refreshStatus();
setInterval(refreshStatus, 8000);
