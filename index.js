const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (_, res) => res.send('🟢 Bot WhatsApp está rodando!'));

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

client.on('qr', qr => {
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
