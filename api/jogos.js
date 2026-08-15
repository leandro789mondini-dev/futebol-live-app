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
      Só reutiliza o cache se ele tiver jogos.
      Assim não ficamos presos num cache vazio.
    */
    if (
      cache.data &&
      Array.isArray(cache.data.jogos) &&
      cache.data.jogos.length > 0 &&
      agora - cache.timestamp < CACHE_MS
    ) {
      res.setHeader("X-Cache", "HIT");

      res.setHeader(
        "Cache-Control",
        "private, max-age=0, must-revalidate"
      );

      return res.status(200).json({
        ...cache.data,
        cache: true
      });
    }

    const headers = {
      "x-apisports-key": apiKey
    };

    /*
      =====================================
      1. TENTA JOGOS AO VIVO
      =====================================
    */

    let resposta = await fetch(
      "https://v3.football.api-sports.io/fixtures?live=all&timezone=America%2FSao_Paulo",
      {
        headers
      }
    );

    let dados = await resposta.json();

    /*
      Se a consulta LIVE funcionar,
      pegamos os jogos.
    */

    let partidasLive = [];

    if (resposta.ok) {
      partidasLive =
        Array.isArray(dados.response)
          ? dados.response
          : [];
    }

    /*
      =====================================
      2. SE EXISTIREM JOGOS AO VIVO
      =====================================
    */

    if (partidasLive.length > 0) {
      const jogos =
        partidasLive
          .map(formatarJogo)
          .filter(Boolean)
          .sort(
            (a, b) =>
              Number(b.minute || 0) -
              Number(a.minute || 0)
          );

      const respostaFinal = {
        modo: "LIVE",
        quantidade: jogos.length,
        jogos
      };

      cache = {
        timestamp: agora,
        data: respostaFinal
      };

      res.setHeader("X-Cache", "MISS");

      res.setHeader(
        "Cache-Control",
        "private, max-age=0, must-revalidate"
      );

      return res.status(200).json({
        ...respostaFinal,
        cache: false
      });
    }

    /*
      =====================================
      3. DATA ATUAL NO HORÁRIO DE BRASÍLIA
      =====================================
    */

    const hojeBrasil =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            "America/Sao_Paulo",

          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }
      ).format(new Date());

    /*
      =====================================
      4. BUSCA JOGOS DE HOJE
      =====================================
    */

    resposta = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${hojeBrasil}&timezone=America%2FSao_Paulo`,
      {
        headers
      }
    );

    dados = await resposta.json();

    if (!resposta.ok) {
      return res
        .status(resposta.status)
        .json({
          erro:
            "Erro ao consultar jogos de hoje",

          detalhe:
            dados?.errors ||
            dados?.message ||
            dados
        });
    }

    const partidasHoje =
      Array.isArray(dados.response)
        ? dados.response
        : [];

    /*
      =====================================
      5. FORMATA OS JOGOS
      =====================================
    */

    const jogosHoje =
      partidasHoje
        .map(formatarJogo)
        .filter(Boolean)
        .sort(
          (a, b) =>
            Number(a.timestamp || 0) -
            Number(b.timestamp || 0)
        );

    const respostaFinal = {
      modo: "HOJE",
      data: hojeBrasil,
      quantidade:
        jogosHoje.length,
      jogos:
        jogosHoje
    };

    /*
      Só salva cache quando temos jogos.
    */
    if (jogosHoje.length > 0) {
      cache = {
        timestamp: agora,
        data: respostaFinal
      };
    }

    res.setHeader(
      "X-Cache",
      "MISS"
    );

    res.setHeader(
      "Cache-Control",
      "private, max-age=0, must-revalidate"
    );

    return res.status(200).json({
      ...respostaFinal,
      cache: false
    });

  } catch (erro) {
    console.error(
      "Erro jogos:",
      erro
    );

    return res.status(500).json({
      erro:
        "Erro ao carregar jogos",

      detalhe:
        erro.message
    });
  }
}

/*
  =====================================
  FORMATA UMA PARTIDA
  =====================================
*/

function formatarJogo(jogo) {
  const fixtureId =
    jogo?.fixture?.id;

  if (!fixtureId) {
    return null;
  }

  return {
    fixtureId,

    league:
      jogo.league?.name ||
      "",

    country:
      jogo.league?.country ||
      "",

    homeTeam:
      jogo.teams?.home?.name ||
      "Casa",

    awayTeam:
      jogo.teams?.away?.name ||
      "Visitante",

    homeLogo:
      jogo.teams?.home?.logo ||
      "",

    awayLogo:
      jogo.teams?.away?.logo ||
      "",

    minute:
      jogo.fixture
        ?.status
        ?.elapsed ??
      0,

    status:
      jogo.fixture
        ?.status
        ?.short ||
      "",

    statusLong:
      jogo.fixture
        ?.status
        ?.long ||
      "",

    homeGoals:
      jogo.goals?.home ??
      0,

    awayGoals:
      jogo.goals?.away ??
      0,

    timestamp:
      jogo.fixture
        ?.timestamp ||
      0,

    kickoff:
      jogo.fixture
        ?.date ||
      ""
  };
}