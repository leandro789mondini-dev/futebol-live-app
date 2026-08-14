
const $ = (id) => document.getElementById(id);
const ids = ["minute","homeGoals","awayGoals","homeShots","awayShots","homeSot","awaySot","homeCorners","awayCorners","homeDanger","awayDanger","oddHome","oddDraw","oddAway","oddOver25","oddBtts","oddCorners"];
let ticket = [];

function n(id){ return Number($(id).value || 0); }
function clamp(v,a=0,b=100){ return Math.max(a,Math.min(b,v)); }
function pct(v){ return `${Math.round(v)}%`; }
function brl(v){ return v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}); }

function metrics(){
  const minute = Math.max(1,n("minute"));
  const totalGoals=n("homeGoals")+n("awayGoals");
  const shots=n("homeShots")+n("awayShots");
  const sot=n("homeSot")+n("awaySot");
  const corners=n("homeCorners")+n("awayCorners");
  const danger=n("homeDanger")+n("awayDanger");

  const pace = clamp((shots/minute)*160);
  const targetRate = shots ? (sot/shots)*100 : 0;
  const goalPressure = clamp(pace*0.38 + targetRate*0.38 + Math.min(danger/minute*35,35));
  const over25 = clamp((totalGoals*24) + goalPressure*0.62 + (minute>65?8:0));
  const btts = clamp((n("homeSot")>0?24:0)+(n("awaySot")>0?24:0)+goalPressure*0.48 + (totalGoals>=2?8:0));
  const projectedCorners = corners / minute * 90;
  const cornerIndex = clamp((projectedCorners/10)*75 + (danger/minute)*12);
  const homeStrength = clamp(50 + (n("homeSot")-n("awaySot"))*7 + (n("homeDanger")-n("awayDanger"))*.45 + (n("homeGoals")-n("awayGoals"))*13);
  const awayStrength = 100-homeStrength;

  return {minute,totalGoals,shots,sot,corners,danger,pace,targetRate,goalPressure,over25,btts,projectedCorners,cornerIndex,homeStrength,awayStrength};
}

function status(score){
  if(score>=72) return ["BOA","good"];
  if(score>=55) return ["AGUARDE","wait"];
  return ["EVITAR","avoid"];
}

function signalCard(name, score, why, odd, key){
  const [label,cls]=status(score);
  return `
    <div class="signal ${cls}">
      <div class="top">
        <div><div class="market">${name}</div><div class="score">${pct(score)}</div></div>
        <span class="pill ${cls}">${label}</span>
      </div>
      <div class="why">${why}</div>
      <button class="ghost full" onclick="addToTicket('${key}','${name.replaceAll("'","\\'")}',${odd})">Adicionar @ ${Number(odd).toFixed(2)}</button>
    </div>`;
}

function analyze(){
  const m=metrics();
  const home=$("homeTeam").value.trim()||"Casa";
  const away=$("awayTeam").value.trim()||"Visitante";

  const signals=[
    signalCard("Mais de 2.5 gols",m.over25,`Pressão ofensiva ${pct(m.goalPressure)}, ${m.sot} finalizações no alvo e ${m.totalGoals} gols até ${m.minute}'.`,n("oddOver25"),"over25"),
    signalCard("Ambas marcam",m.btts,`${home}: ${n("homeSot")} no alvo. ${away}: ${n("awaySot")} no alvo. Intensidade combinada ${pct(m.goalPressure)}.`,n("oddBtts"),"btts"),
    signalCard("Mais de 8.5 escanteios",m.cornerIndex,`Já saíram ${m.corners} escanteios; projeção aproximada de ${m.projectedCorners.toFixed(1)} até 90'.`,n("oddCorners"),"corners"),
    signalCard(`${home} vence`,m.homeStrength,`Força relativa calculada por placar, chutes no alvo e ataques perigosos.`,n("oddHome"),"home"),
    signalCard("Empate",clamp(100-Math.abs(m.homeStrength-50)*2 - Math.abs(n("homeGoals")-n("awayGoals"))*18),`Quanto mais equilibrados placar e pressão, maior o índice de empate.`,n("oddDraw"),"draw"),
    signalCard(`${away} vence`,m.awayStrength,`Força relativa calculada por placar, chutes no alvo e ataques perigosos.`,n("oddAway"),"away")
  ];

  $("signals").innerHTML=signals.join("");
  const leader = m.homeStrength>57?home:(m.awayStrength>57?away:"partida equilibrada");
  $("analysisText").innerHTML = `
    <b>Ritmo:</b> ${pct(m.goalPressure)} de pressão ofensiva estimada.<br>
    <b>Gols:</b> índice de Over 2.5 em ${pct(m.over25)} e BTTS em ${pct(m.btts)}.<br>
    <b>Escanteios:</b> ${m.corners} até agora, projeção de ${m.projectedCorners.toFixed(1)}.<br>
    <b>Resultado:</b> leitura atual favorece <b>${leader}</b>.<br><br>
    <span class="muted">Priorize mercados com status BOA e confirme se a odd oferecida compensa o risco. Índice alto não significa certeza.</span>`;
  $("lastUpdate").textContent = "Atualizado " + new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
  renderBuilder();
}

function renderBuilder(){
  const home=$("homeTeam").value.trim()||"Casa";
  const away=$("awayTeam").value.trim()||"Visitante";
  const markets=[
    ["home",`${home} vence`,n("oddHome")],["draw","Empate",n("oddDraw")],["away",`${away} vence`,n("oddAway")],
    ["over25","Mais de 2.5 gols",n("oddOver25")],["btts","Ambas marcam",n("oddBtts")],["corners","Mais de 8.5 escanteios",n("oddCorners")]
  ];
  $("builderMarkets").innerHTML=markets.map(([key,name,odd])=>`
    <div class="market-row"><span>${name}<br><small class="muted">@ ${odd.toFixed(2)}</small></span>
    <button onclick="addToTicket('${key}','${name.replaceAll("'","\\'")}',${odd})">+</button></div>`).join("");
}

window.addToTicket = function(key,name,odd){
  if(!odd || odd<=1) return;
  const exists=ticket.find(x=>x.key===key);
  if(!exists) ticket.push({key,name,odd});
  renderTicket();
}
function renderTicket(){
  const total=ticket.reduce((a,x)=>a*x.odd,1);
  $("ticketCount").textContent=ticket.length;
  $("ticketOdd").textContent=total.toFixed(2);
  $("ticketReturn").textContent=brl(10*total);
}
$("clearTicket").addEventListener("click",()=>{ticket=[];renderTicket()});
$("analyzeBtn").addEventListener("click",analyze);
$("refreshBtn").addEventListener("click", async ()=>{
  const api=localStorage.getItem("liveApiUrl");
  if(!api){ analyze(); return; }
  try{
    $("refreshBtn").textContent="Buscando...";
    const r=await fetch(api,{cache:"no-store"});
    if(!r.ok) throw new Error("HTTP "+r.status);
    const d=await r.json();
    const map={minute:"minute",homeGoals:"homeGoals",awayGoals:"awayGoals",homeShots:"homeShots",awayShots:"awayShots",homeSot:"homeSot",awaySot:"awaySot",homeCorners:"homeCorners",awayCorners:"awayCorners",homeDanger:"homeDanger",awayDanger:"awayDanger",oddHome:"oddHome",oddDraw:"oddDraw",oddAway:"oddAway",oddOver25:"oddOver25",oddBtts:"oddBtts",oddCorners:"oddCorners"};
    Object.entries(map).forEach(([k,id])=>{ if(d[k]!==undefined) $(id).value=d[k]; });
    if(d.homeTeam) $("homeTeam").value=d.homeTeam;
    if(d.awayTeam) $("awayTeam").value=d.awayTeam;
    analyze();
    $("modeLabel").textContent="LIVE";
  }catch(e){ alert("Não foi possível atualizar a API: "+e.message); }
  finally{$("refreshBtn").textContent="Atualizar";}
});
$("settingsBtn").addEventListener("click",()=>{
  $("apiUrl").value=localStorage.getItem("liveApiUrl")||"";
  $("settingsDialog").showModal();
});
$("saveSettings").addEventListener("click",()=>{
  const url=$("apiUrl").value.trim();
  if(url) localStorage.setItem("liveApiUrl",url); else localStorage.removeItem("liveApiUrl");
  $("modeLabel").textContent=url?"LIVE":"DEMO";
});
ids.forEach(id=>$(id).addEventListener("change",renderBuilder));

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
if(localStorage.getItem("liveApiUrl")) $("modeLabel").textContent="LIVE";
renderBuilder(); analyze();
