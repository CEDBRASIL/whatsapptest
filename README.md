# CEDBrasil Bot

Servidor Node.js para envio de mensagens via WhatsApp usando Baileys.

## Endpoints principais

- `GET /status` - verifica se o bot está conectado.
- `POST /connect` - inicia a conexão se não estiver conectado.
- `GET /qr` - exibe o QR Code para autenticação.
- `POST /add-number` - adiciona um número individual (`{ "numero": "5511999999999" }`).
- `POST /upload-numbers` - envia arquivo `.xlsx` ou `.csv` com coluna `numero` ou `number` contendo os números.
- `GET /numbers` - lista os números armazenados.
- `POST /disparo` - envia mensagem para todos os números (`{ "mensagem": "texto", "intervalo": 1000 }`).
- `HEAD /secure` - checagem rápida que retorna `200` caso o servidor esteja ativo.

Para utilizar, instale as dependências com `npm install` e inicie o servidor com `npm start`.
