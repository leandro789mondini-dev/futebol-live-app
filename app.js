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
  if (valor === null || valor === undefined) return 0;

  if (typeof valor === "string") {
    return Number(valor.replace("%", "")) || 0;
  }

  return Number(valor) || 0;
}

/* =========================================================
   MÉTRICAS AO VIVO
========================================================= */

function metrics() {
  const minute = Math.max(1, n("minute"));
  const totalGoals = n("homeGoals") + n("awayGoals");
  const shots = n("homeShots") + n("awayShots");
  const sot = n("homeSot") + n("awaySot");
  const corners = n("homeCorners") + n("awayCorners");
  const danger = n("homeDanger") + n("awayDanger");

  const pace = clamp(
    (shots / minute) * 160
  );

  const targetRate = shots
    ? (sot / shots) * 100
    : 0;

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

  const projectedCorners =
    corners / minute * 90;

  const cornerIndex = clamp(
    (projectedCorners / 10) * 75 +
    (danger / minute) * 12
  );

  const homeStrength = clamp(
    50 +
    (n("homeSot") - n("awaySot")) * 7 +
    (n("homeShots") - n("awayShots")) * 2 +
    (n("homeCorners") - n("awayCorners")) * 1.5 +
    (n("homeGoals") - n("awayGoals")) * 13
  );

  const awayStrength =
    100 - homeStrength;

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
  if (score >= 72) {
    return ["BOA", "good"];
  }

  if (score >= 55) {
    return ["AGUARDE", "wait"];
  }

  return ["EVITAR", "avoid"];
}

function signalCard(
  name,
  score,
  why,
  odd,
  key
) {
  const [label, cls] = status(score);
  const oddNumber = Number(odd || 0);

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

      <div class="why">
        ${why}
      </div>

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

  const home =
    $("homeTeam")?.value.trim() ||
    "Casa";

  const away =
    $("awayTeam")?.value.trim() ||
    "Visitante";

  const temEstatisticas =
    m.shots > 0 ||
    m.sot > 0 ||
    m.corners > 0;

  if (!temEstatisticas) {
    if ($("analysisText")) {
      $("analysisText").innerHTML = `
        <b>
          ${home}
          ${n("homeGoals")}
          x
          ${n("awayGoals")}
          ${away}
        </b>

        <br>

        Minuto:
        ${n("minute")}'

        <br><br>

        <span class="muted">
          Aguardando estatísticas detalhadas
          para gerar a análise ao vivo.
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

  const signals = [
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
      `${home}: ${n("homeSot")} no alvo. ${away}: ${n("awaySot")} no alvo.`,
      n("oddBtts"),
      "btts"
    ),

    signalCard(
      "Mais de 8.5 escanteios",
      m.cornerIndex,
      `${m.corners} escanteios. Projeção aproximada ${m.projectedCorners.toFixed(1)}.`,
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
        Math.abs(n("homeGoals") - n("awayGoals")) * 18
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
    $("signals").innerHTML = signals.join("");
  }

  const leader =
    m.homeStrength > 57
      ? home
      : m.awayStrength > 57
      ? away
      : "partida equilibrada";

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

      <b>Índice Over 2.5:</b>
      ${pct(m.over25)}
      <br>

      <b>Índice BTTS:</b>
      ${pct(m.btts)}
      <br>

      <b>Leitura atual:</b>
      ${leader}

      <br><br>

      <span class="muted">
        Indicadores são estimativas e não garantem resultado.
      </span>
    `;
  }

  renderBuilder();
  atualizarHorario();
}

function atualizarHorario() {
  if ($("lastUpdate")) {
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
}

/* =========================================================
   MÚLTIPLAS
========================================================= */

function renderBuilder() {
  const home =
    $("homeTeam")?.value.trim() ||
    "Casa";

  const away =
    $("awayTeam")?.value.trim() ||
    "Visitante";

  const markets = [
    ["home", `${home} vence`, n("oddHome")],
    ["draw", "Empate", n("oddDraw")],
    ["away", `${away} vence`, n("oddAway")],
    ["over25", "Mais de 2.5 gols", n("oddOver25")],
    ["btts", "Ambas marcam", n("oddBtts")],
    ["corners", "Mais de 8.5 escanteios", n("oddCorners")]
  ];

  if (!$("builderMarkets")) return;

  $("builderMarkets").innerHTML =
    markets.map(
      ([key, name, odd]) => `
        <div class="market-row">
          <span>
            ${name}
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
      `
    ).join("");
}

window.addToTicket =
  function(key, name, odd) {
    if (!odd || odd <= 1) return;

    const exists =
      ticket.find(x => x.key === key);

    if (!exists) {
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
      (a, x) => a * x.odd,
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

/* =========================================================
   CONTROLE DE MODOS
========================================================= */

function criarMenuModos() {
  if (
    document.getElementById(
      "modeSwitcher"
    )
  ) {
    return;
  }

  const box =
    document.createElement("div");

  box.id = "modeSwitcher";

  box.style.cssText = `
    max-width:1100px;
    margin:18px auto;
    padding:8px;
    display:flex;
    gap:8px;
    border-radius:18px;
    background:#081421;
    border:1px solid #29415f;
  `;

  box.innerHTML = `
    <button
      id="btnLiveMode"
      style="
        flex:1;
        border:0;
        border-radius:13px;
        padding:13px;
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
        border:0;
        border-radius:13px;
        padding:13px;
        font-weight:800;
        background:#102135;
        color:#a9bad0;
      "
    >
      📊 PRÉ-LIVE
    </button>
  `;

  const referencia =
    document.querySelector("main") ||
    document.body;

  referencia.prepend(box);

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

function mudarModo(modo) {
  modoAtual = modo;

  const liveBox =
    $("liveGamesBox");

  const preBox =
    $("preLiveBox");

  const dadosPartida =
    $("homeTeam")
      ?.closest("section");

  if (modo === "live") {
    if (liveBox) {
      liveBox.style.display =
        "block";
    }

    if (preBox) {
      preBox.style.display =
        "none";
    }

    if (dadosPartida) {
      dadosPartida.style.display =
        "";
    }

    if ($("btnLiveMode")) {
      $("btnLiveMode").style.background =
        "#2d8cff";

      $("btnLiveMode").style.color =
        "white";
    }

    if ($("btnPreLiveMode")) {
      $("btnPreLiveMode").style.background =
        "#102135";

      $("btnPreLiveMode").style.color =
        "#a9bad0";
    }

    if ($("modeLabel")) {
      $("modeLabel").textContent =
        "LIVE";
    }

    return;
  }

  if (liveBox) {
    liveBox.style.display =
      "none";
  }

  if (dadosPartida) {
    dadosPartida.style.display =
      "none";
  }

  criarPainelPreLive();

  if (preBox) {
    preBox.style.display =
      "block";
  }

  if ($("btnLiveMode")) {
    $("btnLiveMode").style.background =
      "#102135";

    $("btnLiveMode").style.color =
      "#a9bad0";
  }

  if ($("btnPreLiveMode")) {
    $("btnPreLiveMode").style.background =
      "#2d8cff";

    $("btnPreLiveMode").style.color =
      "white";
  }

  if ($("modeLabel")) {
    $("modeLabel").textContent =
      "PRÉ-LIVE";
  }

  carregarPreLive();
}

/* =========================================================
   JOGOS AO VIVO
========================================================= */

function criarPainelJogos() {
  if (
    document.getElementById(
      "liveGamesBox"
    )
  ) {
    return;
  }

  const box =
    document.createElement(
      "section"
    );

  box.id =
    "liveGamesBox";

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
      justify-content:space-between;
      align-items:center;
      margin-bottom:15px;
    ">
      <div>
        <div style="
          font-size:13px;
          color:#55a7ff;
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
        style="
          color:#9eb0c7;
        "
      >
        0 jogos
      </span>
    </div>

    <div id="liveGamesList">
      <div style="color:#9eb0c7;">
        Carregando...
      </div>
    </div>
  `;

  const referencia =
    $("homeTeam")?.closest(
      "section"
    ) ||
    $("homeTeam")
      ?.parentElement
      ?.parentElement
      ?.parentElement;

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

  const contador =
    $("liveGamesCount");

  if (!lista) return;

  if (contador) {
    contador.textContent =
      `${jogosDisponiveis.length} jogo${
        jogosDisponiveis.length === 1
          ? ""
          : "s"
      }`;
  }

  if (!jogosDisponiveis.length) {
    lista.innerHTML = `
      <div style="color:#9eb0c7;">
        Nenhuma partida encontrada.
      </div>
    `;

    return;
  }

  lista.innerHTML =
    jogosDisponiveis
      .map(
        (jogo, index) => {
          const selecionado =
            jogoSelecionado
              ?.fixtureId ===
            jogo.fixtureId;

          const minuto =
            jogo.minute
              ? `${jogo.minute}'`
              : jogo.status || "";

          return `
            <button
              onclick="selecionarJogo(${index})"

              style="
                width:100%;
                border:${
                  selecionado
                    ? "2px solid #36a3ff"
                    : "1px solid #263d59"
                };
                background:${
                  selecionado
                    ? "#142b45"
                    : "#091625"
                };
                color:white;
                border-radius:15px;
                padding:14px;
                margin-bottom:10px;
                text-align:left;
              "
            >
              <div style="
                color:#8fa5bf;
                font-size:12px;
                margin-bottom:7px;
              ">
                ${
                  jogo.league ||
                  "Competição"
                }

                ${
                  minuto
                    ? `• ${minuto}`
                    : ""
                }
              </div>

              <div style="
                display:flex;
                justify-content:space-between;
                align-items:center;
                gap:8px;
                font-size:16px;
                font-weight:700;
              ">
                <span>
                  ${jogo.homeTeam}
                </span>

                <strong>
                  ${jogo.homeGoals}
                  ×
                  ${jogo.awayGoals}
                </strong>

                <span style="text-align:right;">
                  ${jogo.awayTeam}
                </span>
              </div>
            </button>
          `;
        }
      )
      .join("");
}

async function carregarEstatisticas(
  fixtureId
) {
  if (!fixtureId) return;

  try {
    const r =
      await fetch(
        `/api/estatisticas?id=${fixtureId}`,
        {
          cache: "no-store"
        }
      );

    if (!r.ok) {
      throw new Error(
        "HTTP " + r.status
      );
    }

    const dados =
      await r.json();

    setInput(
      "homeShots",
      dados.homeShots ?? 0
    );

    setInput(
      "awayShots",
      dados.awayShots ?? 0
    );

    setInput(
      "homeSot",
      dados.homeSot ?? 0
    );

    setInput(
      "awaySot",
      dados.awaySot ?? 0
    );

    setInput(
      "homeCorners",
      dados.homeCorners ?? 0
    );

    setInput(
      "awayCorners",
      dados.awayCorners ?? 0
    );

    analyze();

  } catch (erro) {
    console.error(
      "Erro estatísticas:",
      erro
    );
  }
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
        jogo.homeTeam ||
        "Casa";
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

    setInput(
      "homeShots",
      0
    );

    setInput(
      "awayShots",
      0
    );

    setInput(
      "homeSot",
      0
    );

    setInput(
      "awaySot",
      0
    );

    setInput(
      "homeCorners",
      0
    );

    setInput(
      "awayCorners",
      0
    );

    renderJogos();

    analyze();

    await carregarEstatisticas(
      jogo.fixtureId
    );
  };

async function atualizarJogos() {
  try {
    if ($("refreshBtn")) {
      $("refreshBtn").textContent =
        "Buscando...";

      $("refreshBtn").disabled =
        true;
    }

    const r =
      await fetch(
        "/api/jogos",
        {
          cache: "no-store"
        }
      );

    if (!r.ok) {
      throw new Error(
        "HTTP " + r.status
      );
    }

    const dados =
      await r.json();

    jogosDisponiveis =
      Array.isArray(
        dados.jogos
      )
        ? dados.jogos
        : [];

    renderJogos();

    if (
      jogosDisponiveis.length
    ) {
      await selecionarJogo(0);
    }

  } catch (e) {
    console.error(e);

    alert(
      "Erro ao carregar jogos: " +
      e.message
    );

  } finally {
    if ($("refreshBtn")) {
      $("refreshBtn").textContent =
        "Atualizar";

      $("refreshBtn").disabled =
        false;
    }
  }
}

/* =========================================================
   PRÉ-LIVE
========================================================= */

function criarPainelPreLive() {
  if (
    document.getElementById(
      "preLiveBox"
    )
  ) {
    return;
  }

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
    border:1px solid #29415f;
    border-radius:22px;
    background:#0d1b2d;
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
      <div style="color:#9eb0c7;">
        Carregando análises...
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
    document.body.appendChild(
      box
    );
  }
}

function corPreLive(score) {
  if (score >= 65) {
    return "#22c55e";
  }

  if (score >= 45) {
    return "#f59e0b";
  }

  return "#ef4444";
}

function renderPreLive() {
  criarPainelPreLive();

  const lista =
    $("preLiveList");

  const contador =
    $("preLiveCount");

  if (!lista) return;

  if (contador) {
    contador.textContent =
      `${jogosPreLive.length} jogo${
        jogosPreLive.length === 1
          ? ""
          : "s"
      }`;
  }

  if (!jogosPreLive.length) {
    lista.innerHTML = `
      <div style="color:#9eb0c7;">
        Nenhum jogo pré-live encontrado.
      </div>
    `;

    return;
  }

  lista.innerHTML =
    jogosPreLive
      .map(
        (jogo) => {
          const p =
            jogo.prediction;

          const home =
            numeroPercentual(
              p?.percentHome
            );

          const draw =
            numeroPercentual(
              p?.percentDraw
            );

          const away =
            numeroPercentual(
              p?.percentAway
            );

          return `
            <div style="
              background:#091625;
              border:1px solid #263d59;
              border-radius:16px;
              padding:15px;
              margin-bottom:12px;
            ">

              <div style="
                color:#8fa5bf;
                font-size:12px;
                margin-bottom:8px;
              ">
                ${
                  jogo.league ||
                  "Competição"
                }
                •
                ${
                  jogo.country ||
                  ""
                }
              </div>

              <div style="
                display:flex;
                justify-content:space-between;
                gap:10px;
                color:white;
                font-weight:800;
                font-size:17px;
                margin-bottom:15px;
              ">
                <span>
                  ${jogo.homeTeam}
                </span>

                <span style="color:#8fa5bf;">
                  x
                </span>

                <span style="text-align:right;">
                  ${jogo.awayTeam}
                </span>
              </div>

              ${
                p
                  ? `
                    <div style="
                      display:grid;
                      grid-template-columns:1fr 1fr 1fr;
                      gap:8px;
                      margin-bottom:12px;
                    ">

                      <div style="
                        padding:10px;
                        border-radius:12px;
                        background:#102135;
                        text-align:center;
                      ">
                        <div style="
                          color:#8fa5bf;
                          font-size:12px;
                        ">
                          Casa
                        </div>

                        <b style="
                          color:${corPreLive(home)};
                          font-size:18px;
                        ">
                          ${home}%
                        </b>
                      </div>

                      <div style="
                        padding:10px;
                        border-radius:12px;
                        background:#102135;
                        text-align:center;
                      ">
                        <div style="
                          color:#8fa5bf;
                          font-size:12px;
                        ">
                          Empate
                        </div>

                        <b style="
                          color:${corPreLive(draw)};
                          font-size:18px;
                        ">
                          ${draw}%
                        </b>
                      </div>

                      <div style="
                        padding:10px;
                        border-radius:12px;
                        background:#102135;
                        text-align:center;
                      ">
                        <div style="
                          color:#8fa5bf;
                          font-size:12px;
                        ">
                          Visitante
                        </div>

                        <b style="
                          color:${corPreLive(away)};
                          font-size:18px;
                        ">
                          ${away}%
                        </b>
                      </div>

                    </div>

                    <div style="
                      color:#d9e3ef;
                      line-height:1.5;
                      font-size:14px;
                    ">

                      ${
                        p.winner
                          ? `<b>Favorito:</b> ${p.winner}<br>`
                          : ""
                      }

                      ${
                        p.underOver
                          ? `<b>Gols:</b> ${p.underOver}<br>`
                          : ""
                      }

                      ${
                        p.goalsHome ||
                        p.goalsAway
                          ? `
                            <b>Faixa de gols:</b>
                            ${p.goalsHome || "-"}
                            ×
                            ${p.goalsAway || "-"}
                            <br>
                          `
                          : ""
                      }

                      ${
                        p.advice
                          ? `
                            <b>Leitura:</b>
                            ${p.advice}
                          `
                          : ""
                      }

                    </div>
                  `
                  : `
                    <div style="
                      color:#9eb0c7;
                    ">
                      Prediction indisponível para esta partida.
                    </div>
                  `
              }

            </div>
          `;
        }
      )
      .join("");
}

async function carregarPreLive() {
  try {
    const lista =
      $("preLiveList");

    if (lista) {
      lista.innerHTML = `
        <div style="color:#9eb0c7;">
          Buscando análises pré-live...
        </div>
      `;
    }

    const r =
      await fetch(
        "/api/prelive",
        {
          cache: "no-store"
        }
      );

    if (!r.ok) {
      throw new Error(
        "HTTP " + r.status
      );
    }

    const dados =
      await r.json();

    jogosPreLive =
      Array.isArray(
        dados.jogos
      )
        ? dados.jogos
        : [];

    renderPreLive();

  } catch (erro) {
    console.error(
      "Erro PRÉ-LIVE:",
      erro
    );

    if ($("preLiveList")) {
      $("preLiveList").innerHTML = `
        <div style="color:#ef9a9a;">
          Não foi possível carregar o PRÉ-LIVE:
          ${erro.message}
        </div>
      `;
    }
  }
}

/* =========================================================
   EVENTOS
========================================================= */

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
      if (
        modoAtual ===
        "prelive"
      ) {
        carregarPreLive();
      } else {
        atualizarJogos();
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

if (
  "serviceWorker"
  in navigator
) {
  window.addEventListener(
    "load",
    () => {
      navigator
        .serviceWorker
        .register("./sw.js")
        .catch(() => {});
    }
  );
}

/* =========================================================
   INICIALIZAÇÃO
========================================================= */

criarMenuModos();
criarPainelJogos();
criarPainelPreLive();

renderBuilder();
analyze();

window.addEventListener(
  "load",
  () => {
    atualizarJogos();
  }
);