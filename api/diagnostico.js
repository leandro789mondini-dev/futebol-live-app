export default async function handler(req, res) {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      return res.status(500).json({
        diagnostico: false,
        erro: "API_FOOTBALL_KEY não configurada"
      });
    }

    const headers = {
      "x-apisports-key": apiKey
    };

    async function consultar(url) {
      try {
        const resposta = await fetch(url, {
          headers,
          cache: "no-store"
        });

        const dados = await resposta.json();

        return {
          statusHttp: resposta.status,
          ok: resposta.ok,

          results: dados?.results ?? null,
          errors: dados?.errors ?? null,
          message: dados?.message ?? null,
          parameters: dados?.parameters ?? null,

          quantidade:
            Array.isArray(dados?.response)
              ? dados.response.length
              : 0,

          primeirosJogos:
            Array.isArray(dados?.response)
              ? dados.response.slice(0, 3).map(jogo => ({
                  id: jogo.fixture?.id,
                  status: jogo.fixture?.status?.short,
                  minuto: jogo.fixture?.status?.elapsed,

                  liga: jogo.league?.name,
                  pais: jogo.league?.country,

                  casa: jogo.teams?.home?.name,
                  visitante: jogo.teams?.away?.name,

                  golsCasa: jogo.goals?.home,
                  golsVisitante: jogo.goals?.away,

                  data: jogo.fixture?.date
                }))
              : [],

          limites: {
            limiteDia:
              resposta.headers.get(
                "x-ratelimit-requests-limit"
              ),

            restanteDia:
              resposta.headers.get(
                "x-ratelimit-requests-remaining"
              ),

            limiteMinuto:
              resposta.headers.get(
                "x-ratelimit-limit"
              ),

            restanteMinuto:
              resposta.headers.get(
                "x-ratelimit-remaining"
              )
          }
        };

      } catch (erro) {
        return {
          ok: false,
          erro: erro.message
        };
      }
    }

    const dataBrasil =
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date());

    const live = await consultar(
      "https://v3.football.api-sports.io/fixtures?live=all&timezone=America%2FSao_Paulo"
    );

    const hoje = await consultar(
      `https://v3.football.api-sports.io/fixtures?date=${dataBrasil}&timezone=America%2FSao_Paulo`
    );

    return res.status(200).json({
      diagnostico: true,
      dataBrasil,
      live,
      hoje
    });

  } catch (erro) {
    return res.status(500).json({
      diagnostico: false,
      erro: "Erro no diagnóstico",
      detalhe: erro.message
    });
  }
}