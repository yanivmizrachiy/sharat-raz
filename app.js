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

function setText(id, value) { el(id).textContent = value; }

async function refreshStatus() {
  try {
    const data = await api("/status");
    setText("healthLine", "האפליקציה מחוברת ל־API המקומי ופועלת");
    setText("apiState", data.api_ok ? "מחובר" : "לא זמין");
    setText("pcState", data.pc_state || "לא ידוע");
    setText("queueState", data.queue_state || "לא ידוע");
    setText("n8nState", data.n8n_state || "לא ידוע");
    el("lastResult").textContent = JSON.stringify(data.last_result || {}, null, 2);
  } catch (e) {
    setText("healthLine", "לא הצלחנו לגשת ל־API המקומי. ודא שהשירות רץ ב־Termux.");
    setText("apiState", "שגיאה");
    setText("pcState", "--");
    setText("queueState", "--");
    setText("n8nState", "--");
    el("lastResult").textContent = String(e);
  }
}

async function sendCommand(target, action, params = {}) {
  try {
    const body = { target, action, params };
    const data = await api("/command", { method: "POST", body: JSON.stringify(body) });
    el("lastResult").textContent = JSON.stringify(data, null, 2);
    await refreshStatus();
  } catch (e) {
    el("lastResult").textContent = "שגיאה בשליחה: " + e.message;
  }
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  el("installBtn").classList.remove("hidden");
});

el("installBtn").addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  el("installBtn").classList.add("hidden");
});

el("refreshBtn").addEventListener("click", refreshStatus);
el("sendBtn").addEventListener("click", async () => {
  const target = el("target").value.trim();
  const action = el("action").value.trim();
  let params = {};
  const raw = el("params").value.trim();
  if (raw) {
    try { params = JSON.parse(raw); } catch { alert("Params JSON לא תקין"); return; }
  }
  if (!action) { alert("חסר action"); return; }
  await sendCommand(target, action, params);
});

document.querySelectorAll(".quick[data-target]").forEach(btn => {
  btn.addEventListener("click", async () => {
    const target = btn.dataset.target;
    const action = btn.dataset.action;
    let params = {};
    if (target === "n8n" && action === "chat") {
      const text = (el("n8nText").value || "").trim() || "שלום משרת רז";
      params = { text };
    }
    await sendCommand(target, action, params);
  });
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(console.error);
}

refreshStatus();
setInterval(refreshStatus, 8000);
