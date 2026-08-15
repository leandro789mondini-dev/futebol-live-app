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
        const resposta = await fetch(url, {
          headers
        });

        const dados = await resposta.json();

        if (!resposta.ok) {
          return null;
        }

        return dados;

      } catch (erro) {
        console.error("Erro ao consultar API:", erro);
        return null;
      }
    }

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

      if (typeof v === "string") {
        return (
          Number(
            v.replace("%", "")
          ) || 0
        );
      }

      return numero(v);
    }

    /*
      ==================================
      1. PARTIDA
      ==================================
    */

    const fixtureDados =
      await consultar(
        `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`
      );

    const fixture =
      fixtureDados?.response?.[0];

    if (!fixture) {
      return res.status(404).json({
        erro: "Partida não encontrada"
      });
    }

    /*
      ==================================
      2. PREDICTION
      ==================================
    */

    const predictionDados =
      await consultar(
        `https://v3.football.api-sports.io/predictions?fixture=${fixtureId}`
      );

    const prediction =
      predictionDados?.response?.[0] || null;

    /*
      ==================================
      3. ODDS
      ==================================
    */

    const oddsDados =
      await consultar(
        `https://v3.football.api-sports.io/odds?fixture=${fixtureId}`
      );

    const registroOdds =
      oddsDados?.response?.[0] || null;

    const bookmakers =
      registroOdds?.bookmakers || [];

    /*
      ==================================
      FUNÇÕES PARA ODDS
      ==================================
    */

    function procurarMercado(nomes) {
      for (const bookmaker of bookmakers) {
        const bets =
          Array.isArray(bookmaker.bets)
            ? bookmaker.bets
            : [];

        for (const bet of bets) {
          const nome =
            String(
              bet.name || ""
            ).toLowerCase();

          const encontrou =
            nomes.some(item =>
              nome.includes(
                item.toLowerCase()
              )
            );

          if (encontrou) {
            return {
              bookmaker:
                bookmaker.name || "",

              values:
                Array.isArray(bet.values)
                  ? bet.values
                  : []
            };
          }
        }
      }

      return null;
    }

    function buscarOdd(
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
          )
            .toLowerCase()
            .trim();

        const encontrou =
          valores.some(
            valor =>
              nome ===
              valor.toLowerCase().trim()
          );

        if (encontrou) {
          const odd =
            Number(item.odd);

          if (
            Number.isFinite(odd) &&
            odd > 1
          ) {
            return odd;
          }
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
        mercadoDupla?.bookmaker ||
        "",

      casa:
        buscarOdd(
          mercado1x2,
          ["Home"]
        ),

      empate:
        buscarOdd(
          mercado1x2,
          ["Draw"]
        ),

      visitante:
        buscarOdd(
          mercado1x2,
          ["Away"]
        ),

      over15:
        buscarOdd(
          mercadoGols,
          ["Over 1.5"]
        ),

      over25:
        buscarOdd(
          mercadoGols,
          ["Over 2.5"]
        ),

      over35:
        buscarOdd(
          mercadoGols,
          ["Over 3.5"]
        ),

      bttsSim:
        buscarOdd(
          mercadoBtts,
          ["Yes"]
        ),

      bttsNao:
        buscarOdd(
          mercadoBtts,
          ["No"]
        ),

      casaEmpate:
        buscarOdd(
          mercadoDupla,
          [
            "Home/Draw",
            "1X"
          ]
        ),

      empateVisitante:
        buscarOdd(
          mercadoDupla,
          [
            "Draw/Away",
            "X2"
          ]
        )
    };

    /*
      ==================================
      PROBABILIDADES DA PREDICTION
      ==================================
    */

    const pred =
      prediction?.predictions || {};

    let probCasa =
      percentual(
        pred?.percent?.home
      );

    let probEmpate =
      percentual(
        pred?.percent?.draw
      );

    let probVisitante =
      percentual(
        pred?.percent?.away
      );

    /*
      Se prediction não vier,
      evita inventar percentual.
    */

    const temProbResultado =
      probCasa > 0 ||
      probEmpate > 0 ||
      probVisitante > 0;

    /*
      ==================================
      GOLS
      ==================================
    */

    const goalsHome =
      pred?.goals?.home || null;

    const goalsAway =
      pred?.goals?.away || null;

    const underOver =
      String(
        pred?.under_over || ""
      );

    /*
      Probabilidades simples de gols.
      Só usamos quando há prediction.
    */

    let probOver15 = 0;
    let probOver25 = 0;
    let probBtts = 0;

    if (prediction) {
      /*
        Base conservadora.
        Não tratamos esses valores
        como probabilidades "reais".
      */

      probOver15 = 65;
      probOver25 = 52;
      probBtts = 50;

      const texto =
        underOver.toLowerCase();

      if (
        texto.includes("+1.5")
      ) {
        probOver15 = 75;
      }

      if (
        texto.includes("+2.5")
      ) {
        probOver25 = 67;
      }

      if (
        texto.includes("-2.5")
      ) {
        probOver25 = 38;
      }

      if (
        texto.includes("+3.5")
      ) {
        probOver25 = 78;
      }

      if (
        goalsHome &&
        goalsAway
      ) {
        /*
          Se a API sugere gols
          para os dois times,
          BTTS ganha força.
        */

        probBtts = 62;
      }
    }

    /*
      ==================================
      VALUE
      ==================================
    */

    function calcularValue(
      prob,
      odd
    ) {
      if (
        !odd ||
        odd <= 1 ||
        !prob
      ) {
        return null;
      }

      const implicita =
        100 / odd;

      return (
        prob - implicita
      );
    }

    function classificar(
      valor
    ) {
      if (
        valor === null ||
        valor === undefined
      ) {
        return "SEM ODD";
      }

      if (valor >= 8) {
        return "VALOR FORTE";
      }

      if (valor >= 3) {
        return "VALOR";
      }

      if (valor >= -3) {
        return "NEUTRO";
      }

      return "EVITAR";
    }

    function criarMercado(
      mercado,
      probabilidade,
      odd
    ) {
      const value =
        calcularValue(
          probabilidade,
          odd
        );

      return {
        mercado,

        probabilidade:
          Math.round(
            probabilidade || 0
          ),

        odd:
          odd || null,

        value:
          value === null
            ? null
            : Number(
                value.toFixed(1)
              ),

        classificacao:
          classificar(value)
      };
    }

    const mercados = [];

    if (temProbResultado) {
      mercados.push(
        criarMercado(
          "Casa vence",
          probCasa,
          odds.casa
        )
      );

      mercados.push(
        criarMercado(
          "Empate",
          probEmpate,
          odds.empate
        )
      );

      mercados.push(
        criarMercado(
          "Visitante vence",
          probVisitante,
          odds.visitante
        )
      );

      mercados.push(
        criarMercado(
          "Casa ou empate",
          Math.min(
            95,
            probCasa +
            probEmpate
          ),
          odds.casaEmpate
        )
      );

      mercados.push(
        criarMercado(
          "Empate ou visitante",
          Math.min(
            95,
            probEmpate +
            probVisitante
          ),
          odds.empateVisitante
        )
      );
    }

    if (probOver15 > 0) {
      mercados.push(
        criarMercado(
          "Mais de 1.5 gols",
          probOver15,
          odds.over15
        )
      );
    }

    if (probOver25 > 0) {
      mercados.push(
        criarMercado(
          "Mais de 2.5 gols",
          probOver25,
          odds.over25
        )
      );
    }

    if (probBtts > 0) {
      mercados.push(
        criarMercado(
          "Ambas marcam - Sim",
          probBtts,
          odds.bttsSim
        )
      );
    }

    /*
      Ordena:
      mercados com maior value primeiro
    */

    mercados.sort(
      (a, b) =>
        (b.value ?? -999) -
        (a.value ?? -999)
    );

    /*
      ==================================
      RESPOSTA
      ==================================
    */

    return res.status(200).json({
      fixtureId,

      partida: {
        home:
          fixture.teams?.home?.name ||
          "Casa",

        away:
          fixture.teams?.away?.name ||
          "Visitante",

        league:
          fixture.league?.name ||
          "",

        country:
          fixture.league?.country ||
          "",

        kickoff:
          fixture.fixture?.date ||
          ""
      },

      probabilidades: {
        casa:
          Math.round(probCasa),

        empate:
          Math.round(probEmpate),

        visitante:
          Math.round(
            probVisitante
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
        disponivel:
          Boolean(prediction),

        winner:
          pred?.winner?.name ||
          "",

        winnerComment:
          pred?.winner?.comment ||
          "",

        advice:
          pred?.advice ||
          "",

        underOver,

        goalsHome,
        goalsAway
      },

      odds: {
        disponivel:
          bookmakers.length > 0,

        ...odds
      },

      mercados
    });

  } catch (erro) {
    console.error(
      "Erro analise-prelive:",
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