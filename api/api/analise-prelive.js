export default async function handler(req, res) {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;
    const fixtureId = req.query.id;

    if (!apiKey) {
      return res.status(500).json({
        erro: "API_FOOTBALL_KEY não configurada"
      });
    }

    if (!fixtureId) {
      return res.status(400).json({
        erro: "Fixture ID não informado"
      });
    }

    const headers = {
      "x-apisports-key": apiKey
    };

    async function consultar(url) {
      try {
        const r = await fetch(url, { headers });

        const dados = await r.json();

        if (!r.ok) {
          return null;
        }

        return dados;
      } catch (e) {
        return null;
      }
    }

    /*
      ========================================
      1. DADOS DA PARTIDA
      ========================================
    */

    const fixtureDados = await consultar(
      `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`
    );

    const fixture =
      fixtureDados?.response?.[0] || null;

    if (!fixture) {
      return res.status(404).json({
        erro: "Partida não encontrada"
      });
    }

    const homeId =
      fixture.teams?.home?.id;

    const awayId =
      fixture.teams?.away?.id;

    const leagueId =
      fixture.league?.id;

    const season =
      fixture.league?.season;

    /*
      ========================================
      2. PREDICTIONS
      ========================================
    */

    const predictionDados =
      await consultar(
        `https://v3.football.api-sports.io/predictions?fixture=${fixtureId}`
      );

    const prediction =
      predictionDados?.response?.[0] || null;

    /*
      ========================================
      3. ODDS
      ========================================
    */

    const oddsDados =
      await consultar(
        `https://v3.football.api-sports.io/odds?fixture=${fixtureId}`
      );

    /*
      ========================================
      4. FORMA / ESTATÍSTICAS DA TEMPORADA
      ========================================
    */

    let homeStats = null;
    let awayStats = null;

    if (
      homeId &&
      leagueId &&
      season
    ) {
      const d =
        await consultar(
          `https://v3.football.api-sports.io/teams/statistics?league=${leagueId}&season=${season}&team=${homeId}`
        );

      homeStats =
        d?.response || null;
    }

    if (
      awayId &&
      leagueId &&
      season
    ) {
      const d =
        await consultar(
          `https://v3.football.api-sports.io/teams/statistics?league=${leagueId}&season=${season}&team=${awayId}`
        );

      awayStats =
        d?.response || null;
    }

    /*
      ========================================
      5. HISTÓRICO H2H
      ========================================
    */

    let h2h = [];

    if (homeId && awayId) {
      const d =
        await consultar(
          `https://v3.football.api-sports.io/fixtures/headtohead?h2h=${homeId}-${awayId}&last=5`
        );

      h2h =
        Array.isArray(d?.response)
          ? d.response
          : [];
    }

    /*
      ========================================
      FUNÇÕES AUXILIARES
      ========================================
    */

    function numero(v) {
      const x = Number(v);

      return Number.isFinite(x)
        ? x
        : 0;
    }

    function percentual(v) {
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

      return numero(v);
    }

    function mediaGols(stats) {
      const feitos =
        numero(
          stats?.goals?.for?.average?.total
        );

      const sofridos =
        numero(
          stats?.goals?.against?.average?.total
        );

      return {
        feitos,
        sofridos
      };
    }

    function formaScore(stats) {
      const forma =
        String(
          stats?.form || ""
        )
          .toUpperCase()
          .slice(-5);

      if (!forma) {
        return 50;
      }

      let pontos = 0;
      let jogos = 0;

      for (
        const resultado of forma
      ) {
        if (
          !["W","D","L"].includes(resultado)
        ) {
          continue;
        }

        jogos++;

        if (resultado === "W") {
          pontos += 3;
        }

        if (resultado === "D") {
          pontos += 1;
        }
      }

      if (!jogos) {
        return 50;
      }

      return (
        pontos /
        (jogos * 3)
      ) * 100;
    }

    function h2hScore() {
      if (!h2h.length) {
        return {
          home: 50,
          away: 50
        };
      }

      let home = 0;
      let away = 0;

      for (const jogo of h2h) {
        const hg =
          numero(jogo.goals?.home);

        const ag =
          numero(jogo.goals?.away);

        const casaId =
          jogo.teams?.home?.id;

        if (hg === ag) {
          home += 1;
          away += 1;
        } else if (
          (
            hg > ag &&
            casaId === homeId
          ) ||
          (
            ag > hg &&
            casaId !== homeId
          )
        ) {
          home += 3;
        } else {
          away += 3;
        }
      }

      const total =
        home + away;

      if (!total) {
        return {
          home: 50,
          away: 50
        };
      }

      return {
        home:
          (home / total) * 100,

        away:
          (away / total) * 100
      };
    }

    /*
      ========================================
      ODDS
      ========================================
    */

    const registroOdds =
      oddsDados?.response?.[0];

    const bookmakers =
      registroOdds?.bookmakers || [];

    function procurarMercado(
      nomes
    ) {
      for (
        const bookmaker of bookmakers
      ) {
        for (
          const bet of bookmaker.bets || []
        ) {
          const nome =
            String(
              bet.name || ""
            ).toLowerCase();

          if (
            nomes.some(n =>
              nome.includes(
                n.toLowerCase()
              )
            )
          ) {
            return {
              bookmaker:
                bookmaker.name || "",

              values:
                bet.values || []
            };
          }
        }
      }

      return null;
    }

    function valorOdd(
      mercado,
      valores
    ) {
      if (!mercado) {
        return null;
      }

      for (
        const item of
        mercado.values || []
      ) {
        const nome =
          String(
            item.value || ""
          ).toLowerCase();

        if (
          valores.some(v =>
            nome ===
            v.toLowerCase()
          )
        ) {
          const odd =
            Number(item.odd);

          return odd > 1
            ? odd
            : null;
        }
      }

      return null;
    }

    const mercado1x2 =
      procurarMercado([
        "Match Winner",
        "Winner"
      ]);

    const mercadoGols =
      procurarMercado([
        "Goals Over/Under",
        "Over/Under"
      ]);

    const mercadoBtts =
      procurarMercado([
        "Both Teams Score",
        "Both Teams To Score"
      ]);

    const mercadoDupla =
      procurarMercado([
        "Double Chance"
      ]);

    const odds = {
      bookmaker:
        mercado1x2?.bookmaker ||
        mercadoGols?.bookmaker ||
        mercadoBtts?.bookmaker ||
        "",

      casa:
        valorOdd(
          mercado1x2,
          ["Home"]
        ),

      empate:
        valorOdd(
          mercado1x2,
          ["Draw"]
        ),

      visitante:
        valorOdd(
          mercado1x2,
          ["Away"]
        ),

      over15:
        valorOdd(
          mercadoGols,
          ["Over 1.5"]
        ),

      over25:
        valorOdd(
          mercadoGols,
          ["Over 2.5"]
        ),

      over35:
        valorOdd(
          mercadoGols,
          ["Over 3.5"]
        ),

      bttsSim:
        valorOdd(
          mercadoBtts,
          ["Yes"]
        ),

      bttsNao:
        valorOdd(
          mercadoBtts,
          ["No"]
        ),

      casaEmpate:
        valorOdd(
          mercadoDupla,
          ["Home/Draw","1X"]
        ),

      empateVisitante:
        valorOdd(
          mercadoDupla,
          ["Draw/Away","X2"]
        )
    };

    /*
      ========================================
      CÁLCULO DA ANÁLISE
      ========================================
    */

    const pred =
      prediction?.predictions;

    const predHome =
      percentual(
        pred?.percent?.home
      );

    const predDraw =
      percentual(
        pred?.percent?.draw
      );

    const predAway =
      percentual(
        pred?.percent?.away
      );

    const formaHome =
      formaScore(homeStats);

    const formaAway =
      formaScore(awayStats);

    const golsHome =
      mediaGols(homeStats);

    const golsAway =
      mediaGols(awayStats);

    const h2hCalc =
      h2hScore();

    let scoreCasa =
      predHome * 0.55 +
      formaHome * 0.25 +
      h2hCalc.home * 0.20;

    let scoreFora =
      predAway * 0.55 +
      formaAway * 0.25 +
      h2hCalc.away * 0.20;

    let scoreEmpate =
      predDraw;

    const soma =
      scoreCasa +
      scoreEmpate +
      scoreFora;

    if (soma > 0) {
      scoreCasa =
        scoreCasa / soma * 100;

      scoreEmpate =
        scoreEmpate / soma * 100;

      scoreFora =
        scoreFora / soma * 100;
    }

    const mediaTotalGols =
      (
        golsHome.feitos +
        golsHome.sofridos +
        golsAway.feitos +
        golsAway.sofridos
      ) / 2;

    let probOver15 =
      Math.min(
        92,
        Math.max(
          35,
          45 +
          mediaTotalGols * 15
        )
      );

    let probOver25 =
      Math.min(
        88,
        Math.max(
          20,
          25 +
          mediaTotalGols * 17
        )
      );

    let probBtts =
      Math.min(
        85,
        Math.max(
          20,
          (
            golsHome.feitos +
            golsAway.feitos +
            golsHome.sofridos +
            golsAway.sofridos
          ) * 12
        )
      );

    /*
      ========================================
      VALUE
      ========================================
    */

    function value(prob, odd) {
      if (!odd || odd <= 1) {
        return null;
      }

      return (
        prob -
        100 / odd
      );
    }

    function classificar(v) {
      if (v === null) {
        return "SEM ODD";
      }

      if (v >= 8) {
        return "VALOR FORTE";
      }

      if (v >= 3) {
        return "VALOR";
      }

      if (v >= -3) {
        return "NEUTRO";
      }

      return "EVITAR";
    }

    const mercados = [
      {
        mercado: "Casa vence",
        probabilidade:
          scoreCasa,
        odd:
          odds.casa,
        value:
          value(
            scoreCasa,
            odds.casa
          )
      },

      {
        mercado: "Empate",
        probabilidade:
          scoreEmpate,
        odd:
          odds.empate,
        value:
          value(
            scoreEmpate,
            odds.empate
          )
      },

      {
        mercado: "Visitante vence",
        probabilidade:
          scoreFora,
        odd:
          odds.visitante,
        value:
          value(
            scoreFora,
            odds.visitante
          )
      },

      {
        mercado: "Mais de 1.5 gols",
        probabilidade:
          probOver15,
        odd:
          odds.over15,
        value:
          value(
            probOver15,
            odds.over15
          )
      },

      {
        mercado: "Mais de 2.5 gols",
        probabilidade:
          probOver25,
        odd:
          odds.over25,
        value:
          value(
            probOver25,
            odds.over25
          )
      },

      {
        mercado:
          "Ambas marcam - Sim",
        probabilidade:
          probBtts,
        odd:
          odds.bttsSim,
        value:
          value(
            probBtts,
            odds.bttsSim
          )
      },

      {
        mercado:
          "Casa ou empate",

        probabilidade:
          Math.min(
            95,
            scoreCasa +
            scoreEmpate
          ),

        odd:
          odds.casaEmpate
      },

      {
        mercado:
          "Empate ou visitante",

        probabilidade:
          Math.min(
            95,
            scoreEmpate +
            scoreFora
          ),

        odd:
          odds.empateVisitante
      }
    ];

    mercados.forEach(m => {
      if (
        m.value === undefined
      ) {
        m.value =
          value(
            m.probabilidade,
            m.odd
          );
      }

      m.classificacao =
        classificar(m.value);

      m.probabilidade =
        Math.round(
          m.probabilidade
        );

      if (
        m.value !== null
      ) {
        m.value =
          Number(
            m.value.toFixed(1)
          );
      }
    });

    mercados.sort(
      (a, b) =>
        (b.value ?? -999) -
        (a.value ?? -999)
    );

    return res.status(200).json({
      fixtureId,

      partida: {
        home:
          fixture.teams?.home?.name,

        away:
          fixture.teams?.away?.name,

        league:
          fixture.league?.name,

        country:
          fixture.league?.country,

        kickoff:
          fixture.fixture?.date
      },

      forma: {
        home: Math.round(
          formaHome
        ),

        away: Math.round(
          formaAway
        )
      },

      gols: {
        homeMarcados:
          golsHome.feitos,

        homeSofridos:
          golsHome.sofridos,

        awayMarcados:
          golsAway.feitos,

        awaySofridos:
          golsAway.sofridos
      },

      h2h: {
        jogos:
          h2h.length,

        home:
          Math.round(
            h2hCalc.home
          ),

        away:
          Math.round(
            h2hCalc.away
          )
      },

      probabilidades: {
        casa:
          Math.round(
            scoreCasa
          ),

        empate:
          Math.round(
            scoreEmpate
          ),

        visitante:
          Math.round(
            scoreFora
          ),

        over15:
          Math.round(
            probOver15
          ),

        over25:
          Math.round(
            probOver25
          ),

        btts:
          Math.round(
            probBtts
          )
      },

      prediction: {
        winner:
          pred?.winner?.name || "",

        advice:
          pred?.advice || "",

        underOver:
          pred?.under_over || ""
      },

      odds,

      mercados
    });

  } catch (erro) {
    console.error(
      "Erro análise pré-live:",
      erro
    );

    return res.status(500).json({
      erro:
        "Erro ao gerar análise pré-live",

      detalhe:
        erro.message
    });
  }
}