const $ = id => document.getElementById(id);

const ids = [
  "minute","homeGoals","awayGoals",
  "homeShots","awayShots",
  "homeSot","awaySot",
  "homeCorners","awayCorners",
  "homeDanger","awayDanger",
  "oddHome","oddDraw","oddAway",
  "oddOver25","oddBtts","oddCorners"
];

let ticket = [];
let jogosDisponiveis = [];
let jogoSelecionado = null;

let jogosPreLive = [];
let modoAtual = "live";
let multiplaPreLive = [];

/* ================================
   FUNÇÕES BÁSICAS
================================ */

function n(id) {
  return Number($(id)?.value || 0);
}

function setInput(id, value) {
  const el = $(id);
  if (el) el.value = value ?? 0;
}

function clamp(v, a = 0, b = 100) {
  return Math.max(a, Math.min(b, v));
}

function pct(v) {
  return `${Math.round(Number(v) || 0)}%`;
}

function brl(v) {
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function percentualNumero(valor) {
  if (valor === null || valor === undefined) return 0;

  if (typeof valor === "string") {
    return Number(valor.replace("%", "")) || 0;
  }

  return Number(valor) || 0;
}

function probabilidadeImplicita(odd) {
  odd = Number(odd);

  if (!odd || odd <= 1) return 0;

  return 100 / odd;
}

function vantagem(prob, odd) {
  return Number(prob || 0) - probabilidadeImplicita(odd);
}

function corValor(v) {
  if (v >= 8) return "#22c55e";
  if (v >= 3) return "#f59e0b";
  return "#ef4444";
}

/* ================================
   ANÁLISE AO VIVO
================================ */

function metrics() {
  const minute = Math.max(1, n("minute"));

  const totalGoals =
    n("homeGoals") + n("awayGoals");

  const shots =
    n("homeShots") + n("awayShots");

  const sot =
    n("homeSot") + n("awaySot");

  const corners =
    n("homeCorners") + n("awayCorners");

  const pace =
    clamp((shots / minute) * 160);

  const targetRate =
    shots ? (sot / shots) * 100 : 0;

  const goalPressure =
    clamp(
      pace * 0.42 +
      targetRate * 0.42 +
      Math.min(sot * 4, 25)
    );

  const over25 =
    clamp(
      totalGoals * 24 +
      goalPressure * 0.62 +
      (minute > 65 ? 8 : 0)
    );

  const btts =
    clamp(
      (n("homeSot") > 0 ? 24 : 0) +
      (n("awaySot") > 0 ? 24 : 0) +
      goalPressure * 0.48 +
      (totalGoals >= 2 ? 8 : 0)
    );

  const projectedCorners =
    corners / minute * 90;

  const cornerIndex =
    clamp(
      (projectedCorners / 10) * 75
    );

  const homeStrength =
    clamp(
      50 +
      (n("homeSot") - n("awaySot")) * 7 +
      (n("homeShots") - n("awayShots")) * 2 +
      (n("homeCorners") - n("awayCorners")) * 1.5 +
      (n("homeGoals") - n("awayGoals")) * 13
    );

  return {
    minute,
    totalGoals,
    shots,
    sot,
    corners,
    goalPressure,
    over25,
    btts,
    projectedCorners,
    cornerIndex,
    homeStrength,
    awayStrength: 100 - homeStrength
  };
}

function status(score) {
  if (score >= 72) return ["BOA", "good"];
  if (score >= 55) return ["AGUARDE", "wait"];
  return ["EVITAR", "avoid"];
}

function signalCard(name, score, why, odd, key) {
  const [label, cls] = status(score);
  const o = Number(odd || 0);

  return `
    <div class="signal ${cls}">
      <div class="top">
        <div>
          <div class="market">${name}</div>
          <div class="score">${pct(score)}</div>
        </div>

        <span class="pill ${cls}">
          ${label}
        </span>
      </div>

      <div class="why">${why}</div>

      <button
        class="ghost full"
        ${o <= 1 ? "disabled" : ""}
        onclick="addToTicket(
          '${key}',
          '${name.replaceAll("'", "\\'")}',
          ${o}
        )"
      >
        ${
          o > 1
            ? `Adicionar @ ${o.toFixed(2)}`
            : "Odd indisponível"
        }
      </button>
    </div>
  `;
}

function analyze() {
  const m = metrics();

  const home =
    $("homeTeam")?.value.trim() || "Casa";

  const away =
    $("awayTeam")?.value.trim() || "Visitante";

  const temStats =
    m.shots > 0 ||
    m.sot > 0 ||
    m.corners > 0;

  if (!temStats) {
    if ($("analysisText")) {
      $("analysisText").innerHTML = `
        <b>
          ${home}
          ${n("homeGoals")} x
          ${n("awayGoals")}
          ${away}
        </b>

        <br>

        Minuto: ${n("minute")}'

        <br><br>

        <span class="muted">
          Aguardando estatísticas detalhadas.
        </span>
      `;
    }

    if ($("signals")) {
      $("signals").innerHTML = "";
    }

    renderBuilder();
    atualizarHorario();
    return;
  }

  const sinais = [
    signalCard(
      "Mais de 2.5 gols",
      m.over25,
      `${m.shots} finalizações, ${m.sot} no alvo e ${m.totalGoals} gols.`,
      n("oddOver25"),
      "over25"
    ),

    signalCard(
      "Ambas marcam",
      m.btts,
      `${home}: ${n("homeSot")} no alvo. ${away}: ${n("awaySot")} no alvo.`,
      n("oddBtts"),
      "btts"
    ),

    signalCard(
      "Mais de 8.5 escanteios",
      m.cornerIndex,
      `${m.corners} escanteios; projeção ${m.projectedCorners.toFixed(1)}.`,
      n("oddCorners"),
      "corners"
    ),

    signalCard(
      `${home} vence`,
      m.homeStrength,
      "Leitura baseada em placar, finalizações, no alvo e escanteios.",
      n("oddHome"),
      "home"
    ),

    signalCard(
      "Empate",
      clamp(
        100 -
        Math.abs(m.homeStrength - 50) * 2 -
        Math.abs(n("homeGoals") - n("awayGoals")) * 18
      ),
      "Índice de equilíbrio atual da partida.",
      n("oddDraw"),
      "draw"
    ),

    signalCard(
      `${away} vence`,
      m.awayStrength,
      "Leitura baseada em placar e estatísticas.",
      n("oddAway"),
      "away"
    )
  ];

  if ($("signals")) {
    $("signals").innerHTML = sinais.join("");
  }

  if ($("analysisText")) {
    $("analysisText").innerHTML = `
      <b>Finalizações