const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const qrcode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
let sock = null;
let qrCodeBase64 = null;

app.use(express.json());

app.get('/', (_, res) => {
  res.send('Bot rodando');
});

app.get('/qr', (_, res) => {
  if (qrCodeBase64) {
    res.send(`<html><body><img src="${qrCodeBase64}" alt="QR Code" /></body></html>`);
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
  if (!sock) return res.status(500).send('Bot não iniciado');
  try {
    await sock.sendMessage(`${para}@s.whatsapp.net`, { text: mensagem });
    res.send('Mensagem enviada');
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    res.status(500).send('Erro ao enviar mensagem');
  }
});

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
  sock = makeWASocket({ auth: state, printQRInTerminal: false });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      qrCodeBase64 = await qrcode.toDataURL(qr);
    }
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error instanceof Boom) &&
        (lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut);
      if (shouldReconnect) {
        console.log('Tentando reconectar...');
        startBot();
      }
    } else if (connection === 'open') {
      qrCodeBase64 = null;
      console.log('Conectado ao WhatsApp');
    }
  });

  sock.ev.on('messages.upsert', async (event) => {
    for (const msg of event.messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const texto = msg.message.conversation || msg.message.extendedTextMessage?.text;
      if (texto === '!curso') {
        await sock.sendMessage(msg.key.remoteJid, { text: '📚 Cursos da CED BRASIL: Excel PRO, Marketing Digital, ADS...' });
      }
    }
  });
}

startBot();

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
