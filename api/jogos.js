export default async function handler(req, res) {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      return res.status(500).json({
        erro: "API_FOOTBALL_KEY não configurada na Vercel"
      });
    }

    const headers = {
      "x-apisports-key": apiKey
    };

    // 1. Primeiro procura partidas AO VIVO
    let resposta = await fetch(
      "https://v3.football.api-sports.io/fixtures?live=all",
      { headers }
    );

    let dados = await resposta.json();

    if (!resposta.ok) {
      return res.status(resposta.status).json(dados);
    }

    let partidas = dados.response || [];
    let modo = "LIVE";

    // 2. Se não houver partidas ao vivo,
    // procura os jogos do dia
    if (partidas.length === 0) {
      const hoje = new Date().toISOString().split("T")[0];

      resposta = await fetch(
        `https://v3.football.api-sports.io/fixtures?date=${hoje}`,
        { headers }
      );

      dados = await resposta.json();

      if (!resposta.ok) {
        return res.status(resposta.status).json(dados);
      }

      partidas = dados.response || [];
      modo = "HOJE";
    }

    // 3. Devolve somente os dados necessários
    const jogos = partidas.map(jogo => ({
      fixtureId: jogo.fixture?.id,

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

    // Jogos mais recentes primeiro
    jogos.sort((a, b) => b.timestamp - a.timestamp);

    return res.status(200).json({
      modo,
      quantidade: jogos.length,
      jogos
    });

  } catch (erro) {
    return res.status(500).json({
      erro: "Erro ao consultar os jogos",
      detalhe: erro.message
    });
  }
}