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

function n(id) {
  const el = $(id);
  return Number(el?.value || 0);
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

  const totalGoals =
    n("homeGoals") + n("awayGoals");

  const shots =
    n("homeShots") + n("awayShots");

  const sot =
    n("homeSot") + n("awaySot");

  const corners =
    n("homeCorners") + n("awayCorners");

  const danger =
    n("homeDanger") + n("awayDanger");

  const pace = clamp(
    (shots / minute) * 160
  );

  const targetRate = shots
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

  const projectedCorners =
    corners / minute * 90;

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

  const awayStrength =
    100 - homeStrength;

  return {
    minute,
    totalGoals,
    shots,
    sot,
    corners,
    danger,
    pace,
    targetRate,
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
  if (score >= 72)
    return ["BOA", "good"];

  if (score >= 55)
    return ["AGUARDE", "wait"];

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

  const oddNumber =
    Number(odd || 0);

  return `
    <div class="signal ${cls}">
      <div class="top">
        <div>
          <div class="market">
            ${name}
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

  const signals = [
    signalCard(
      "Mais de 2.5 gols",
      m.over25,
      `Pressão ofensiva ${pct(
        m.goalPressure
      )}, ${m.sot} finalizações no alvo e ${
        m.totalGoals
      } gols até ${m.minute}'.`,
      n("oddOver25"),
      "over25"
    ),

    signalCard(
      "Ambas marcam",
      m.btts,
      `${home}: ${n(
        "homeSot"
      )} no alvo. ${away}: ${n(
        "awaySot"
      )} no alvo. Intensidade combinada ${pct(
        m.goalPressure
      )}.`,
      n("oddBtts"),
      "btts"
    ),

    signalCard(
      "Mais de 8.5 escanteios",
      m.cornerIndex,
      `Já saíram ${
        m.corners
      } escanteios; projeção aproximada de ${
        m.projectedCorners.toFixed(1)
      } até 90'.`,
      n("oddCorners"),
      "corners"
    ),

    signalCard(
      `${home} vence`,
      m.homeStrength,
      "Força relativa calculada por placar, chutes no alvo e ataques perigosos.",
      n("oddHome"),
      "home"
    ),

    signalCard(
      "Empate",
      clamp(
        100 -
        Math.abs(
          m.homeStrength - 50
        ) * 2 -
        Math.abs(
          n("homeGoals") -
          n("awayGoals")
        ) * 18
      ),
      "Quanto mais equilibrados placar e pressão, maior o índice de empate.",
      n("oddDraw"),
      "draw"
    ),

    signalCard(
      `${away} vence`,
      m.awayStrength,
      "Força relativa calculada por placar, chutes no alvo e ataques perigosos.",
      n("oddAway"),
      "away"
    )
  ];

  if ($("signals")) {
    $("signals").innerHTML =
      signals.join("");
  }

  const leader =
    m.homeStrength > 57
      ? home
      : m.awayStrength > 57
      ? away
      : "partida equilibrada";

  if ($("analysisText")) {
    $("analysisText").innerHTML = `
      <b>Ritmo:</b>
      ${pct(
        m.goalPressure
      )} de pressão ofensiva estimada.
      <br>

      <b>Gols:</b>
      índice de Over 2.5 em
      ${pct(m.over25)}
      e BTTS em
      ${pct(m.btts)}.
      <br>

      <b>Escanteios:</b>
      ${m.corners} até agora,
      projeção de
      ${m.projectedCorners.toFixed(1)}.
      <br>

      <b>Resultado:</b>
      leitura atual favorece
      <b>${leader}</b>.
      <br><br>

      <span class="muted">
        Os índices são apoio de análise,
        não garantia de resultado.
      </span>
    `;
  }

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

  renderBuilder();
}

function renderBuilder() {
  const home =
    $("homeTeam")?.value.trim() ||
    "Casa";

  const away =
    $("awayTeam")?.value.trim() ||
    "Visitante";

  const markets = [
    [
      "home",
      `${home} vence`,
      n("oddHome")
    ],

    [
      "draw",
      "Empate",
      n("oddDraw")
    ],

    [
      "away",
      `${away} vence`,
      n("oddAway")
    ],

    [
      "over25",
      "Mais de 2.5 gols",
      n("oddOver25")
    ],

    [
      "btts",
      "Ambas marcam",
      n("oddBtts")
    ],

    [
      "corners",
      "Mais de 8.5 escanteios",
      n("oddCorners")
    ]
  ];

  if (!$("builderMarkets"))
    return;

  $("builderMarkets").innerHTML =
    markets
      .map(([key, name, odd]) => `
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
              '${name.replaceAll(
                "'",
                "\\'"
              )}',
              ${odd}
            )"
            ${
              odd <= 1
                ? "disabled"
                : ""
            }
          >
            +
          </button>

        </div>
      `)
      .join("");
}

window.addToTicket =
  function(key, name, odd) {
    if (!odd || odd <= 1)
      return;

    const exists =
      ticket.find(
        x => x.key === key
      );

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
      (a, x) =>
        a * x.odd,
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

function setInput(id, value) {
  const el = $(id);

  if (!el)
    return;

  el.value =
    value ?? 0;
}

function escolherJogo(
  jogos
) {
  if (!Array.isArray(jogos) ||
      !jogos.length) {
    return null;
  }

  const liveStatus = [
    "1H",
    "HT",
    "2H",
    "ET",
    "BT",
    "P",
    "INT",
    "LIVE"
  ];

  const aoVivo =
    jogos.find(j =>
      liveStatus.includes(
        j?.fixture?.status?.short
      )
    );

  if (aoVivo)
    return aoVivo;

  const agora =
    Date.now() / 1000;

  const proximos =
    jogos
      .filter(j =>
        Number(
          j?.fixture?.timestamp
        ) >= agora
      )
      .sort(
        (a, b) =>
          a.fixture.timestamp -
          b.fixture.timestamp
      );

  if (proximos.length)
    return proximos[0];

  return jogos[0];
}

async function atualizarJogos() {
  try {
    if ($("refreshBtn")) {
      $("refreshBtn").textContent =
        "Buscando...";
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

    const jogos =
      Array.isArray(
        dados.response
      )
        ? dados.response
        : [];

    const jogo =
      escolherJogo(jogos);

    if (!jogo) {
      throw new Error(
        "Nenhum jogo encontrado hoje."
      );
    }

    if ($("homeTeam")) {
      $("homeTeam").value =
        jogo?.teams?.home?.name ||
        "Casa";
    }

    if ($("awayTeam")) {
      $("awayTeam").value =
        jogo?.teams?.away?.name ||
        "Visitante";
    }

    setInput(
      "minute",
      jogo?.fixture?.status?.elapsed ??
      0
    );

    setInput(
      "homeGoals",
      jogo?.goals?.home ??
      0
    );

    setInput(
      "awayGoals",
      jogo?.goals?.away ??
      0
    );

    /*
      O endpoint /api/jogos atual
      ainda não fornece estatísticas
      detalhadas ou odds.

      Por isso esses campos ficam
      zerados até conectarmos os
      próximos endpoints.
    */

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

    setInput(
      "homeDanger",
      0
    );

    setInput(
      "awayDanger",
      0
    );

    if ($("modeLabel")) {
      $("modeLabel").textContent =
        "LIVE";
    }

    analyze();

  } catch (e) {
    console.error(e);

    alert(
      "Não foi possível atualizar os jogos: " +
      e.message
    );

  } finally {
    if ($("refreshBtn")) {
      $("refreshBtn").textContent =
        "Atualizar";
    }
  }
}

$("refreshBtn")
  ?.addEventListener(
    "click",
    atualizarJogos
  );

/*
  Mantemos a janela de configurações
  funcionando, mas o app agora usa
  automaticamente /api/jogos.
*/

$("settingsBtn")
  ?.addEventListener(
    "click",
    () => {
      if ($("apiUrl")) {
        $("apiUrl").value =
          "/api/jogos";
      }

      $("settingsDialog")
        ?.showModal();
    }
  );

$("saveSettings")
  ?.addEventListener(
    "click",
    () => {
      if ($("apiUrl")) {
        $("apiUrl").value =
          "/api/jogos";
      }

      if ($("modeLabel")) {
        $("modeLabel").textContent =
          "LIVE";
      }

      $("settingsDialog")
        ?.close();
    }
  );

ids.forEach(id => {
  $(id)
    ?.addEventListener(
      "change",
      renderBuilder
    );
});

if ("serviceWorker" in navigator) {
  window.addEventListener(
    "load",
    () => {
      navigator.serviceWorker
        .register("./sw.js")
        .catch(() => {});
    }
  );
}

if ($("modeLabel")) {
  $("modeLabel").textContent =
    "LIVE";
}

renderBuilder();
analyze(); 