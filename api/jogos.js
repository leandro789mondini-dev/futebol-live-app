let cache = {
  timestamp: 0,
  data: null
};

const CACHE_MS = 5 * 60 * 1000;

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
      ==========================================
      1. CACHE
      ==========================================
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

    const headers = {
      "x-apisports-key": apiKey
    };

    /*
      ==========================================
      2. DATA DO BRASIL
      ==========================================
    */

    const hojeBrasil =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        }
      ).format(new Date());

    /*
      ==========================================
      3. CONSULTA ÚNICA
      ==========================================
    */

    const url =
      `https://v3.football.api-sports.io/fixtures?date=${hojeBrasil}&timezone=America%2FSao_Paulo`;

    const resposta =
      await fetch(
        url,
        {
          headers
        }
      );

    let dados;

    try {
      dados =
        await resposta.json();
    } catch (erroJson) {
      return res.status(502).json({
        erro: "Resposta inválida da API",
        detalhe: erroJson.message
      });
    }

    /*
      ==========================================
      4. LIMITE DA API
      ==========================================
    */

    const limiteDia =
      resposta.headers.get(
        "x-ratelimit-requests-limit"
      );

    const restanteDia =
      resposta.headers.get(
        "x-ratelimit-requests-remaining"
      );

    const limiteMinuto =
      resposta.headers.get(
        "x-ratelimit-limit"
      );

    const restanteMinuto =
      resposta.headers.get(
        "x-ratelimit-remaining"
      );

    /*
      A API-Football pode devolver HTTP 200
      mesmo quando errors.requests informa
      que a cota acabou.
    */

    const erroRequests =
      dados?.errors?.requests;

    if (erroRequests) {
      return res.status(429).json({
        erro: "Limite diário da API atingido",
        detalhe: erroRequests,

        api: {
          limiteDia:
            limiteDia
              ? Number(limiteDia)
              : null,

          restanteDia:
            restanteDia
              ? Number(restanteDia)
              : null,

          limiteMinuto:
            limiteMinuto
              ? Number(limiteMinuto)
              : null,

          restanteMinuto:
            restanteMinuto
              ? Number(restanteMinuto)
              : null
        }
      });
    }

    if (!resposta.ok) {
      return res
        .status(resposta.status)
        .json({
          erro: "Erro ao consultar API-Football",
          detalhe:
            dados?.errors ||
            dados?.message ||
            dados
        });
    }

    /*
      ==========================================
      5. PARTIDAS
      ==========================================
    */

    const partidas =
      Array.isArray(
        dados.response
      )
        ? dados.response
        : [];

    const statusLive = [
      "1H",
      "HT",
      "2H",
      "ET",
      "BT",
      "P",
      "INT",
      "LIVE"
    ];

    const jogosLive =
      partidas.filter(
        jogo =>
          statusLive.includes(
            jogo.fixture
              ?.status
              ?.short
          )
      );

    /*
      Se houver jogos ao vivo, mostramos
      somente os jogos ao vivo.

      Se não houver, mostramos os jogos do dia.
    */

    const origem =
      jogosLive.length
        ? jogosLive
        : partidas;

    const modo =
      jogosLive.length
        ? "LIVE"
        : "HOJE";

    /*
      ==========================================
      6. FORMATAÇÃO
      ==========================================
    */

    const jogos =
      origem
        .map(jogo => {
          const fixtureId =
            jogo.fixture?.id;

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

            kickoff:
              jogo.fixture
                ?.date ||
              "",

            timestamp:
              jogo.fixture
                ?.timestamp ||
              0
          };
        })
        .filter(Boolean);

    if (modo === "LIVE") {
      jogos.sort(
        (a, b) =>
          Number(
            b.minute || 0
          ) -
          Number(
            a.minute || 0
          )
      );
    } else {
      jogos.sort(
        (a, b) =>
          Number(
            a.timestamp || 0
          ) -
          Number(
            b.timestamp || 0
          )
      );
    }

    /*
      ==========================================
      7. RESPOSTA
      ==========================================
    */

    const respostaFinal = {
      modo,

      data:
        hojeBrasil,

      quantidade:
        jogos.length,

      jogos,

      api: {
        limiteDia:
          limiteDia
            ? Number(limiteDia)
            : null,

        restanteDia:
          restanteDia
            ? Number(restanteDia)
            : null,

        limiteMinuto:
          limiteMinuto
            ? Number(limiteMinuto)
            : null,

        restanteMinuto:
          restanteMinuto
            ? Number(restanteMinuto)
            : null
      }
    };

    /*
      Só fazemos cache se a API respondeu
      normalmente.
    */

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
      "s-maxage=300, stale-while-revalidate=120"
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
      erro: "Erro ao carregar jogos",
      detalhe: erro.message
    });
  }
}