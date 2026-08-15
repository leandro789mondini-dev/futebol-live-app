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

    /*
      =========================================
      DATA NO HORÁRIO DE BRASÍLIA
      =========================================
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
      =========================================
      TESTE 1 — JOGOS AO VIVO
      =========================================
    */

    const liveUrl =
      "https://v3.football.api-sports.io/fixtures?live=all&timezone=America%2FSao_Paulo";

    const liveResponse =
      await fetch(
        liveUrl,
        { headers }
      );

    let liveDados;

    try {
      liveDados =
        await liveResponse.json();
    } catch (erro) {
      liveDados = {
        erroJson:
          erro.message
      };
    }

    const liveLimites =
      lerLimites(
        liveResponse
      );

    /*
      =========================================
      TESTE 2 — JOGOS DO DIA
      =========================================
    */

    const hojeUrl =
      `https://v3.football.api-sports.io/fixtures?date=${hojeBrasil}&timezone=America%2FSao_Paulo`;

    const hojeResponse =
      await fetch(
        hojeUrl,
        { headers }
      );

    let hojeDados;

    try {
      hojeDados =
        await hojeResponse.json();
    } catch (erro) {
      hojeDados = {
        erroJson:
          erro.message
      };
    }

    const hojeLimites =
      lerLimites(
        hojeResponse
      );

    /*
      =========================================
      RESUMO DO DIAGNÓSTICO
      =========================================
    */

    return res.status(200).json({
      diagnostico: true,

      dataBrasil:
        hojeBrasil,

      live: {
        statusHttp:
          liveResponse.status,

        ok:
          liveResponse.ok,

        results:
          liveDados?.results ??
          null,

        errors:
          liveDados?.errors ??
          null,

        message:
          liveDados?.message ??
          null,

        responseQuantidade:
          Array.isArray(
            liveDados?.response
          )
            ? liveDados.response.length
            : null,

        parametros:
          liveDados?.parameters ??
          null,

        paging:
          liveDados?.paging ??
          null,

        limites:
          liveLimites
      },

      hoje: {
        statusHttp:
          hojeResponse.status,

        ok:
          hojeResponse.ok,

        results:
          hojeDados?.results ??
          null,

        errors:
          hojeDados?.errors ??
          null,

        message:
          hojeDados?.message ??
          null,

        responseQuantidade:
          Array.isArray(
            hojeDados?.response
          )
            ? hojeDados.response.length
            : null,

        parametros:
          hojeDados?.parameters ??
          null,

        paging:
          hojeDados?.paging ??
          null,

        limites:
          hojeLimites
      }
    });

  } catch (erro) {
    console.error(
      "Erro diagnóstico:",
      erro
    );

    return res.status(500).json({
      erro:
        "Erro ao executar diagnóstico",

      detalhe:
        erro.message
    });
  }
}