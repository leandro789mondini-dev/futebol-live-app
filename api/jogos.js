export default async function handler(req, res) {
  try {
    const apiKey = process.env.API_FOOTBALL_KEY;

    if (!apiKey) {
      return res.status(500).json({
        erro: "API_FOOTBALL_KEY não configurada na Vercel"
      });
    }

    const hoje = new Date().toISOString().split("T")[0];

    const resposta = await fetch(
      `https://v3.football.api-sports.io/fixtures?date=${hoje}`,
      {
        headers: {
          "x-apisports-key": apiKey
        }
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      return res.status(resposta.status).json(dados);
    }

    return res.status(200).json(dados);

  } catch (erro) {
    return res.status(500).json({
      erro: "Erro ao consultar os jogos",
      detalhe: erro.message
    });
  }
}
