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

let jogosPreLive = [];
let modoAtual = "live";

const oddsCache = new Map();

/* =========================================================
   UTILIDADES
========================================================= */

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
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function setInput(id, value) {
  const el = $(id);

  if (!el) return;

  el.value = value ?? 0;
}

function numeroPercentual(valor) {
  if (valor === null || valor === undefined) {
    return 0;
  }

  if (typeof valor === "string") {
    return Number(
      valor.replace("%", "")
    ) || 0;
  }

  return Number(valor) || 0;
}

function oddValida(odd) {
  const x = Number(odd);

  return Number.isFinite(x) && x > 1
    ? x
    : null;
}

function probabilidadeImplicita(odd) {
  const x = oddValida(odd);

  if (!x) return 0;

  return 100 / x;
}

function valorEstimado(probModelo, odd) {
  if (!oddValida(odd)) return null;

  return (
    Number(probModelo || 0) -
    probabilidadeImplicita(odd)
  );
}

function classificacaoValor(valor) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return {
      label: "SEM ODD",
      cor: "#8fa5bf"
    };
  }

  if (valor >= 8) {
    return {
      label: "VALOR FORTE",
      cor: "#22c55e"
    };
  }

  if (valor >= 3) {
    return {
      label: "VALOR",
      cor: "#4ade80"
    };
  }

  if (valor >= -3) {
    return {
      label: "NEUTRO",
      cor: "#f59e0b"
    };
  }

  return {
    label: "EVITAR",
    cor: "#ef4444"
  };
}

/* =========================================================
   MÉTRICAS AO VIVO
========================================================= */

function metrics() {
  const minute =
    Math.max(1, n("minute"));

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

  const danger =
    n("homeDanger") +
    n("awayDanger");

  const pace = clamp(
    (shots / minute) * 160
  );

  const targetRate =
    shots
      ? (sot / shots) * 100
      : 0;

  const goalPressure = clamp(
    pace * 0.38 +
    targetRate * 0.38 +
    Math.min(
      (danger / minute) * 35,
      35
    )
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

  const projected