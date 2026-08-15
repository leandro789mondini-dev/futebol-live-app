const $ = (id) => document.getElementById(id);

const ids = [
  "minute",
  "homeGoals",
  "awayGoals",
  "homeShots",
  "awayShots",
  "homeSot",
  "awaySot",
  "homeCorners",
  "awayCorners",
  "homeDanger",
  "awayDanger",
  "oddHome",
  "oddDraw",
  "oddAway",
  "oddOver25",
  "oddBtts",
  "oddCorners"
];

let ticket = [];
let jogosDisponiveis = [];
let jogoSelecionado = null;

function n(id) {
  return Number($(id)?.value || 0);
}

function clamp(v, a = 0, b = 100) {
  return Math.max(a, Math.min(b, v));
}

function pct(v) {
  return `${Math.round(v)}%`;
}

function brl(v) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function metrics() {
  const minute = Math.max(1, n("minute"));
  const totalGoals = n("homeGoals") + n("awayGoals");
  const shots = n("homeShots") + n("awayShots");
  const sot = n("homeSot") + n("awaySot");
  const corners = n("homeCorners") + n("awayCorners");
  const danger = n("homeDanger") + n("awayDanger");

  const pace = clamp((shots / minute) * 160);
  const targetRate = shots ? (sot / shots) * 100 : 0;

  const goalPressure = clamp(
    pace * 0.38 +
    targetRate * 0.38 +
    Math.min((danger / minute) * 35, 35)
  );

  const over25 = clamp(
    totalGoals * 24 +
    goalPressure * 0.62 +
    (minute > 65 ? 8 : 0)
  );

  const btts = clamp(
    (n("homeSot") > 0 ? 24 : 0) +
    (n("awaySot") > 0 ? 24 : 0) +
    goalPressure * 0.48 +
    (totalGoals >= 2 ? 8 : 0)
  );

  const projectedCorners = corners / minute * 90;

  const cornerIndex = clamp(
    (projectedCorners / 10) * 75 +
    (danger / minute) * 12
  );

  const homeStrength = clamp(
    50 +
    (n("homeSot") - n("awaySot")) * 7 +
    (n("homeDanger") - n("awayDanger")) * 0.45 +
    (n("homeGoals") - n("awayGoals")) * 13
  );

  const awayStrength = 100 - homeStrength;

  return {
    minute,
    totalGoals,
    shots,
    sot,
    corners,
    danger,
    goalPressure,
    over25,
    btts,
    projectedCorners,
    cornerIndex,
    homeStrength,
    awayStrength
  };
}

function status(score) {
  if (score >= 72) return ["BOA", "good"];
  if (score >= 55) return ["AGUARDE", "wait"];
  return ["EVITAR", "avoid"];
}

function signalCard(name, score, why, odd, key) {
  const [label, cls] = status(score);
  const oddNumber = Number(odd || 0);

  return `
    <div class="signal ${cls}">
      <div class="top">
        <div>
          <div class="market">${name}</div>
          <div class="score">${pct(score)}</div>
        </div>
        <span class="pill ${cls}">${label}</span>
      </div>

      <div class="why