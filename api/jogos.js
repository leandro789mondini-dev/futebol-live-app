export default async function handler(req, res) {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      return res.status(500).json({
        erro: "API_FOOTBALL_KEY não configurada na Vercel"
      });
    }

    const hoje = new Date().toISOString().split("T")[0];

    const resposta = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${hoje}`,
      {
        headers: {
          "x-apisports-key": apiKey
        }
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      return res.status(resposta.status).json({
        erro: "Erro na API-Football",
        detalhe: dados
      });
    }

    const partidas = Array.isArray(dados.response)
      ? dados.response
      : [];

    const jogos = partidas.map(jogo => ({
      fixtureId: jogo.fixture?.id || null,

      league: jogo.league?.name || "",
      country: jogo.league?.country || "",

      homeTeam: jogo.teams?.home?.name || "Mandante",
      awayTeam: jogo.teams?.away?.name || "Visitante",

      homeLogo: jogo.teams?.home?.logo || "",
      awayLogo: jogo.teams?.away?.logo || "",

      minute: jogo.fixture?.status?.elapsed || 0,
      status: jogo.fixture?.status?.short || "",

      homeGoals: jogo.goals?.home ?? 0,
      awayGoals: jogo.goals?.away ?? 0,

      timestamp: jogo.fixture?.timestamp || 0
    }));

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

    const aoVivo = jogos.filter(jogo =>
      liveStatus.includes(jogo.status)
    );

    return res.status(200).json({
      modo: aoVivo.length ? "LIVE" : "HOJE",
      quantidade: aoVivo.length || jogos.length,
      jogos: aoVivo.length ? aoVivo : jogos
    });

  } catch (erro) {
    console.error("ERRO /api/jogos:", erro);

    return res.status(500).json({
      erro: "Erro ao consultar os jogos",
      detalhe: erro.message
    });
  }
}