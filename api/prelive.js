let cache = {
  timestamp: 0,
  data: null
};

const CACHE_MS = 10 * 60 * 1000;

export default async function handler(req, res) {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      return res.status(500).json({
        erro: "API_FOOTBALL_KEY não configurada"
      });
    }

    const agora = Date.now();

    if (
      cache.data &&
      agora - cache.timestamp < CACHE_MS
    ) {
      res.setHeader(
        "X-Cache",
        "HIT"
      );

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
          erro:
            "Erro ao consultar jogos pré-live",
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

    const proximos =
      partidas
        .filter(jogo => {
          const status =
            jogo.fixture
              ?.status
              ?.short;

          return [
            "NS",
            "TBD"
          ].includes(status);
        })
        .sort(
          (a, b) =>
            Number(
              a.fixture
                ?.timestamp || 0
            ) -
            Number(
              b.fixture
                ?.timestamp || 0
            )
        )
        .slice(0, 12);

    const jogos =
      proximos.map(jogo => ({
        fixtureId:
          jogo.fixture?.id ||
          null,

        league:
          jogo.league?.name ||
          "",

        country:
          jogo.league
            ?.country ||
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

        timestamp:
          jogo.fixture
            ?.timestamp ||
          0,

        status:
          jogo.fixture
            ?.status
            ?.short ||
          "",

        kickoff:
          jogo.fixture
            ?.date ||
          ""
      }));

    const respostaFinal = {
      data: hoje,
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
      "s-maxage=600, stale-while-revalidate=300"
    );

    return res
      .status(200)
      .json({
        ...respostaFinal,
        cache: false
      });

  } catch (erro) {
    console.error(
      "Erro prelive:",
      erro
    );

    return res
      .status(500)
      .json({
        erro:
          "Erro ao carregar PRÉ-LIVE",
        detalhe:
          erro.message
      });
  }
}