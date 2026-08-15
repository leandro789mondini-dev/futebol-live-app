export default async function handler(req, res) {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      return res.status(500).json({
        erro: "API_FOOTBALL_KEY não configurada"
      });
    }

    const headers = {
      "x-apisports-key": apiKey
    };

    const hoje = new Date().toISOString().split("T")[0];

    // Jogos de hoje
    const respostaJogos = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${hoje}`,
      { headers }
    );

    const dadosJogos = await respostaJogos.json();

    if (!respostaJogos.ok) {
      return res.status(respostaJogos.status).json(dadosJogos);
    }

    const fixtures = Array.isArray(dadosJogos.response)
      ? dadosJogos.response
      : [];

    // Mantém apenas jogos que ainda não começaram
    const proximos = fixtures.filter(jogo => {
      const status = jogo.fixture?.status?.short;

      return ["NS", "TBD"].includes(status);
    });

    // Evita gastar muitas requisições de uma vez
    const limite = proximos.slice(0, 10);

    const resultado = [];

    for (const jogo of limite) {
      const fixtureId = jogo.fixture?.id;

      let prediction = null;

      try {
        const rp = await fetch(
          `https://v3.football.api-sports.io/predictions?fixture=${fixtureId}`,
          { headers }
        );

        if (rp.ok) {
          const dp = await rp.json();
          prediction = dp.response?.[0] || null;
        }

      } catch (_) {}

      resultado.push({
        fixtureId,

        league:
          jogo.league?.name || "",

        country:
          jogo.league?.country || "",

        homeTeam:
          jogo.teams?.home?.name || "Casa",

        awayTeam:
          jogo.teams?.away?.name || "Visitante",

        homeLogo:
          jogo.teams?.home?.logo || "",

        awayLogo:
          jogo.teams?.away?.logo || "",

        timestamp:
          jogo.fixture?.timestamp || 0,

        status:
          jogo.fixture?.status?.short || "",

        prediction: prediction
          ? {
              winner:
                prediction.predictions?.winner?.name || "",

              winnerComment:
                prediction.predictions?.winner?.comment || "",

              winOrDraw:
                prediction.predictions?.win_or_draw ?? null,

              underOver:
                prediction.predictions?.under_over || "",

              goalsHome:
                prediction.predictions?.goals?.home || "",

              goalsAway:
                prediction.predictions?.goals?.away || "",

              advice:
                prediction.predictions?.advice || "",

              percentHome:
                prediction.predictions?.percent?.home || "",

              percentDraw:
                prediction.predictions?.percent?.draw || "",

              percentAway:
                prediction.predictions?.percent?.away || ""
            }
          : null
      });
    }

    return res.status(200).json({
      data: hoje,
      quantidade: resultado.length,
      jogos: resultado
    });

  } catch (erro) {
    console.error("Erro prelive:", erro);

    return res.status(500).json({
      erro: "Erro ao gerar análise pré-live",
      detalhe: erro.message
    });
  }
}