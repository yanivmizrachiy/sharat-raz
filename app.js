const API = "http://127.0.0.1:8791";
const el = (id) => document.getElementById(id);
let deferredPrompt = null;
let lastRefreshAt = null;

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) }
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; }
  catch { throw new Error("תגובה לא תקינה מהשרת: " + text.slice(0, 300)); }
  if (!res.ok) throw new Error(data.error || ("HTTP " + res.status));
  return data;
}

function setText(id, value) {
  const n = el(id);
  if (n) n.textContent = value;
}

function renderOutput(obj) {
  const node = el("output");
  if (!node) return;
  node.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

function renderError(message) {
  const node = el("errorBox");
  if (!node) return;
  node.textContent = message || "אין שגיאות כרגע.";
}

function stampNow() {
  const d = new Date();
  return d.toLocaleString("he-IL");
}

async function refreshStatus() {
  try {
    const data = await api("/status");
    lastRefreshAt = stampNow();
    setText("summary", "האפליקציה מחוברת ל־API המקומי ופועלת");
    setText("githubState", "מסונכרן");
    setText("salonState", data.pc_state || "לא ידוע");
    setText("roomState", "בהמשך");
    setText("n8nState", data.n8n_state || "לא ידוע");
    renderOutput({
      עודכן_ב: lastRefreshAt,
      תוצאה_אחרונה: data.last_result || {},
      פקודה_נוכחית: data.next_command || {},
      מצב_תור: data.queue_state || "לא ידוע"
    });
    renderError("אין שגיאות כרגע.");
  } catch (e) {
    setText("summary", "אין גישה ל־API המקומי ב־Termux");
    setText("githubState", "שגיאה");
    setText("salonState", "--");
    setText("roomState", "--");
    setText("n8nState", "--");
    renderError("שגיאת רענון: " + e.message);
  }
}

async function sendCommand(target, action, params = {}) {
  try {
    renderError("אין שגיאות כרגע.");
    renderOutput({נשלח:true, target, action, params, זמן: stampNow()});
    const data = await api("/command", {
      method: "POST",
      body: JSON.stringify({ target, action, params })
    });
    renderOutput({
      נשלח: true,
      queued: data.queued || {},
      git: data.git || [],
      זמן: stampNow()
    });
    await refreshStatus();
  } catch (e) {
    renderError("שגיאת שליחה: " + e.message);
  }
}

async function loadButtons() {
  try {
    const data = await api("/buttons");
    const groups = data.buttons || {};
    const host = document.querySelector(".buttons");
    if (!host) return;
    host.innerHTML = "";
    Object.entries(groups).forEach(([group, items]) => {
      const title = document.createElement("h3");
      title.textContent = group;
      title.style.gridColumn = "1 / -1";
      host.appendChild(title);

      items.forEach(item => {
        const btn = document.createElement("button");
        btn.className = "quick";
        btn.textContent = item.label;
        btn.addEventListener("click", () => sendCommand(item.target, item.action, item.params || {}));
        host.appendChild(btn);
      });
    });
  } catch (e) {
    renderError("שגיאת טעינת כפתורים: " + e.message);
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

el("sendBtn")?.addEventListener("click", async () => {
  const target = el("target").value.trim();
  const action = el("action").value.trim();
  const raw = el("params").value.trim();
  let params = {};
  if (raw) {
    try { params = JSON.parse(raw); }
    catch {
      renderError("JSON לא תקין בשדה הפרמטרים.");
      return;
    }
  }
  if (!action) {
    renderError("חסר action.");
    return;
  }
  await sendCommand(target, action, params);
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(err => renderError("שגיאת Service Worker: " + err.message));
}

loadButtons();
refreshStatus();
setInterval(refreshStatus, 8000);
