let cache = {
  timestamp: 0,
  data: null
};

const CACHE_MS = 30 * 1000;

export default async function handler(req, res) {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      return res.status(500).json({
        erro: "API_FOOTBALL_KEY não configurada"
      });
    }

    const agora = Date.now();

    /*
      Se já consultamos há menos de 30 segundos,
      devolve o mesmo resultado sem gastar nova
      chamada na API-Football.
    */
    if (
      cache.data &&
      agora - cache.timestamp < CACHE_MS
    ) {
      res.setHeader("X-Cache", "HIT");

      return res.status(200).json({
        ...cache.data,
        cache: true
      });
    }

    const hoje =
      new Date()
        .toISOString()
        .split("T")[0];

    const resposta =
      await fetch(
        `https://v3.football.api-sports.io/fixtures?date=${hoje}`,
        {
          headers: {
            "x-apisports-key": apiKey
          }
        }
      );

    const dados =
      await resposta.json();

    if (!resposta.ok) {
      return res
        .status(resposta.status)
        .json({
          erro: "Erro ao consultar jogos",
          detalhe:
            dados?.errors ||
            dados?.message ||
            dados
        });
    }

    const partidas =
      Array.isArray(dados.response)
        ? dados.response
        : [];

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

    const jogosAoVivo =
      partidas.filter(jogo =>
        liveStatus.includes(
          jogo.fixture
            ?.status
            ?.short
        )
      );

    const origem =
      jogosAoVivo.length
        ? jogosAoVivo
        : partidas;

    const jogos =
      origem
        .map(jogo => ({
          fixtureId:
            jogo.fixture?.id ||
            null,

          league:
            jogo.league?.name ||
            "",

          country:
            jogo.league?.country ||
            "",

          homeTeam:
            jogo.teams
              ?.home
              ?.name ||
            "Casa",

          awayTeam:
            jogo.teams
              ?.away
              ?.name ||
            "Visitante",

          homeLogo:
            jogo.teams
              ?.home
              ?.logo ||
            "",

          awayLogo:
            jogo.teams
              ?.away
              ?.logo ||
            "",

          minute:
            jogo.fixture
              ?.status
              ?.elapsed ||
            0,

          status:
            jogo.fixture
              ?.status
              ?.short ||
            "",

          homeGoals:
            jogo.goals
              ?.home ??
            0,

          awayGoals:
            jogo.goals
              ?.away ??
            0,

          timestamp:
            jogo.fixture
              ?.timestamp ||
            0
        }))
        .sort(
          (a, b) =>
            Number(b.timestamp) -
            Number(a.timestamp)
        );

    const respostaFinal = {
      modo:
        jogosAoVivo.length
          ? "LIVE"
          : "HOJE",

      quantidade:
        jogos.length,

      jogos
    };

    cache = {
      timestamp: agora,
      data: respostaFinal
    };

    res.setHeader(
      "X-Cache",
      "MISS"
    );

    res.setHeader(
      "Cache-Control",
      "s-maxage=30, stale-while-revalidate=30"
    );

    return res
      .status(200)
      .json({
        ...respostaFinal,
        cache: false
      });

  } catch (erro) {
    console.error(
      "Erro jogos:",
      erro
    );

    return res
      .status(500)
      .json({
        erro:
          "Erro ao carregar jogos",
        detalhe:
          erro.message
      });
  }
}