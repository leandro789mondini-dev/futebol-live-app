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
      Reaproveita a última resposta por 30 segundos.
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
      1. PRIMEIRO TENTA JOGOS REALMENTE AO VIVO
      ==========================================
    */

    let resposta = await fetch(
      "https://v3.football.api-sports.io/fixtures?live=all",
      {
        headers
      }
    );

    let dados = await resposta.json();

    /*
      Se a API devolver erro, mostramos
      o erro verdadeiro.
    */
    if (!resposta.ok) {
      return res
        .status(resposta.status)
        .json({
          erro: "Erro ao consultar jogos ao vivo",
          detalhe:
            dados?.errors ||
            dados?.message ||
            dados
        });
    }

    let partidas =
      Array.isArray(dados.response)
        ? dados.response
        : [];

    let modo = "LIVE";

    /*
      ==========================================
      2. SE NÃO HOUVER JOGO AO VIVO,
         BUSCA OS JOGOS DE HOJE
      ==========================================
    */

    if (!partidas.length) {
      const hoje =
        new Date()
          .toISOString()
          .split("T")[0];

      resposta = await fetch(
        `https://v3.football.api-sports.io/fixtures?date=${hoje}`,
        {
          headers
        }
      );

      dados = await resposta.json();

      if (!resposta.ok) {
        return res
          .status(resposta.status)
          .json({
            erro: "Erro ao consultar jogos de hoje",
            detalhe:
              dados?.errors ||
              dados?.message ||
              dados
          });
      }

      partidas =
        Array.isArray(dados.response)
          ? dados.response
          : [];

      modo = "HOJE";
    }

    /*
      ==========================================
      3. CONVERTE PARA O FORMATO DO NOSSO APP
      ==========================================
    */

    const jogos =
      partidas
        .map(jogo => ({
          fixtureId:
            jogo.fixture?.id ??
            null,

          league:
            jogo.league?.name ??
            "",

          country:
            jogo.league?.country ??
            "",

          homeTeam:
            jogo.teams?.home?.name ??
            "Casa",

          awayTeam:
            jogo.teams?.away?.name ??
            "Visitante",

          homeLogo:
            jogo.teams?.home?.logo ??
            "",

          awayLogo:
            jogo.teams?.away?.logo ??
            "",

          minute:
            jogo.fixture
              ?.status
              ?.elapsed ??
            0,

          status:
            jogo.fixture
              ?.status
              ?.short ??
            "",

          statusLong:
            jogo.fixture
              ?.status
              ?.long ??
            "",

          homeGoals:
            jogo.goals?.home ??
            0,

          awayGoals:
            jogo.goals?.away ??
            0,

          timestamp:
            jogo.fixture
              ?.timestamp ??
            0,

          kickoff:
            jogo.fixture
              ?.date ??
            ""
        }))
        .filter(
          jogo =>
            jogo.fixtureId !== null
        );

    /*
      Se estiver em LIVE, ordena pelo minuto.
      Se estiver em HOJE, ordena pelo horário.
    */

    if (modo === "LIVE") {
      jogos.sort(
        (a, b) =>
          Number(b.minute || 0) -
          Number(a.minute || 0)
      );
    } else {
      jogos.sort(
        (a, b) =>
          Number(a.timestamp || 0) -
          Number(b.timestamp || 0)
      );
    }

    const respostaFinal = {
      modo,
      quantidade:
        jogos.length,
      jogos
    };

    /*
      ==========================================
      4. SALVA NO CACHE
      ==========================================
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