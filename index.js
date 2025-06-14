const express = require('express');
const { create } = require('venom-bot');

const app = express();
const port = process.env.PORT || 3000;

let client = null;
let latestQr = null;

app.use(express.json());

app.get('/', (_, res) => res.send('🟢 Bot WhatsApp está rodando!'));

app.get('/qr', (_, res) => {
  if (!latestQr) {
    return res.status(404).send('QR Code não disponível.');
  }
  res.send(`<img src="${latestQr}" />`);
});

app.post('/send', async (req, res) => {
  const { number, message } = req.body;
  if (!number || !message) {
    return res.status(400).json({ error: 'Número e mensagem são obrigatórios.' });
  }
  if (!client) {
    return res.status(500).json({ error: 'Cliente não inicializado.' });
  }
  try {
    await client.sendText(number, message);
    res.json({ status: 'Mensagem enviada.' });
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    res.status(500).json({ error: 'Falha ao enviar mensagem.' });
  }
});

create({
  session: 'bot',
  multidevice: true,
  catchQR: (base64Qrimg, asciiQR) => {
    latestQr = base64Qrimg;
    console.log(asciiQR);
  }
}).then(c => {
  client = c;
  client.onMessage(message => {
    if (message.body === '!curso') {
      client.sendText(message.from, '📚 Cursos disponíveis na CED BRASIL: Excel PRO, Marketing Digital, ADS...');
    }
  });
  console.log('✅ Cliente conectado');
}).catch(err => {
  console.error('Erro na inicialização do cliente:', err);
});

app.listen(port, () => {
  console.log(`🌐 Servidor web iniciado em http://localhost:${port}`);
});
