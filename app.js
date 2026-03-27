let STATUS_REFRESH_MS = 10000;
let DIAG_REFRESH_MS = 15000;
let SCREENSHOT_REFRESH_MS = 3000;
let SCREENSHOT_LOADING = false;

const API = "http://127.0.0.1:8791";
const el = (id) => document.getElementById(id);

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { "Content-Type": "application/json" }
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "שגיאה");
  return data;
}

function setText(id, value) {
  const n = el(id);
  if (n) n.textContent = value;
}

function boolText(v) {
  return v ? "תקין" : "לא תקין";
}

function render(obj) {
  const out = el("output");
  if (out) out.textContent = JSON.stringify(obj, null, 2);
}

function confirmDanger(action,label){
  const s=(action+" "+label).toLowerCase();
  if(s.includes("shutdown")||s.includes("restart")||s.includes("כבה")){
    return confirm("פעולה מסוכנת: "+label+"
להמשיך?");
  }
  return true;
}

async function refreshStatus(){
  try{
    const d = await api("/status");
    const h = d.health || {};

    setText("githubState", h.queue_file_present ? "מסונכרן" : "בעיה");
    setText("salonState", h.ssh_room_pc ? "מחובר" : "לא מחובר");

    setText("summary",
      "API:"+boolText(h.api_running)+" | "+
      "Listener:"+boolText(h.listener_running)+" | "+
      "SSH:"+boolText(h.ssh_room_pc)+" | "+
      "Tailscale:"+boolText(h.tailscale_room_pc)
    );

    render(d);

  }catch(e){
    setText("summary","שגיאה");
  }
}

async function sendCommand(t,a,p={},label=""){
  if(!confirmDanger(a,label)) return;
  const r = await api("/command",{
    method:"POST",
    body:JSON.stringify({target:t,action:a,params:p})
  });
  render(r);
  setTimeout(refreshStatus,2000);
}

async function loadButtons(){
  const d = await api("/buttons");
  const host = document.querySelector(".buttons");
  host.innerHTML="";
  Object.entries(d.buttons||{}).forEach(([g,items])=>{
    const h=document.createElement("h3");
    h.textContent=g;
    host.appendChild(h);
    items.forEach(it=>{
      const b=document.createElement("button");
      b.textContent=it.label;
      b.onclick=()=>sendCommand(it.target,it.action,it.params||{},it.label);
      host.appendChild(b);
    });
  });
}

loadFastPaths();
loadButtons();
refreshStatus();
loadDiagnostics();
loadGlobalConnectivity();
setInterval(refreshStatus,8000);


async function captureScreenshot() {
  try {
    const r = await api("/capture-screenshot", { method: "POST" });
    render(r);
    setTimeout(loadLatestScreenshot, 2500);
    setTimeout(refreshStatus, 1800);
  } catch (e) {
    const box = el("errorBox");
    if (box) box.textContent = "שגיאת צילום מסך: " + e.message;
  }
}

function loadLatestScreenshot() {
  const img = el("shotImg");
  if (!img) return;
  if (SCREENSHOT_LOADING) return;
  SCREENSHOT_LOADING = true;
  img.onload = () => { SCREENSHOT_LOADING = false; };
  img.onerror = () => { SCREENSHOT_LOADING = false; };
  img.src = API + "/latest-screenshot?ts=" + Date.now();
}

document.getElementById("shotBtn")?.addEventListener("click", captureScreenshot);
setInterval(loadLatestScreenshot, SCREENSHOT_REFRESH_MS);
setTimeout(loadLatestScreenshot, 1200);

let LIVE=null; function startLive(){if(LIVE)return;LIVE=setInterval(loadLatestScreenshot,2000);} function stopLive(){if(LIVE){clearInterval(LIVE);LIVE=null;}}

async function loadFastPaths() {
  try {
    const res = await fetch("./CONTROL/fast_paths.json?ts=" + Date.now());
    const data = await res.json();
    const host = document.getElementById("fastPaths");
    if (!host) return;
    host.innerHTML = "";
    (data.favorites || []).forEach(item => {
      const btn = document.createElement("button");
      btn.className = "quick";
      btn.textContent = item.label;
      btn.onclick = () => sendCommand(item.target, item.action, {}, item.label);
      host.appendChild(btn);
    });
  } catch (e) {
    const box = el("errorBox");
    if (box) box.textContent = "שגיאת גישה מהירה: " + e.message;
  }
}


async function loadDiagnostics(){
  try{
    const r = await fetch("./reports/mobile_diagnostics_view.json?ts="+Date.now());
    const d = await r.json();
    const box = document.getElementById("diagBox");
    if(!box) return;
    box.innerHTML = `
      <div>API: ${d.api}</div>
      <div>Listener: ${d.listener}</div>
      <div>SSH: ${d.ssh}</div>
      <div>Queue: ${d.queue}</div>
      <div>WOL: ${d.wol}</div>
      <b>Summary: ${d.summary}</b>
    `;
  }catch(e){}
}


async function loadGlobalConnectivity() {
  try {
    const res = await fetch("./reports/global_connectivity_status.json?ts=" + Date.now());
    const d = await res.json();
    const box = document.getElementById("globalConnectivityBox");
    if (!box) return;

    const pill = (label, value) => {
      const cls = value === true ? "state-ok" : (value === false ? "state-bad" : "state-mid");
      const txt = value === true ? "תקין" : (value === false ? "לא תקין" : String(value));
      return `<div class="pill ${cls}">${label}: ${txt}</div>`;
    };

    box.innerHTML = `
      ${pill("API", d.api_ok)}
      ${pill("Listener", d.listener_ok)}
      ${pill("SSH", d.ssh_ok)}
      ${pill("Queue", d.queue_ok)}
      ${pill("WOL", d.wol_ok)}
      ${pill("Tailscale", d.tailscale_ok)}
      ${pill("Local", d.local_ready)}
      ${pill("Outside", d.outside_ready)}
      ${pill("Global", d.global_ready)}
      <pre style="margin-top:12px;white-space:pre-wrap">${JSON.stringify(d, null, 2)}</pre>
    `;
  } catch (e) {}
}

setInterval(loadGlobalConnectivity, 20000);
