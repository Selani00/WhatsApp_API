const {Client, LocalAuth} = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')

const WhatsAppClient = new Client({
    authStrategy: new LocalAuth({
        clientId: 'client-one',
        dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-extensions',
            '--disable-software-rasterizer'
        ],
        defaultViewport: null,
        timeout: 60000,
        ignoreHTTPSErrors: true
    },
    restartOnAuthFail: true,
    qrMaxRetries: 5,
    authTimeoutMs: 60000,
    takeoverOnConflict: true,
    takeoverTimeoutMs: 60000
})

let retries = 0;
const maxRetries = 3;

const initializeClient = async () => {
    try {
        console.log('Initializing WhatsApp client...');
        await WhatsAppClient.initialize();
    } catch (error) {
        console.error('Initialization error:', error);
        if (retries < maxRetries) {
            retries++;
            console.log(`Retrying initialization (${retries}/${maxRetries})...`);
            setTimeout(initializeClient, 5000);
        } else {
            console.error('Max retries reached. Could not initialize WhatsApp client.');
            process.exit(1);
        }
    }
};

WhatsAppClient.on('qr', (qr) => {
    try {
        console.log('QR Code received. Scan this QR code in WhatsApp to log in:');
        qrcode.generate(qr, { small: true });
    } catch (error) {
        console.error('Error generating QR code:', error.message);
    }
})

WhatsAppClient.on('ready', () => {
    console.log('WhatsApp client is ready and connected!');
    retries = 0;
})

WhatsAppClient.on('message', async (msg) => {
    try {
        // Log all incoming messages with sender info
        const contact = await msg.getContact();
        const chat = await msg.getChat();
        
        console.log({
            from: contact.pushname || contact.number,  
            number: msg.from,                         
            message: msg.body,                        
            timestamp: msg.timestamp,                 
            chatName: chat.name                       
        });

        // If you still want to handle status broadcasts separately
        if (msg.from === 'status@broadcast') {
            console.log('Status update received:', {
                from: contact.pushname,
                message: msg.body
            });
        }
    } catch (err) {
        console.error('Error processing incoming message:', err);
    }
})

WhatsAppClient.on('disconnected', async (reason) => {
    console.log('WhatsApp client was disconnected:', reason);
    retries = 0;
    await initializeClient();
})

WhatsAppClient.on('authenticated', () => {
    console.log('WhatsApp client authenticated successfully!');
})

// Handle authentication failures
WhatsAppClient.on('auth_failure', (msg) => {
    console.error('WhatsApp authentication failed:', msg);
})

module.exports = {
    client: WhatsAppClient,
    initialize: initializeClient
};