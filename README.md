# Futebol Live App

Aplicativo web instalável (PWA) para análise de partidas de futebol.

## Recursos
- Índice de oportunidade para gols (Over 2.5)
- Ambas marcam (BTTS)
- Escanteios
- Casa / empate / visitante
- Construtor de múltiplas com cálculo de odd total
- Modo DEMO com entrada manual
- Campo para conectar um endpoint próprio de dados ao vivo
- Instalável no Android pelo navegador quando publicado em HTTPS

## Publicar grátis no GitHub Pages
1. Envie todos os arquivos deste projeto para a raiz do repositório.
2. Abra Settings > Pages.
3. Em "Build and deployment", escolha "Deploy from a branch".
4. Branch: `main` e pasta `/ (root)`.
5. Salve e aguarde o link do GitHub Pages.

## API ao vivo
Por segurança, não coloque chave secreta diretamente no `app.js`.
Use um backend/proxy seu e configure no app uma URL pública que devolva JSON com este formato:

```json
{
  "homeTeam": "Casa",
  "awayTeam": "Visitante",
  "minute": 65,
  "homeGoals": 1,
  "awayGoals": 1,
  "homeShots": 12,
  "awayShots": 8,
  "homeSot": 5,
  "awaySot": 3,
  "homeCorners": 6,
  "awayCorners": 3,
  "homeDanger": 48,
  "awayDanger": 30,
  "oddHome": 2.1,
  "oddDraw": 3.2,
  "oddAway": 3.4,
  "oddOver25": 1.95,
  "oddBtts": 1.78,
  "oddCorners": 1.85
}
```

## Aviso
Os cálculos são estimativas estatísticas e não garantem resultados.
