const cacheEstatisticas = new Map();

const CACHE_MS = 45 * 1000;

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
      cacheEstatisticas.get(
        String(fixtureId)
      );

    if (
      cacheAtual &&
      agora - cacheAtual.timestamp < CACHE_MS
    ) {
      res.setHeader("X-Cache", "HIT");

      return res.status(200).json({
        ...cacheAtual.data,
        cache: true
      });
    }

    const resposta = await fetch(
      `https://v3.football.api-sports.io/fixtures/statistics?fixture=${encodeURIComponent(fixtureId)}`,
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
            "Erro ao consultar estatísticas",
          detalhe:
            dados?.errors ||
            dados?.message ||
            dados
        });
    }

    const times =
      Array.isArray(
        dados.response
      )
        ? dados.response
        : [];

    function valorEstatistica(
      time,
      tipo
    ) {
      const item =
        time?.statistics?.find(
          stat =>
            stat.type === tipo
        );

      const valor =
        item?.value;

      if (
        valor === null ||
        valor === undefined
      ) {
        return 0;
      }

      if (
        typeof valor === "string" &&
        valor.includes("%")
      ) {
        return (
          Number(
            valor.replace("%", "")
          ) || 0
        );
      }

      return Number(valor) || 0;
    }

    const casa =
      times[0] || {};

    const visitante =
      times[1] || {};

    const respostaFinal = {
      homeShots:
        valorEstatistica(
          casa,
          "Total Shots"
        ),

      awayShots:
        valorEstatistica(
          visitante,
          "Total Shots"
        ),

      homeSot:
        valorEstatistica(
          casa,
          "Shots on Goal"
        ),

      awaySot:
        valorEstatistica(
          visitante,
          "Shots on Goal"
        ),

      homeCorners:
        valorEstatistica(
          casa,
          "Corner Kicks"
        ),

      awayCorners:
        valorEstatistica(
          visitante,
          "Corner Kicks"
        ),

      homePossession:
        valorEstatistica(
          casa,
          "Ball Possession"
        ),

      awayPossession:
        valorEstatistica(
          visitante,
          "Ball Possession"
        ),

      homeFouls:
        valorEstatistica(
          casa,
          "Fouls"
        ),

      awayFouls:
        valorEstatistica(
          visitante,
          "Fouls"
        )
    };

    cacheEstatisticas.set(
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
      "s-maxage=45, stale-while-revalidate=30"
    );

    return res
      .status(200)
      .json({
        ...respostaFinal,
        cache: false
      });

  } catch (erro) {
    console.error(
      "Erro estatisticas:",
      erro
    );

    return res
      .status(500)
      .json({
        erro:
          "Erro ao consultar estatísticas",

        detalhe:
          erro.message
      });
  }
}