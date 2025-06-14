const venom = require('venom-bot');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
let client = null;
let qrCodeBase64 = null;

app.use(express.json());

app.get('/', (_, res) => {
  res.send('Bot rodando');
});

app.get('/qrcode', (_, res) => {
  if (qrCodeBase64) {
    res.send(qrCodeBase64);
  } else {
    res.status(404).send('QR Code não disponível.');
  }
});

app.get('/send', async (req, res) => {
  const para = req.query.para;
  const mensagem = req.query.mensagem;
  if (!para || !mensagem) {
    return res.status(400).send('Parâmetros "para" e "mensagem" são obrigatórios.');
  }
  if (!client) return res.status(500).send('Bot não iniciado');
  try {
    await client.sendText(`${para}@c.us`, mensagem);
    res.send('Mensagem enviada');
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    res.status(500).send('Erro ao enviar mensagem');
  }
});

app.post('/webhook', (req, res) => {
  console.log('Webhook recebido:', req.body);
  res.sendStatus(200);
});

function startBot() {
  venom
    .create(
      'cedbrasil-bot',
      (base64Qr) => {
        qrCodeBase64 = base64Qr;
      },
      (statusSession) => {
        console.log('Status da sessão:', statusSession);
      },
      { multidevice: true, headless: true }
    )
    .then((bot) => {
      client = bot;
      qrCodeBase64 = null; // reset after authenticated
      bot.onMessage(async (message) => {
        if (message.body === '!curso') {
          await bot.sendText(
            message.from,
            '📚 Cursos da CED BRASIL: Excel PRO, Marketing Digital, ADS...'
          );
        }
      });

      bot.onStateChange((state) => {
        console.log('Estado alterado:', state);
        if (['DISCONNECTED', 'UNPAIRED', 'UNPAIRED_IDLE'].includes(state)) {
          console.log('Tentando reconectar...');
          bot.close();
          startBot();
        }
      });
    })
    .catch((err) => {
      console.error('Erro ao iniciar o bot:', err);
      setTimeout(startBot, 5000);
    });
}

startBot();

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
