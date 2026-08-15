const cacheAnalises = new Map();

const CACHE_MS = 15 * 60 * 1000;

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

    const agora = Date.now();

    const cacheAtual =
      cacheAnalises.get(
        String(fixtureId)
      );

    if (
      cacheAtual &&
      agora - cacheAtual.timestamp < CACHE_MS
    ) {
      res.setHeader(
        "X-Cache",
        "HIT"
      );

      return res.status(200).json({
        ...cacheAtual.data,
        cache: true
      });
    }

    const headers = {
      "x-apisports-key": apiKey
    };

    async function consultar(url) {
      try {
        const resposta = await fetch(
          url,
          { headers }
        );

        const dados =
          await resposta.json();

        if (!resposta.ok) {
          return {
            ok: false,
            status:
              resposta.status,
            dados
          };
        }

        return {
          ok: true,
          status:
            resposta.status,
          dados
        };

      } catch (erro) {
        return {
          ok: false,
          status: 500,
          dados: {
            erro:
              erro.message
          }
        };
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

    /*
      =====================================
      1. PARTIDA
      =====================================
    */

    const fixtureResp =
      await consultar(
        `https://v3.football.api-sports.io/fixtures?id=${encodeURIComponent(fixtureId)}`
      );

    if (!fixtureResp.ok) {
      return res
        .status(fixtureResp.status)
        .json({
          erro:
            "Erro ao consultar partida",
          detalhe:
            fixtureResp.dados
        });
    }

    const fixture =
      fixtureResp
        .dados
        ?.response?.[0];

    if (!fixture) {
      return res.status(404).json({
        erro:
          "Partida não encontrada"
      });
    }

    /*
      =====================================
      2. PREDICTION
      =====================================
    */

    const predictionResp =
      await consultar(
        `https://v3.football.api-sports.io/predictions?fixture=${encodeURIComponent(fixtureId)}`
      );

    const prediction =
      predictionResp.ok
        ? predictionResp
            .dados
            ?.response?.[0] || null
        : null;

    /*
      =====================================
      3. ODDS
      =====================================
    */

    const oddsResp =
      await consultar(
        `https://v3.football.api-sports.io/odds?fixture=${encodeURIComponent(fixtureId)}`
      );

    const registroOdds =
      oddsResp.ok
        ? oddsResp
            .dados
            ?.response?.[0] || null
        : null;

    const bookmakers =
      registroOdds?.bookmakers || [];

    /*
      =====================================
      FUNÇÕES DE ODDS
      =====================================
    */

    function procurarMercado(
      nomes
    ) {
      for (
        const bookmaker of
        bookmakers
      ) {
        const bets =
          Array.isArray(
            bookmaker.bets
          )
            ? bookmaker.bets
            : [];

        for (
          const bet of bets
        ) {
          const nome =
            String(
              bet.name || ""
            ).toLowerCase();

          const encontrou =
            nomes.some(
              item =>
                nome.includes(
                  item.toLowerCase()
                )
            );

          if (encontrou) {
            return {
              bookmaker:
                bookmaker.name || "",

              values:
                Array.isArray(
                  bet.values
                )
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
              valor
                .toLowerCase()
                .trim()
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
      =====================================
      PROBABILIDADES
      =====================================
    */

    const pred =
      prediction
        ?.predictions || {};

    const probCasa =
      percentual(
        pred?.percent?.home
      );

    const probEmpate =
      percentual(
        pred?.percent?.draw
      );

    const probVisitante =
      percentual(
        pred?.percent?.away
      );

    const temResultado =
      probCasa > 0 ||
      probEmpate > 0 ||
      probVisitante > 0;

    const goalsHome =
      pred?.goals?.home || null;

    const goalsAway =
      pred?.goals?.away || null;

    const underOver =
      String(
        pred?.under_over || ""
      );

    let probOver15 = 0;
    let probOver25 = 0;
    let probBtts = 0;

    if (prediction) {
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
        probBtts = 62;
      }
    }

    /*
      =====================================
      VALUE
      =====================================
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
        prob -
        implicita
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

    if (temResultado) {
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

    mercados.sort(
      (a, b) =>
        (b.value ?? -999) -
        (a.value ?? -999)
    );

    const respostaFinal = {
      fixtureId,

      partida: {
        home:
          fixture
            .teams
            ?.home
            ?.name ||
          "Casa",

        away:
          fixture
            .teams
            ?.away
            ?.name ||
          "Visitante",

        league:
          fixture
            .league
            ?.name ||
          "",

        country:
          fixture
            .league
            ?.country ||
          "",

        kickoff:
          fixture
            .fixture
            ?.date ||
          ""
      },

      probabilidades: {
        casa:
          Math.round(
            probCasa
          ),

        empate:
          Math.round(
            probEmpate
          ),

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
          Boolean(
            prediction
          ),

        winner:
          pred
            ?.winner
            ?.name ||
          "",

        winnerComment:
          pred
            ?.winner
            ?.comment ||
          "",

        advice:
          pred
            ?.advice ||
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
    };

    cacheAnalises.set(
      String(fixtureId),
      {
        timestamp: agora,
        data:
          respostaFinal
      }
    );

    res.setHeader(
      "X-Cache",
      "MISS"
    );

    res.setHeader(
      "Cache-Control",
      "s-maxage=900, stale-while-revalidate=300"
    );

    return res
      .status(200)
      .json({
        ...respostaFinal,
        cache: false
      });

  } catch (erro) {
    console.error(
      "Erro analise-prelive:",
      erro
    );

    return res
      .status(500)
      .json({
        erro:
          "Erro ao gerar análise pré-live",

        detalhe:
          erro.message
      });
  }
}