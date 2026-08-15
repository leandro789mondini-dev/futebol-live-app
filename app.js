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

const analiseCache = new Map();
const statsCache = new Map();

let buscandoJogos = false;
let buscandoPreLive = false;

let ultimaAtualizacaoJogos = 0;
let ultimaAtualizacaoPreLive = 0;

const MIN_INTERVAL_LIVE = 5 * 60 * 1000;
const MIN_INTERVAL_PRELIVE = 10 * 60 * 1000;
const STATS_CACHE_MS = 60 * 1000;

/* =====================================================
   UTILIDADES
===================================================== */

function n(id) {
  return Number($(id)?.value || 0);
}

function setInput(id, value) {
  const el = $(id);
  if (el) el.value = value ?? 0;
}

function clamp(v, min = 0, max = 100) {
  return Math.max(
    min,
    Math.min(max, Number(v) || 0)
  );
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

function escapeHtml(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function mensagemErroHttp(status) {
  if (status === 429) {
    return "Limite diário da API atingido.";
  }

  if (status === 401 || status === 403) {
    return "Chave da API recusada.";
  }

  if (status === 404) {
    return "Dados não encontrados.";
  }

  if (status === 400) {
    return "A API recusou os parâmetros enviados.";
  }

  return `Erro HTTP ${status}`;
}

/* =====================================================
   STATUS DA API
===================================================== */

function criarStatusApi() {
  if ($("apiStatusBox")) return;

  const box = document.createElement("div");

  box.id = "apiStatusBox";

  box.style.cssText = `
    max-width:1100px;
    margin:12px auto;
    padding:12px 15px;
    background:#0d1b2d;
    border:1px solid #29415f;
    border-radius:15px;
    color:#a9bad0;
    font-size:14px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
  `;

  box.innerHTML = `
    <div>
      <b id="apiStatusText">
        ⚪ API aguardando
      </b>

      <div
        id="apiStatusDetail"
        style="
          margin-top:3px;
          font-size:12px;
          color:#8093aa;
        "
      >
        Aguardando primeira atualização.
      </div>
    </div>

    <div
      id="apiQuotaText"
      style="
        font-size:12px;
        text-align:right;
        color:#8093aa;
      "
    ></div>
  `;

  const main =
    document.querySelector("main") ||
    document.body;

  const switcher =
    $("modeSwitcher");

  if (switcher?.parentNode) {
    switcher.parentNode.insertBefore(
      box,
      switcher.nextSibling
    );
  } else {
    main.prepend(box);
  }
}

function atualizarStatusApi(
  tipo = "ok",
  detalhe = "",
  api = null,
  cache = false
) {
  criarStatusApi();

  const titulo = $("apiStatusText");
  const desc = $("apiStatusDetail");
  const quota = $("apiQuotaText");

  if (!titulo || !desc) return;

  if (tipo === "ok") {
    titulo.textContent =
      cache
        ? "🟡 API disponível • cache"
        : "🟢 API disponível";

    titulo.style.color =
      cache ? "#f59e0b" : "#34d399";
  }

  if (tipo === "limite") {
    titulo.textContent =
      "🔴 Limite diário atingido";

    titulo.style.color = "#fb7185";
  }

  if (tipo === "erro") {
    titulo.textContent =
      "🔴 Erro na API";

    titulo.style.color = "#fb7185";
  }

  if (tipo === "carregando") {
    titulo.textContent =
      "🔵 Consultando API...";

    titulo.style.color = "#60a5fa";
  }

  desc.textContent =
    detalhe ||
    "Sistema operacional.";

  if (quota) {
    const restante =
      api?.restanteDia;

    const limite =
      api?.limiteDia;

    if (
      restante !== null &&
      restante !== undefined &&
      limite !== null &&
      limite !== undefined
    ) {
      quota.textContent =
        `API: ${restante}/${limite}`;
    } else {
      quota.textContent = "";
    }
  }
}

/* =====================================================
   ANÁLISE AO VIVO
===================================================== */

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

  const pace =
    clamp(
      (shots / minute) * 160
    );

  const targetRate =
    shots > 0
      ? (sot / shots) * 100
      : 0;

  const pressure =
    clamp(
      pace * 0.42 +
      targetRate * 0.42 +
      Math.min(sot * 4, 25)
    );

  const over25 =
    clamp(
      totalGoals * 24 +
      pressure * 0.62 +
      (minute > 65 ? 8 : 0)
    );

  const btts =
    clamp(
      (n("homeSot") > 0 ? 24 : 0) +
      (n("awaySot") > 0 ? 24 : 0) +
      pressure * 0.48 +
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
    pressure,
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

function signalCard(
  name,
  score,
  why,
  odd,
  key
) {
  const [label, cls] =
    status(score);

  const o =
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
        ${o <= 1 ? "disabled" : ""}
        onclick="addToTicket(
          '${key}',
          '${String(name).replaceAll("'", "\\'")}',
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
    $("homeTeam")?.value.trim() ||
    "Casa";

  const away =
    $("awayTeam")?.value.trim() ||
    "Visitante";

  const temStats =
    m.shots > 0 ||
    m.sot > 0 ||
    m.corners > 0;

  if (!temStats) {
    if ($("analysisText")) {
      $("analysisText").innerHTML = `
        <b>
          ${escapeHtml(home)}
          ${n("homeGoals")}
          x
          ${n("awayGoals")}
          ${escapeHtml(away)}
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
      `${m.shots} finalizações, ${m.sot} no alvo e ${m.totalGoals} gols até ${m.minute}'.`,
      n("oddOver25"),
      "over25"
    ),

    signalCard(
      "Ambas marcam",
      m.btts,
      `${escapeHtml(home)}: ${n("homeSot")} no alvo. ${escapeHtml(away)}: ${n("awaySot")} no alvo.`,
      n("oddBtts"),
      "btts"
    ),

    signalCard(
      "Mais de 8.5 escanteios",
      m.cornerIndex,
      `${m.corners} escanteios. Projeção aproximada: ${m.projectedCorners.toFixed(1)}.`,
      n("oddCorners"),
      "corners"
    ),

    signalCard(
      `${home} vence`,
      m.homeStrength,
      "Índice baseado em placar e estatísticas ao vivo.",
      n("oddHome"),
      "home"
    ),

    signalCard(
      "Empate",
      clamp(
        100 -
        Math.abs(m.homeStrength - 50) * 2 -
        Math.abs(
          n("homeGoals") -
          n("awayGoals")
        ) * 18
      ),
      "Índice baseado no equilíbrio da partida.",
      n("oddDraw"),
      "draw"
    ),

    signalCard(
      `${away} vence`,
      m.awayStrength,
      "Índice baseado em placar e estatísticas ao vivo.",
      n("oddAway"),
      "away"
    )
  ];

  if ($("signals")) {
    $("signals").innerHTML =
      sinais.join("");
  }

  if ($("analysisText")) {
    $("analysisText").innerHTML = `
      <b>Finalizações:</b>
      ${n("homeShots")} × ${n("awayShots")}
      <br>

      <b>No alvo:</b>
      ${n("homeSot")} × ${n("awaySot")}
      <br>

      <b>Escanteios:</b>
      ${n("homeCorners")} × ${n("awayCorners")}
      <br>

      <b>Over 2.5:</b>
      ${pct(m.over25)}
      <br>

      <b>BTTS:</b>
      ${pct(m.btts)}

      <br><br>

      <span class="muted">
        Os indicadores são estimativas,
        não garantias de resultado.
      </span>
    `;
  }

  renderBuilder();
  atualizarHorario();
}

function atualizarHorario() {
  if (!$("lastUpdate")) return;

  $("lastUpdate").textContent =
    "Atualizado " +
    new Date().toLocaleTimeString(
      "pt-BR",
      {
        hour: "2-digit",
        minute: "2-digit"
      }
    );
}

/* =====================================================
   CONSTRUTOR
===================================================== */

function renderBuilder() {
  if (!$("builderMarkets")) return;

  const home =
    $("homeTeam")?.value.trim() ||
    "Casa";

  const away =
    $("awayTeam")?.value.trim() ||
    "Visitante";

  const mercados = [
    ["home", `${home} vence`, n("oddHome")],
    ["draw", "Empate", n("oddDraw")],
    ["away", `${away} vence`, n("oddAway")],
    ["over25", "Mais de 2.5 gols", n("oddOver25")],
    ["btts", "Ambas marcam", n("oddBtts")],
    ["corners", "Mais de 8.5 escanteios", n("oddCorners")]
  ];

  $("builderMarkets").innerHTML =
    mercados.map(
      ([key, name, odd]) => `
        <div class="market-row">
          <span>
            ${escapeHtml(name)}
            <br>

            <small class="muted">
              ${
                odd > 1
                  ? `@ ${odd.toFixed(2)}`
                  : "Odd indisponível"
              }
            </small>
          </span>

          <button
            ${odd <= 1 ? "disabled" : ""}
            onclick="addToTicket(
              '${key}',
              '${String(name).replaceAll("'", "\\'")}',
              ${odd}
            )"
          >
            +
          </button>
        </div>
      `
    )
    .join("");
}

window.addToTicket =
function(key, name, odd) {
  odd = Number(odd);

  if (
    !Number.isFinite(odd) ||
    odd <= 1
  ) {
    return;
  }

  if (
    !ticket.find(
      item => item.key === key
    )
  ) {
    ticket.push({
      key,
      name,
      odd
    });
  }

  renderTicket();
};

function renderTicket() {
  const total =
    ticket.reduce(
      (acc, item) =>
        acc * item.odd,
      1
    );

  if ($("ticketCount")) {
    $("ticketCount").textContent =
      ticket.length;
  }

  if ($("ticketOdd")) {
    $("ticketOdd").textContent =
      total.toFixed(2);
  }

  if ($("ticketReturn")) {
    $("ticketReturn").textContent =
      brl(10 * total);
  }
}

/* =====================================================
   MENU AO VIVO / PRÉ-LIVE
===================================================== */

function criarMenuModos() {
  if ($("modeSwitcher")) return;

  const box =
    document.createElement("div");

  box.id = "modeSwitcher";

  box.style.cssText = `
    max-width:1100px;
    margin:18px auto;
    padding:8px;
    display:flex;
    gap:8px;
    background:#081421;
    border:1px solid #29415f;
    border-radius:18px;
  `;

  box.innerHTML = `
    <button
      id="btnLiveMode"
      style="
        flex:1;
        padding:13px;
        border:0;
        border-radius:13px;
        font-weight:800;
        background:#2d8cff;
        color:white;
      "
    >
      🔴 AO VIVO
    </button>

    <button
      id="btnPreLiveMode"
      style="
        flex:1;
        padding:13px;
        border:0;
        border-radius:13px;
        font-weight:800;
        background:#102135;
        color:#a9bad0;
      "
    >
      📊 PRÉ-LIVE
    </button>
  `;

  const main =
    document.querySelector("main") ||
    document.body;

  main.prepend(box);

  $("btnLiveMode")
    ?.addEventListener(
      "click",
      () => mudarModo("live")
    );

  $("btnPreLiveMode")
    ?.addEventListener(
      "click",
      () => mudarModo("prelive")
    );
}

function atualizarBotoesModo() {
  const live =
    modoAtual === "live";

  if ($("btnLiveMode")) {
    $("btnLiveMode").style.background =
      live ? "#2d8cff" : "#102135";

    $("btnLiveMode").style.color =
      live ? "white" : "#a9bad0";
  }

  if ($("btnPreLiveMode")) {
    $("btnPreLiveMode").style.background =
      live ? "#102135" : "#2d8cff";

    $("btnPreLiveMode").style.color =
      live ? "#a9bad0" : "white";
  }
}

function mudarModo(modo) {
  modoAtual = modo;

  atualizarBotoesModo();

  const liveBox =
    $("liveGamesBox");

  const preBox =
    $("preLiveBox");

  const dadosPartida =
    $("homeTeam")?.closest("section");

  if (modo === "live") {
    if (liveBox) {
      liveBox.style.display = "block";
    }

    if (preBox) {
      preBox.style.display = "none";
    }

    if (dadosPartida) {
      dadosPartida.style.display = "";
    }

    if ($("modeLabel")) {
      $("modeLabel").textContent =
        "LIVE";
    }

    atualizarJogos(false);
    return;
  }

  if (liveBox) {
    liveBox.style.display = "none";
  }

  if (dadosPartida) {
    dadosPartida.style.display =
      "none";
  }

  criarPainelPreLive();

  if (preBox) {
    preBox.style.display = "block";
  }

  if ($("modeLabel")) {
    $("modeLabel").textContent =
      "PRÉ-LIVE";
  }

  carregarPreLive(false);
}

/* =====================================================
   PAINEL AO VIVO
===================================================== */

function criarPainelJogos() {
  if ($("liveGamesBox")) return;

  const box =
    document.createElement("section");

  box.id = "liveGamesBox";

  box.style.cssText = `
    margin:20px auto;
    padding:18px;
    max-width:1100px;
    background:#0d1b2d;
    border:1px solid #29415f;
    border-radius:22px;
  `;

  box.innerHTML = `
    <div style="
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin-bottom:15px;
    ">
      <div>
        <div style="
          color:#55a7ff;
          font-size:13px;
          font-weight:800;
        ">
          PARTIDAS
        </div>

        <div style="
          color:white;
          font-size:24px;
          font-weight:800;
        ">
          ⚽ Jogos ao vivo
        </div>
      </div>

      <span
        id="liveGamesCount"
        style="color:#9eb0c7;"
      >
        0 jogos
      </span>
    </div>

    <div id="liveGamesList">
      <div style="color:#9eb0c7;">
        Aguardando atualização.
      </div>
    </div>
  `;

  const referencia =
    $("homeTeam")?.closest("section");

  if (referencia?.parentNode) {
    referencia.parentNode.insertBefore(
      box,
      referencia
    );
  } else {
    document.body.appendChild(box);
  }
}

function renderJogos() {
  criarPainelJogos();

  const lista =
    $("liveGamesList");

  if (!lista) return;

  if ($("liveGamesCount")) {
    $("liveGamesCount").textContent =
      `${jogosDisponiveis.length} jogo${
        jogosDisponiveis.length === 1
          ? ""
          : "s"
      }`;
  }

  if (!jogosDisponiveis.length) {
    lista.innerHTML = `
      <div style="
        color:#9eb0c7;
        line-height:1.5;
      ">
        Nenhum jogo carregado.
      </div>
    `;

    return;
  }

  lista.innerHTML =
    jogosDisponiveis
      .map(
        (jogo, index) => `
          <button
            onclick="selecionarJogo(${index})"
            style="
              width:100%;
              padding:14px;
              margin-bottom:10px;
              background:#091625;
              color:white;
              border:1px solid #263d59;
              border-radius:15px;
              text-align:left;
            "
          >
            <div style="
              color:#8fa5bf;
              font-size:12px;
            ">
              ${escapeHtml(
                jogo.league ||
                "Competição"
              )}

              •

              ${
                jogo.minute
                  ? `${jogo.minute}'`
                  : escapeHtml(
                      jogo.status ||
                      ""
                    )
              }
            </div>

            <div style="
              display:flex;
              justify-content:space-between;
              align-items:center;
              gap:8px;
              margin-top:7px;
              font-size:16px;
              font-weight:700;
            ">
              <span>
                ${escapeHtml(
                  jogo.homeTeam
                )}
              </span>

              <strong>
                ${jogo.homeGoals}
                ×
                ${jogo.awayGoals}
              </strong>

              <span style="
                text-align:right;
              ">
                ${escapeHtml(
                  jogo.awayTeam
                )}
              </span>
            </div>
          </button>
        `
      )
      .join("");
}

/* =====================================================
   ESTATÍSTICAS AO VIVO
===================================================== */

async function carregarEstatisticas(
  fixtureId
) {
  if (!fixtureId) return;

  const chave =
    String(fixtureId);

  const cache =
    statsCache.get(chave);

  if (
    cache &&
    Date.now() - cache.timestamp <
      STATS_CACHE_MS
  ) {
    aplicarEstatisticas(
      cache.data
    );

    return;
  }

  try {
    const resposta =
      await fetch(
        `/api/estatisticas?id=${encodeURIComponent(fixtureId)}`,
        {
          cache: "no-store"
        }
      );

    let dados = null;

    try {
      dados =
        await resposta.json();
    } catch (_) {}

    if (!resposta.ok) {
      if (
        resposta.status === 429
      ) {
        atualizarStatusApi(
          "limite",
          "Estatísticas pausadas porque a cota diária foi atingida."
        );

        return;
      }

      throw new Error(
        dados?.erro ||
        mensagemErroHttp(
          resposta.status
        )
      );
    }

    statsCache.set(
      chave,
      {
        timestamp:
          Date.now(),

        data: dados
      }
    );

    aplicarEstatisticas(
      dados
    );

  } catch (erro) {
    console.error(
      "Erro estatísticas:",
      erro
    );
  }
}

function aplicarEstatisticas(
  dados
) {
  setInput(
    "homeShots",
    dados?.homeShots ?? 0
  );

  setInput(
    "awayShots",
    dados?.awayShots ?? 0
  );

  setInput(
    "homeSot",
    dados?.homeSot ?? 0
  );

  setInput(
    "awaySot",
    dados?.awaySot ?? 0
  );

  setInput(
    "homeCorners",
    dados?.homeCorners ?? 0
  );

  setInput(
    "awayCorners",
    dados?.awayCorners ?? 0
  );

  analyze();
}

window.selecionarJogo =
async function(index) {
  const jogo =
    jogosDisponiveis[index];

  if (!jogo) return;

  jogoSelecionado =
    jogo;

  if ($("homeTeam")) {
    $("homeTeam").value =
      jogo.homeTeam || "Casa";
  }

  if ($("awayTeam")) {
    $("awayTeam").value =
      jogo.awayTeam ||
      "Visitante";
  }

  setInput(
    "minute",
    jogo.minute || 0
  );

  setInput(
    "homeGoals",
    jogo.homeGoals ?? 0
  );

  setInput(
    "awayGoals",
    jogo.awayGoals ?? 0
  );

  setInput("homeShots", 0);
  setInput("awayShots", 0);
  setInput("homeSot", 0);
  setInput("awaySot", 0);
  setInput("homeCorners", 0);
  setInput("awayCorners", 0);

  renderJogos();
  analyze();

  await carregarEstatisticas(
    jogo.fixtureId
  );
};

/* =====================================================
   CARREGAR JOGOS
===================================================== */

async function atualizarJogos(
  forcar = false
) {
  const agora =
    Date.now();

  if (buscandoJogos) return;

  if (
    !forcar &&
    jogosDisponiveis.length &&
    agora - ultimaAtualizacaoJogos <
      MIN_INTERVAL_LIVE
  ) {
    renderJogos();

    atualizarStatusApi(
      "ok",
      "Lista reaproveitada para economizar consultas.",
      null,
      true
    );

    return;
  }

  buscandoJogos = true;

  atualizarStatusApi(
    "carregando",
    "Buscando partidas..."
  );

  try {
    if ($("refreshBtn")) {
      $("refreshBtn").textContent =
        "Buscando...";

      $("refreshBtn").disabled =
        true;
    }

    const resposta =
      await fetch(
        "/api/jogos",
        {
          cache: "no-store"
        }
      );

    let dados = null;

    try {
      dados =
        await resposta.json();
    } catch (_) {}

    if (!resposta.ok) {
      if (
        resposta.status === 429
      ) {
        atualizarStatusApi(
          "limite",
          "A cota da API-Football terminou por hoje.",
          dados?.api || null
        );

        if ($("liveGamesList")) {
          $("liveGamesList").innerHTML = `
            <div style="
              color:#fca5a5;
              line-height:1.6;
            ">
              <b>
                Limite diário atingido.
              </b>

              <br>

              O aplicativo está preservando
              as requisições e não fará
              novas consultas automaticamente.
            </div>
          `;
        }

        return;
      }

      throw new Error(
        dados?.erro ||
        dados?.detalhe ||
        mensagemErroHttp(
          resposta.status
        )
      );
    }

    jogosDisponiveis =
      Array.isArray(
        dados?.jogos
      )
        ? dados.jogos
        : [];

    ultimaAtualizacaoJogos =
      Date.now();

    atualizarStatusApi(
      "ok",
      dados?.modo === "LIVE"
        ? "Partidas ao vivo carregadas."
        : "Jogos do dia carregados.",
      dados?.api || null,
      Boolean(dados?.cache)
    );

    renderJogos();

  } catch (erro) {
    console.error(
      "Erro jogos:",
      erro
    );

    atualizarStatusApi(
      "erro",
      erro.message ||
      "Erro ao carregar partidas."
    );

  } finally {
    buscandoJogos = false;

    if ($("refreshBtn")) {
      $("refreshBtn").textContent =
        "Atualizar";

      $("refreshBtn").disabled =
        false;
    }
  }
}

/* =====================================================
   PRÉ-LIVE
===================================================== */

function criarPainelPreLive() {
  if ($("preLiveBox")) return;

  const box =
    document.createElement(
      "section"
    );

  box.id =
    "preLiveBox";

  box.style.cssText = `
    display:none;
    margin:20px auto;
    padding:18px;
    max-width:1100px;
    background:#0d1b2d;
    border:1px solid #29415f;
    border-radius:22px;
  `;

  box.innerHTML = `
    <div style="
      display:flex;
      justify-content:space-between;
      align-items:center;
      margin-bottom:15px;
    ">
      <div>
        <div style="
          color:#55a7ff;
          font-size:13px;
          font-weight:800;
        ">
          ANÁLISE PRÉ-JOGO
        </div>

        <div style="
          color:white;
          font-size:24px;
          font-weight:800;
        ">
          📊 PRÉ-LIVE
        </div>
      </div>

      <span
        id="preLiveCount"
        style="color:#9eb0c7;"
      >
        0 jogos
      </span>
    </div>

    <div id="preLiveList">
      <div style="
        color:#9eb0c7;
      ">
        Aguardando carregamento.
      </div>
    </div>
  `;

  const live =
    $("liveGamesBox");

  if (live?.parentNode) {
    live.parentNode.insertBefore(
      box,
      live.nextSibling
    );
  } else {
    document.body.appendChild(box);
  }
}

function renderPreLive() {
  criarPainelPreLive();

  const lista =
    $("preLiveList");

  if (!lista) return;

  if ($("preLiveCount")) {
    $("preLiveCount").textContent =
      `${jogosPreLive.length} jogo${
        jogosPreLive.length === 1
          ? ""
          : "s"
      }`;
  }

  if (!jogosPreLive.length) {
    lista.innerHTML = `
      <div style="
        color:#9eb0c7;
      ">
        Nenhuma partida pré-live carregada.
      </div>
    `;

    return;
  }

  lista.innerHTML =
    jogosPreLive
      .map(
        (jogo, index) => `
          <div style="
            background:#091625;
            border:1px solid #263d59;
            border-radius:16px;
            padding:15px;
            margin-bottom:13px;
          ">
            <div style="
              color:#8fa5bf;
              font-size:12px;
            ">
              ${escapeHtml(
                jogo.league ||
                "Competição"
              )}

              •

              ${escapeHtml(
                jogo.country ||
                ""
              )}
            </div>

            <div style="
              display:flex;
              justify-content:space-between;
              gap:8px;
              margin-top:9px;
              color:white;
              font-size:17px;
              font-weight:800;
            ">
              <span>
                ${escapeHtml(
                  jogo.homeTeam
                )}
              </span>

              <span>×</span>

              <span style="
                text-align:right;
              ">
                ${escapeHtml(
                  jogo.awayTeam
                )}
              </span>
            </div>

            <button
              onclick="
                analisarPreLive(
                  ${index}
                )
              "
              style="
                width:100%;
                margin-top:13px;
                padding:12px;
                border:0;
                border-radius:12px;
                background:#2d8cff;
                color:white;
                font-weight:800;
              "
            >
              Analisar pré-jogo
            </button>

            <div
              id="analise-${jogo.fixtureId}"
            ></div>
          </div>
        `
      )
      .join("");
}

/* =====================================================
   CARREGAR PRÉ-LIVE
===================================================== */

async function carregarPreLive(
  forcar = false
) {
  const agora =
    Date.now();

  if (buscandoPreLive) return;

  if (
    !forcar &&
    jogosPreLive.length &&
    agora - ultimaAtualizacaoPreLive <
      MIN_INTERVAL_PRELIVE
  ) {
    renderPreLive();

    atualizarStatusApi(
      "ok",
      "PRÉ-LIVE reaproveitado do cache.",
      null,
      true
    );

    return;
  }

  buscandoPreLive =
    true;

  atualizarStatusApi(
    "carregando",
    "Buscando jogos pré-live..."
  );

  try {
    if ($("preLiveList")) {
      $("preLiveList").innerHTML = `
        <div style="
          color:#9eb0c7;
        ">
          Buscando jogos pré-live...
        </div>
      `;
    }

    const resposta =
      await fetch(
        "/api/prelive",
        {
          cache: "no-store"
        }
      );

    let dados = null;

    try {
      dados =
        await resposta.json();
    } catch (_) {}

    if (!resposta.ok) {
      if (
        resposta.status === 429
      ) {
        atualizarStatusApi(
          "limite",
          "PRÉ-LIVE pausado porque a cota diária terminou."
        );

        throw new Error(
          "Limite diário da API atingido."
        );
      }

      throw new Error(
        dados?.erro ||
        dados?.detalhe ||
        mensagemErroHttp(
          resposta.status
        )
      );
    }

    jogosPreLive =
      Array.isArray(
        dados?.jogos
      )
        ? dados.jogos
        : [];

    ultimaAtualizacaoPreLive =
      Date.now();

    atualizarStatusApi(
      "ok",
      "Jogos pré-live carregados.",
      dados?.api || null,
      Boolean(dados?.cache)
    );

    renderPreLive();

  } catch (erro) {
    console.error(
      "Erro pré-live:",
      erro
    );

    if ($("preLiveList")) {
      $("preLiveList").innerHTML = `
        <div style="
          color:#fca5a5;
          line-height:1.5;
        ">
          ${escapeHtml(
            erro.message
          )}
        </div>
      `;
    }

  } finally {
    buscandoPreLive =
      false;
  }
}

/* =====================================================
   ANÁLISE PRÉ-LIVE
===================================================== */

async function buscarAnaliseCompleta(
  fixtureId
) {
  const chave =
    String(fixtureId);

  if (
    analiseCache.has(chave)
  ) {
    return analiseCache.get(
      chave
    );
  }

  const resposta =
    await fetch(
      `/api/analise-prelive?id=${encodeURIComponent(fixtureId)}`,
      {
        cache: "no-store"
      }
    );

  let dados = null;

  try {
    dados =
      await resposta.json();
  } catch (_) {}

  if (!resposta.ok) {
    if (
      resposta.status === 429
    ) {
      atualizarStatusApi(
        "limite",
        "Análises pausadas porque a cota diária terminou."
      );

      throw new Error(
        "Limite diário da API atingido."
      );
    }

    throw new Error(
      typeof dados?.detalhe === "string"
        ? dados.detalhe
        : dados?.erro ||
          mensagemErroHttp(
            resposta.status
          )
    );
  }

  analiseCache.set(
    chave,
    dados
  );

  return dados;
}

window.analisarPreLive =
async function(index) {
  const jogo =
    jogosPreLive[index];

  if (!jogo) return;

  const container =
    $(
      `analise-${jogo.fixtureId}`
    );

  if (!container) return;

  container.innerHTML = `
    <div style="
      color:#9eb0c7;
      padding:10px 0;
    ">
      Analisando partida...
    </div>
  `;

  try {
    const analise =
      await buscarAnaliseCompleta(
        jogo.fixtureId
      );

    const mercados =
      Array.isArray(
        analise?.mercados
      )
        ? analise.mercados
        : [];

    container.innerHTML = `
      <div style="
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:7px;
        margin-top:12px;
      ">
        ${cardProb(
          "Casa",
          analise?.probabilidades?.casa
        )}

        ${cardProb(
          "Empate",
          analise?.probabilidades?.empate
        )}

        ${cardProb(
          "Visitante",
          analise?.probabilidades?.visitante
        )}
      </div>

      <div style="
        margin-top:13px;
        color:#dbe7f4;
        line-height:1.7;
      ">
        <b>Over 1.5:</b>
        ${analise?.probabilidades?.over15 ?? 0}%

        <br>

        <b>Over 2.5:</b>
        ${analise?.probabilidades?.over25 ?? 0}%

        <br>

        <b>Ambas marcam:</b>
        ${analise?.probabilidades?.btts ?? 0}%

        ${
          analise?.prediction?.winner
            ? `
              <br>
              <b>Favorito:</b>
              ${escapeHtml(
                analise.prediction.winner
              )}
            `
            : ""
        }
      </div>

      <div style="
        margin-top:14px;
      ">
        ${
          mercados.length
            ? mercados
                .slice(0, 6)
                .map(
                  mercado =>
                    cardMercado(
                      mercado
                    )
                )
                .join("")
            : `
              <div style="
                color:#9eb0c7;
              ">
                Nenhum mercado disponível.
              </div>
            `
        }
      </div>
    `;

  } catch (erro) {
    container.innerHTML = `
      <div style="
        color:#fca5a5;
        padding:12px 0;
        line-height:1.5;
      ">
        <b>
          Não foi possível analisar.
        </b>

        <br>

        ${escapeHtml(
          erro.message ||
          "Erro desconhecido"
        )}
      </div>
    `;
  }
};

function cardProb(
  nome,
  valor
) {
  return `
    <div style="
      background:#102135;
      padding:10px;
      border-radius:12px;
      text-align:center;
    ">
      <small style="
        color:#8fa5bf;
      ">
        ${escapeHtml(nome)}
      </small>

      <br>

      <b style="
        color:white;
      ">
        ${Number(valor || 0)}%
      </b>
    </div>
  `;
}

function cardMercado(
  mercado
) {
  let cor =
    "#8fa5bf";

  if (
    mercado.classificacao ===
    "VALOR FORTE"
  ) {
    cor = "#22c55e";
  } else if (
    mercado.classificacao ===
    "VALOR"
  ) {
    cor = "#4ade80";
  } else if (
    mercado.classificacao ===
    "NEUTRO"
  ) {
    cor = "#f59e0b";
  } else if (
    mercado.classificacao ===
    "EVITAR"
  ) {
    cor = "#ef4444";
  }

  return `
    <div style="
      background:#081421;
      padding:11px;
      border-radius:12px;
      margin-bottom:7px;
    ">
      <b style="
        color:white;
      ">
        ${escapeHtml(
          mercado.mercado
        )}
      </b>

      <br>

      <span style="
        color:#9eb0c7;
        font-size:13px;
      ">
        Probabilidade:
        ${Number(
          mercado.probabilidade || 0
        )}%

        ${
          mercado.odd
            ? `• Odd ${Number(mercado.odd).toFixed(2)}`
            : "• Sem odd"
        }

        ${
          mercado.value !== null &&
          mercado.value !== undefined
            ? `• Valor ${mercado.value > 0 ? "+" : ""}${mercado.value}%`
            : ""
        }
      </span>

      <br>

      <strong style="
        color:${cor};
      ">
        ${escapeHtml(
          mercado.classificacao ||
          ""
        )}
      </strong>
    </div>
  `;
}

/* =====================================================
   EVENTOS
===================================================== */

$("clearTicket")
  ?.addEventListener(
    "click",
    () => {
      ticket = [];
      renderTicket();
    }
  );

$("analyzeBtn")
  ?.addEventListener(
    "click",
    analyze
  );

$("refreshBtn")
  ?.addEventListener(
    "click",
    () => {
      /*
        Forçar atualização ainda respeita
        o cache do backend.
      */

      if (
        modoAtual === "prelive"
      ) {
        carregarPreLive(true);
      } else {
        atualizarJogos(true);
      }
    }
  );

ids.forEach(
  id => {
    $(id)
      ?.addEventListener(
        "change",
        renderBuilder
      );
  }
);

/* =====================================================
   INICIALIZAÇÃO
===================================================== */

criarMenuModos();
criarStatusApi();
criarPainelJogos();
criarPainelPreLive();

renderBuilder();
renderTicket();
analyze();

atualizarStatusApi(
  "ok",
  "Aplicativo iniciado. Aguardando dados.",
  null,
  true
);

/*
  Faz somente UMA consulta automática
  na abertura do aplicativo.
*/

window.addEventListener(
  "load",
  () => {
    atualizarJogos(false);
  }
);