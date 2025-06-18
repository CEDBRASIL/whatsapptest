const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason, downloadMediaMessage, getContentType } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const qrcode = require('qrcode');
const fs = require('fs');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const xlsx = require('xlsx');
const genAI = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 3000;
let sock = null;
let qrCodeBase64 = null;
const NUMBERS_FILE = 'numbers.json';
let numbers = [];
const upload = multer({ dest: 'uploads/' });
const GEMINI_TOKEN = process.env.GEMINI_TOKEN;
const genAIClient = new genAI.GoogleGenerativeAI(GEMINI_TOKEN || '');
const textModel = genAIClient.getGenerativeModel({
  model: 'gemini-pro',
  systemInstruction: 'Você é Joel, o assistente virtual da CED Brasília. Responda sempre em português e se apresente como Joel em suas mensagens. Caso o usuário pergunte sobre preços ou detalhes de cursos, oriente que acesse www.cedbrasilia.com.br. Se não souber a resposta, avise que chamará um assistente humano.'
});
const visionModel = genAIClient.getGenerativeModel({ model: 'gemini-pro-vision' });
const HISTORY_FILE = 'history.json';
const HUMAN_NUMBERS = ['5561986660241', '5561998675635'];
let conversations = {};

function loadNumbers() {
  if (fs.existsSync(NUMBERS_FILE)) {
    numbers = JSON.parse(fs.readFileSync(NUMBERS_FILE));
  }
}

function saveNumbers() {
  fs.writeFileSync(NUMBERS_FILE, JSON.stringify(numbers, null, 2));
}

function loadHistory() {
  if (fs.existsSync(HISTORY_FILE)) {
    conversations = JSON.parse(fs.readFileSync(HISTORY_FILE));
  }
}

function saveHistory() {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(conversations, null, 2));
}

async function notifyHumans(text) {
  if (!sock) return;
  for (const num of HUMAN_NUMBERS) {
    try {
      await sock.sendMessage(`${num}@s.whatsapp.net`, { text });
    } catch (err) {
      console.error('Erro ao notificar', num, err);
    }
  }
}
function manualResponse(text) {
  const lower = text.toLowerCase();
  const greetings = ["ola", "olá", "oi", "bom dia", "boa tarde", "boa noite"];
  if (greetings.some(g => lower.includes(g))) {
    return "Olá! Eu sou Joel, assistente virtual da CED Brasília. Em que posso ajudar?";
  }
  return null;
}


async function sendGeminiText(content, jid) {
  const manual = manualResponse(content);
  if (manual) return manual;
  if (!GEMINI_TOKEN) return 'Olá! Eu sou Joel, assistente virtual da CED Brasília. No momento não consigo acessar a IA e chamarei um assistente humano.';
  const history = conversations[jid] || [];
  conversations[jid] = history;
  const chat = textModel.startChat({ history });
  try {
    const result = await chat.sendMessage(content);
    const response = result.response.text();
    history.push({ role: 'user', parts: content });
    history.push({ role: 'model', parts: response });
    while (history.length > 20) history.shift();
    saveHistory();
    if (response.toLowerCase().includes('assistente humano')) {
      await notifyHumans(`Usuário ${jid} solicitou assistência: ${content}`);
    }
    return response;
  } catch (err) {
    console.error('Erro Gemini', err);
    await notifyHumans(`Erro Gemini com mensagem de ${jid}: ${content}`);
    return 'Desculpe, não consegui responder agora. Vou chamar um assistente humano.';
  }
}

async function sendGeminiImage(buffer, mime, caption, jid) {
  if (!GEMINI_TOKEN) return 'Olá! Eu sou Joel, assistente virtual da CED Brasília. No momento não consigo analisar imagens, então chamarei um assistente humano.';
  try {
    const base64 = buffer.toString('base64');
    const parts = [];
    if (caption) parts.push({ text: caption });
    parts.push({ inlineData: { data: base64, mimeType: mime } });
    const result = await visionModel.generateContent({ contents: [{ role: 'user', parts }] });
    return result.response.text();
  } catch (err) {
    console.error('Erro Gemini visão', err);
    await notifyHumans(`Erro ao analisar imagem de ${jid}`);
    return 'Não consegui analisar a imagem. Vou solicitar ajuda de um assistente humano.';
  }
}

app.use(express.json());
loadNumbers();
loadHistory();

app.get('/', (_, res) => {
  res.send('Bot rodando');
});

app.get('/status', (_, res) => {
  res.json({ conectado: !!(sock && sock.user) });
});

app.post('/connect', (_, res) => {
  if (sock && sock.user) {
    return res.send('Já conectado');
  }
  startBot();
  res.send('Iniciando conexão');
});

app.get('/numbers', (_, res) => {
  res.json(numbers);
});

app.post('/add-number', (req, res) => {
  const numero = req.body.numero;
  if (!numero) return res.status(400).send('Número é obrigatório');
  if (!numbers.includes(numero)) {
    numbers.push(numero);
    saveNumbers();
  }
  res.send('Número adicionado');
});

app.post('/upload-numbers', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).send('Arquivo é obrigatório');
  try {
    if (file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      const workbook = xlsx.readFile(file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = xlsx.utils.sheet_to_json(sheet);
      data.forEach(r => {
        const n = r.numero || r.number;
        if (n && !numbers.includes(String(n))) numbers.push(String(n));
      });
    } else if (file.originalname.endsWith('.csv')) {
      const content = fs.readFileSync(file.path);
      const records = parse(content, { columns: true, skip_empty_lines: true });
      records.forEach(r => {
        const n = r.numero || r.number;
        if (n && !numbers.includes(String(n))) numbers.push(String(n));
      });
    } else {
      fs.unlinkSync(file.path);
      return res.status(400).send('Formato não suportado');
    }
    saveNumbers();
    fs.unlinkSync(file.path);
    res.send('Números adicionados');
  } catch (err) {
    console.error('Erro ao processar arquivo:', err);
    res.status(500).send('Erro ao processar arquivo');
  }
});

app.post('/disparo', async (req, res) => {
  const { mensagem, intervalo } = req.body;
  if (!mensagem) return res.status(400).send('Mensagem é obrigatória');
  if (!sock) return res.status(500).send('Bot não iniciado');
  const delay = parseInt(intervalo || 1000);
  (async () => {
    for (const num of numbers) {
      try {
        await sock.sendMessage(`${num}@s.whatsapp.net`, { text: mensagem });
        await new Promise(r => setTimeout(r, delay));
      } catch (e) {
        console.error('Erro ao enviar para', num, e);
      }
    }
  })();
  res.send('Disparo iniciado');
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

// Endpoint para verificações via método HEAD
app.head('/secure', (_, res) => {
  res.status(200).end();
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
      const jid = msg.key.remoteJid;
      const messageType = getContentType(msg.message);
      const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || '';

      if (texto === '!curso') {
        await sock.sendMessage(jid, { text: '📚 Cursos da CED BRASIL: Excel PRO, Marketing Digital, ADS...' });
        continue;
      }

      if (messageType === 'imageMessage') {
        try {
          const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: sock.logger, reuploadRequest: sock.updateMediaMessage });
          const mime = msg.message.imageMessage.mimetype;
          const caption = msg.message.imageMessage.caption || texto;
          const resposta = await sendGeminiImage(buffer, mime, caption, jid);
          await sock.sendMessage(jid, { text: resposta });
        } catch (err) {
          console.error('Erro ao processar imagem', err);
          await sock.sendMessage(jid, { text: 'Não consegui analisar sua imagem. Chamarei um assistente humano.' });
          await notifyHumans(`Falha ao processar imagem enviada por ${jid}`);
        }
        continue;
      }

      if (texto) {
        const resposta = await sendGeminiText(texto, jid);
        await sock.sendMessage(jid, { text: resposta });
      }
    }
  });
}

startBot();

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
