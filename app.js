const $ = id => document.getElementById(id);

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

let jogosPreLive = [];

let modoAtual = "live";

const analiseCache = new Map();

/* =========================================================
   UTILIDADES
========================================================= */

function n(id) {
  return Number($(id)?.value || 0);
}

function setInput(id, value) {
  const el = $(id);

  if (!el) return;

  el.value = value ?? 0;
}

function clamp(v, a = 0, b = 100) {
  return Math.max(
    a,
    Math.min(b, Number(v) || 0)
  );
}

function pct(v) {
  return `${Math.round(Number(v) || 0)}%`;
}

function brl(v) {
  return Number(v || 0).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL"
    }
  );
}

function numeroPercentual(v) {
  if (
    v === null ||
    v === undefined
  ) {
    return 0;
  }

  if (
    typeof v === "string"
  ) {
    return (
      Number(
        v.replace("%", "")
      ) || 0
    );
  }

  return Number(v) || 0;
}

function fmtOdd(v) {
  const n = Number(v);

  if (
    !Number.isFinite(n) ||
    n <= 1
  ) {
    return "—";
  }

  return n.toFixed(2);
}

function escapeHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function corProbabilidade(v) {
  v = Number(v) || 0;

  if (v >= 65) {
    return "#22c55e";
  }

  if (v >= 45) {
    return "#f59e0b";
  }

  return "#ef4444";
}

function corClassificacao(valor) {
  if (valor === "VALOR FORTE") {
    return "#22c55e";
  }

  if (valor === "VALOR") {
    return "#4ade80";
  }

  if (valor === "NEUTRO") {
    return "#f59e0b";
  }

  if (valor === "EVITAR") {
    return "#ef4444";
  }

  return "#8fa5bf";
}

/* =========================================================
   ANÁLISE AO VIVO
========================================================= */

function metrics() {
  const minute =
    Math.max(
      1,
      n("minute")
    );

  const totalGoals =
    n("homeGoals") +
    n("awayGoals");

  const shots =
    n("homeShots") +
    n("awayShots");

  const sot =
    n("homeSot") +
    n("awaySot");

  const corners =
    n("homeCorners") +
    n("awayCorners");

  const pace =
    clamp(
      (shots / minute) * 160
    );

  const targetRate =
    shots > 0
      ? (sot / shots) * 100
      : 0;

  const goalPressure =
    clamp(
      pace * 0.42 +
      targetRate * 0.42 +
      Math.min(
        sot * 4,
        25
      )
    );

  const over25 =
    clamp(
      totalGoals * 24 +
      goalPressure * 0.62 +
      (
        minute > 65
          ? 8
          : 0
      )
    );

  const btts =
    clamp(
      (
        n("homeSot") > 0
          ? 24
          : 0
      ) +
      (
        n("awaySot") > 0
          ? 24
          : 0
      ) +
      goalPressure * 0.48 +
      (
        totalGoals >= 2
          ? 8
          : 0
      )
    );

  const projectedCorners =
    corners / minute * 90;

  const cornerIndex =
    clamp(
      (
        projectedCorners / 10
      ) * 75
    );

  const homeStrength =
    clamp(
      50 +

      (
        n("homeSot") -
        n("awaySot")
      ) * 7 +

      (
        n("homeShots") -
        n("awayShots")
      ) * 2 +

      (
        n("homeCorners") -
        n("awayCorners")
      ) * 1.5 +

      (
        n("homeGoals") -
        n("awayGoals")
      ) * 13
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
    awayStrength:
      100 - homeStrength
  };
}

function status(score) {
  if (score >= 72) {
    return [
      "BOA",
      "good"
    ];
  }

  if (score >= 55) {
    return [
      "AGUARDE",
      "wait"
    ];
  }

  return [
    "EVITAR",
    "avoid"
  ];
}

function signalCard(
  name,
  score,
  why,
  odd,
  key
) {
  const [
    label,
    cls
  ] = status(score);

  const oddNumber =
    Number(odd || 0);

  return `
    <div class="signal ${cls}">

      <div class="top">

        <div>

          <div class="market">
            ${escapeHtml(name)}
          </div>

          <div class="score">
            ${pct(score)}
          </div>

        </div>

        <span class="pill ${cls}">
          ${label}
        </span>

      </div>

      <div class="why">
        ${why}
      </div>

      <button
        class="ghost full"

        ${
          oddNumber <= 1
            ? "disabled"
            : ""
        }

        onclick="addToTicket(
          '${key}',
          '${String(name).replaceAll(
            "'",
            "\\'"
          )}',
          ${oddNumber}
        )"
      >

        ${
          oddNumber > 1
            ? `Adicionar @ ${oddNumber.toFixed(2)}`
            : "Odd indisponível"
        }

      </button>

    </div>
  `;
}

function analyze() {
  const m = metrics();

  const home =
    $("homeTeam")
      ?.value
      .trim() ||
    "Casa";

  const away =
    $("awayTeam")
      ?.value
      .trim() ||
    "