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

    const resposta = await fetch(
      `https://v3.football.api-sports.io/odds?fixture=${fixtureId}`,
      {
        headers: {
          "x-apisports-key": apiKey
        }
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      return res.status(resposta.status).json(dados);
    }

    const registro = dados.response?.[0];

    if (!registro) {
      return res.status(200).json({
        fixtureId,
        disponivel: false,
        mensagem: "Odds não disponíveis para esta partida"
      });
    }

    const bookmakers = registro.bookmakers || [];

    function procurarMercado(nomes) {
      for (const bookmaker of bookmakers) {
        const bets = bookmaker.bets || [];

        const mercado = bets.find(bet =>
          nomes.some(nome =>
            String(bet.name || "")
              .toLowerCase()
              .includes(nome.toLowerCase())
          )
        );

        if (mercado) {
          return {
            bookmaker: bookmaker.name || "",
            values: mercado.values || []
          };
        }
      }

      return null;
    }

    function acharValor(mercado, nomes) {
      if (!mercado?.values) return null;

      for (const nome of nomes) {
        const item = mercado.values.find(v =>
          String(v.value || "")
            .toLowerCase()
            .trim() === nome.toLowerCase().trim()
        );

        if (item) {
          return Number(item.odd) || null;
        }
      }

      return null;
    }

    const matchWinner = procurarMercado([
      "Match Winner",
      "Winner"
    ]);

    const goals = procurarMercado([
      "Goals Over/Under",
      "Over/Under"
    ]);

    const btts = procurarMercado([
      "Both Teams Score",
      "Both Teams To Score"
    ]);

    const doubleChance = procurarMercado([
      "Double Chance"
    ]);

    const over15 = acharValor(goals, [
      "Over 1.5"
    ]);

    const over25 = acharValor(goals, [
      "Over 2.5"
    ]);

    const over35 = acharValor(goals, [
      "Over 3.5"
    ]);

    return res.status(200).json({
      fixtureId,
      disponivel: true,

      bookmaker:
        matchWinner?.bookmaker ||
        goals?.bookmaker ||
        btts?.bookmaker ||
        "",

      casa: acharValor(matchWinner, [
        "Home"
      ]),

      empate: acharValor(matchWinner, [
        "Draw"
      ]),

      visitante: acharValor(matchWinner, [
        "Away"
      ]),

      over15,
      over25,
      over35,

      ambasMarcamSim: acharValor(btts, [
        "Yes"
      ]),

      ambasMarcamNao: acharValor(btts, [
        "No"
      ]),

      duplaChanceCasaEmpate:
        acharValor(doubleChance, [
          "Home/Draw",
          "1X"
        ]),

      duplaChanceCasaVisitante:
        acharValor(doubleChance, [
          "Home/Away",
          "12"
        ]),

      duplaChanceEmpateVisitante:
        acharValor(doubleChance, [
          "Draw/Away",
          "X2"
        ])
    });

  } catch (erro) {
    console.error("Erro odds:", erro);

    return res.status(500).json({
      erro: "Erro ao consultar odds",
      detalhe: erro.message
    });
  }
}