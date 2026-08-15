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

      <div class="why">${why}</div>

      <button
        class="ghost full"
        onclick="addToTicket(
          '${key}',
          '${name.replaceAll("'", "\\'")}',
          ${oddNumber}
        )"
        ${oddNumber <= 1 ? "disabled" : ""}
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

  const home = $("homeTeam")?.value.trim() || "Casa";
  const away = $("awayTeam")?.value.trim() || "Visitante";

  const temEstatisticas =
    m.shots > 0 ||
    m.sot > 0 ||
    m.corners > 0 ||
    m.danger > 0;

  if (!temEstatisticas) {
    if ($("analysisText")) {
      $("analysisText").innerHTML = `
        <b>${home} ${n("homeGoals")} x ${n("awayGoals")} ${away}</b><br>
        Minuto: ${n("minute")}'<br><br>
        <span class="muted">
          Placar e minuto estão ao vivo. Finalizações, escanteios,
          ataques perigosos e odds serão conectados na próxima etapa.
          Enquanto esses dados estiverem zerados, o app não deve gerar
          recomendações automáticas de mercado.
        </span>
      `;
    }

    if ($("signals")) {
      $("signals").innerHTML = "";
    }

    if ($("lastUpdate")) {
      $("lastUpdate").textContent =
        "Atualizado " +
        new Date().toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit"
        });
    }

    renderBuilder();
    return;
  }

  const signals = [
    signalCard(
      "Mais de 2.5 gols",
      m.over25,
      `Pressão ofensiva ${pct(m.goalPressure)}, ${m.sot} no alvo e ${m.totalGoals} gols até ${m.minute}'.`,
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
      "Força relativa por placar e estatísticas ao vivo.",
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
      "Índice baseado no equilíbrio da partida.",
      n("oddDraw"),
      "draw"
    ),

    signalCard(
      `${away} vence`,
      m.awayStrength,
      "Força relativa por placar e estatísticas ao vivo.",
      n("oddAway"),
      "away"
    )
  ];

  if ($("signals")) {
    $("signals").innerHTML = signals.join("");
  }

  if ($("analysisText")) {
    $("analysisText").innerHTML = `
      <b>Pressão ofensiva:</b> ${pct(m.goalPressure)}<br>
      <b>Over 2.5:</b> ${pct(m.over25)}<br>
      <b>BTTS:</b> ${pct(m.btts)}<br>
      <b>Escanteios:</b> ${m.corners}, projeção ${m.projectedCorners.toFixed(1)}.<br><br>
      <span class="muted">
        Índices são apoio de análise e não garantia de resultado.
      </span>
    `;
  }

  if ($("lastUpdate")) {
    $("lastUpdate").textContent =
      "Atualizado " +
      new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
      });
  }

  renderBuilder();
}

function renderBuilder() {
  const home = $("homeTeam")?.value.trim() || "Casa";
  const away = $("awayTeam")?.value.trim() || "Visitante";

  const markets = [
    ["home", `${home} vence`, n("oddHome")],
    ["draw", "Empate", n("oddDraw")],
    ["away", `${away} vence`, n("oddAway")],
    ["over25", "Mais de 2.5 gols", n("oddOver25")],
    ["btts", "Ambas marcam", n("oddBtts")],
    ["corners", "Mais de 8.5 escanteios", n("oddCorners")]
  ];

  if (!$("builderMarkets")) return;

  $("builderMarkets").innerHTML = markets.map(([key, name, odd]) => `
    <div class="market-row">
      <span>
        ${name}<br>
        <small class="muted">
          ${odd > 1 ? `@ ${odd.toFixed(2)}` : "Odd indisponível"}
        </small>
      </span>

      <button
        onclick="addToTicket(
          '${key}',
          '${name.replaceAll("'", "\\'")}',
          ${odd}
        )"
        ${odd <= 1 ? "disabled" : ""}
      >
        +
      </button>
    </div>
  `).join("");
}

window.addToTicket = function(key, name, odd) {
  if (!odd || odd <= 1) return;

  const exists = ticket.find(x => x.key === key);

  if (!exists) {
    ticket.push({ key, name, odd });
  }

  renderTicket();
};

function renderTicket() {
  const total = ticket.reduce((a, x) => a * x.odd, 1);

  if ($("ticketCount")) {
    $("ticketCount").textContent = ticket.length;
  }

  if ($("ticketOdd")) {
    $("ticketOdd").textContent = total.toFixed(2);
  }

  if ($("ticketReturn")) {
    $("ticketReturn").textContent = brl(10 * total);
  }
}

function setInput(id, value) {
  const el = $(id);
  if (!el) return;
  el.value = value ?? 0;
}

function criarPainelJogos() {
  if (document.getElementById("liveGamesBox")) return;

  const box = document.createElement("section");

  box.id = "liveGamesBox";

  box.style.cssText = `
    margin:20px auto;
    padding:18px;
    max-width:1100px;
    border:1px solid #29415f;
    border-radius:22px;
    background:#0d1b2d;
  `;

  box.innerHTML = `
    <div style="
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:10px;
      margin-bottom:15px;
    ">
      <div>
        <div style="
          font-size:13px;
          font-weight:800;
          color:#55a7ff;
          letter-spacing:1px;
        ">
          PARTIDAS
        </div>

        <div style="
          font-size:24px;
          font-weight:800;
          color:white;
        ">
          ⚽ Jogos ao vivo
        </div>
      </div>

      <span id="liveGamesCount" style="
        color:#9eb0c7;
        font-size:14px;
      ">
        0 jogos
      </span>
    </div>

    <div id="liveGamesList">
      <div style="color:#9eb0c7;">
        Toque em Atualizar para carregar os jogos.
      </div>
    </div>
  `;

  const referencia =
    $("homeTeam")?.closest("section") ||
    $("homeTeam")?.parentElement?.parentElement?.parentElement;

  if (referencia?.parentNode) {
    referencia.parentNode.insertBefore(box, referencia);
  } else {
    document.body.prepend(box);
  }
}

function renderJogos() {
  criarPainelJogos();

  const lista = $("liveGamesList");
  const contador = $("liveGamesCount");

  if (!lista) return;

  if (contador) {
    contador.textContent =
      `${jogosDisponiveis.length} jogo${jogosDisponiveis.length === 1 ? "" : "s"}`;
  }

  if (!jogosDisponiveis.length) {
    lista.innerHTML = `
      <div style="color:#9eb0c7;padding:10px 0;">
        Nenhuma partida encontrada.
      </div>
    `;
    return;
  }

  lista.innerHTML = jogosDisponiveis.map((jogo, index) => {
    const selecionado =
      jogoSelecionado?.fixtureId === jogo.fixtureId;

    const minuto =
      jogo.minute
        ? `${jogo.minute}'`
        : jogo.status || "";

    return `
      <button
        onclick="selecionarJogo(${index})"
        style="
          width:100%;
          border:${selecionado ? "2px solid #36a3ff" : "1px solid #263d59"};
          background:${selecionado ? "#142b45" : "#091625"};
          color:white;
          border-radius:15px;
          padding:14px;
          margin-bottom:10px;
          text-align:left;
          cursor:pointer;
        "
      >
        <div style="
          color:#8fa5bf;
          font-size:12px;
          margin-bottom:7px;
        ">
          ${jogo.league || "Competição"} ${minuto ? `• ${minuto}` : ""}
        </div>

        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:8px;
          font-size:16px;
          font-weight:700;
        ">
          <span>${jogo.homeTeam}</span>

          <strong style="
            min-width:55px;
            text-align:center;
            font-size:18px;
          ">
            ${jogo.homeGoals} × ${jogo.awayGoals}
          </strong>

          <span style="text-align:right;">
            ${jogo.awayTeam}
          </span>
        </div>
      </button>
    `;
  }).join("");
}

window.selecionarJogo = function(index) {
  const jogo = jogosDisponiveis[index];
  if (!jogo) return;

  jogoSelecionado = jogo;

  if ($("homeTeam")) {
    $("homeTeam").value = jogo.homeTeam || "Casa";
  }

  if ($("awayTeam")) {
    $("awayTeam").value = jogo.awayTeam || "Visitante";
  }

  setInput("minute", jogo.minute || 0);
  setInput("homeGoals", jogo.homeGoals ?? 0);
  setInput("awayGoals", jogo.awayGoals ?? 0);

  setInput("homeShots", 0);
  setInput("awayShots", 0);
  setInput("homeSot", 0);
  setInput("awaySot", 0);
  setInput("homeCorners", 0);
  setInput("awayCorners", 0);
  setInput("homeDanger", 0);
  setInput("awayDanger", 0);

  if ($("modeLabel")) {
    $("modeLabel").textContent =
      jogo.status ? `LIVE ${jogo.status}` : "LIVE";
  }

  renderJogos();
  analyze();

  $("homeTeam")?.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
};

async function atualizarJogos() {
  try {
    if ($("refreshBtn")) {
      $("refreshBtn").textContent = "Buscando...";
      $("refreshBtn").disabled = true;
    }

    const r = await fetch("/api/jogos", {
      cache: "no-store"
    });

    if (!r.ok) {
      throw new Error("HTTP " + r.status);
    }

    const dados = await r.json();

    jogosDisponiveis =
      Array.isArray(dados.jogos)
        ? dados.jogos
        : [];

    if ($("modeLabel")) {
      $("modeLabel").textContent =
        dados.modo === "LIVE"
          ? "LIVE"
          : "JOGOS DE HOJE";
    }

    renderJogos();

    if (jogosDisponiveis.length) {
      selecionarJogo(0);
    }

  } catch (e) {
    console.error(e);

    alert(
      "Não foi possível carregar os jogos: " +
      e.message
    );

  } finally {
    if ($("refreshBtn")) {
      $("refreshBtn").textContent = "Atualizar";
      $("refreshBtn").disabled = false;
    }
  }
}

$("clearTicket")?.addEventListener("click", () => {
  ticket = [];
  renderTicket();
});

$("analyzeBtn")?.addEventListener("click", analyze);

$("refreshBtn")?.addEventListener("click", atualizarJogos);

ids.forEach(id => {
  $(id)?.addEventListener("change", renderBuilder);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch(() => {});
  });
}

criarPainelJogos();
renderBuilder();
analyze();

window.addEventListener("load", () => {
  atualizarJogos();
});