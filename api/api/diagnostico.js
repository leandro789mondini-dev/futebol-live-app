export default async function handler(req, res) {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      return res.status(500).json({
        diagnostico: false,
        erro: "API_FOOTBALL_KEY não configurada na Vercel"
      });
    }

    const headers = {
      "x-apisports-key": apiKey
    };

    function lerLimites(response) {
      return {
        limiteDia:
          response.headers.get(
            "x-ratelimit-requests-limit"
          ),

        restanteDia:
          response.headers.get(
            "x-ratelimit-requests-remaining"
          ),

        limiteMinuto:
          response.headers.get(
            "x-ratelimit-limit"
          ),

        restanteMinuto:
          response.headers.get(
            "x-ratelimit-remaining"
          )
      };
    }

    async function consultar(url) {
      try {
        const response = await fetch(
          url,
          {
            headers,
            cache: "no-store"
          }
        );

        let dados = null;

        try {
          dados = await response.json();
        } catch (erroJson) {
          return {
            statusHttp:
              response.status,

            ok:
              response.ok,

            erroJson:
              erroJson.message,

            limites:
              lerLimites(response)
          };
        }

        return {
          statusHttp:
            response.status,

          ok:
            response.ok,

          results:
            dados?.results ?? null,

          errors:
            dados?.errors ?? null,

          message:
            dados?.message ?? null,

          parameters:
            dados?.parameters ?? null,

          paging:
            dados?.paging ?? null,

          quantidadeResponse:
            Array.isArray(
              dados?.response
            )
              ? dados.response.length
              : null,

          primeirosJogos:
            Array.isArray(
              dados?.response
            )
              ? dados.response
                  .slice(0, 3)
                  .map(jogo => ({
                    fixtureId:
                      jogo.fixture?.id ??
                      null,

                    status:
                      jogo.fixture
                        ?.status
                        ?.short ??
                      "",

                    minuto:
                      jogo.fixture
                        ?.status
                        ?.elapsed ??
                      null,

                    liga:
                      jogo.league?.name ??
                      "",

                    pais:
                      jogo.league?.country ??
                      "",

                    casa:
                      jogo.teams
                        ?.home
                        ?.name ??
                      "",

                    visitante:
                      jogo.teams
                        ?.away
                        ?.name ??
                      "",

                    golsCasa:
                      jogo.goals?.home ??
                      null,

                    golsVisitante:
                      jogo.goals?.away ??
                      null,

                    data:
                      jogo.fixture?.date ??
                      ""
                  }))
              : [],

          limites:
            lerLimites(response)
        };

      } catch (erro) {
        return {
          statusHttp: null,
          ok: false,
          erroFetch:
            erro.message
        };
      }
    }

    /*
      Data atual usando o horário de Brasília.
      A API-Football permite timezone
      nas consultas de fixtures.
    */

    const dataBrasil =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            "America/Sao_Paulo",

          year:
            "numeric",

          month:
            "2-digit",

          day:
            "2-digit"
        }
      ).format(
        new Date()
      );

    /*
      TESTE 1:
      partidas atualmente ao vivo
    */

    const live =
      await consultar(
        "https://v3.football.api-sports.io/fixtures?live=all&timezone=America%2FSao_Paulo"
      );

    /*
      TESTE 2:
      partidas do dia no Brasil
    */

    const hoje =
      await consultar(
        `https://v3.football.api-sports.io/fixtures?date=${dataBrasil}&timezone=America%2FSao_Paulo`
      );

    return res.status(200).json({
      diagnostico: true,

      dataBrasil,

      servidor:
        new Date().toISOString(),

      live,

      hoje
    });

  } catch (erro) {
    console.error(
      "Erro diagnóstico:",
      erro
    );

    return res.status(500).json({
      diagnostico: false,

      erro:
        "Erro ao executar diagnóstico",

      detalhe:
        erro.message
    });
  }
}