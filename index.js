const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
let latestQr = null;

app.get('/', (_, res) => res.send('🟢 Bot WhatsApp está rodando!'));

app.get('/qr', async (_, res) => {
    if (!latestQr) {
        return res.status(404).send('QR Code não disponível.');
    }
    try {
        const url = await QRCode.toDataURL(latestQr);
        res.send(`<img src="${url}" />`);
    } catch (err) {
        res.status(500).send('Erro ao gerar QR Code.');
    }
});

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', qr => {
    latestQr = qr;
    qrcode.generate(qr, { small: true });
    console.log('⚠️ Escaneie o QR Code acima com seu WhatsApp');
});

client.on('ready', () => {
    console.log('✅ Cliente conectado');
});

client.on('message', message => {
    if (message.body === '!curso') {
        message.reply('📚 Cursos disponíveis na CED BRASIL: Excel PRO, Marketing Digital, ADS...');
    }
});

client.initialize();

app.listen(port, () => {
    console.log(`🌐 Servidor web iniciado em http://localhost:${port}`);
});
