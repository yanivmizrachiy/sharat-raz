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
    return confirm("פעולה מסוכנת: "+label+"\nלהמשיך?");
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

loadButtons();
refreshStatus();
setInterval(refreshStatus,8000);
