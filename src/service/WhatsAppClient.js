import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import rabbitMQInstance from './RabbitMQService.js';

const QUEUE_NAME = 'whatsapp_messages';

class WhatsAppClientSingleton {
    constructor() {
        if (WhatsAppClientSingleton.instance) {
            return WhatsAppClientSingleton.instance;
        }
        this.client = new Client({
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
        });
        this.retries = 0;
        this.maxRetries = 3;
        WhatsAppClientSingleton.instance = this;

        // Initialize RabbitMQ channel
        this.rabbitMQChannel = null;
        this.initializeRabbitMQ();

        // Register event listeners
        this.registerEventListeners();
    }

    async initializeRabbitMQ() {
        try {
            const { channel } = await rabbitMQInstance.connect();
            this.rabbitMQChannel = channel;
            await this.rabbitMQChannel.assertQueue(QUEUE_NAME, { durable: false });
            console.log('RabbitMQ channel initialized and ready.');
        } catch (error) {
            console.error('Error initializing RabbitMQ channel:', error);
        }
    }

    registerEventListeners() {
        this.client.on('qr', (qr) => {
            try {
                console.log('QR Code received. Scan this QR code in WhatsApp to log in:');
                qrcode.generate(qr, { small: true });
            } catch (error) {
                console.error('Error generating QR code:', error.message);
            }
        });

        this.client.on('ready', () => {
            console.log('WhatsApp client is ready and connected!');
            this.retries = 0;
        });

        this.client.on('message', async (msg) => {
            try {
                const contact = await msg.getContact();
                const chat = await msg.getChat();

                console.log({
                    from: contact.pushname || contact.number,
                    number: msg.from,
                    message: msg.body,
                    timestamp: msg.timestamp,
                    chatName: chat.name
                });

                if (this.rabbitMQChannel) {
                    await this.rabbitMQChannel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify({
                        from: msg.from,
                        message: msg.body,
                        timestamp: msg.timestamp
                    })));
                    console.log('Message sent to RabbitMQ queue:', msg.body);

                    await this.rabbitMQChannel.checkQueue(QUEUE_NAME);

                } else {
                    console.error('RabbitMQ channel is not initialized.');
                }
            } catch (err) {
                console.error('Error processing incoming message:', err);
            }
        });

        this.client.on('disconnected', async (reason) => {
            console.log('WhatsApp client was disconnected:', reason);
            this.retries = 0;
            await this.initialize();
        });

        this.client.on('authenticated', () => {
            console.log('WhatsApp client authenticated successfully!');
        });

        this.client.on('auth_failure', (msg) => {
            console.error('WhatsApp authentication failed:', msg);
        });
    }

    async initialize() {
        try {
            console.log('Initializing WhatsApp client...');
            await this.client.initialize();
        } catch (error) {
            console.error('Initialization error:', error);
            if (this.retries < this.maxRetries) {
                this.retries++;
                console.log(`Retrying initialization (${this.retries}/${this.maxRetries})...`);
                setTimeout(() => this.initialize(), 5000);
            } else {
                console.error('Max retries reached. Could not initialize WhatsApp client.');
                process.exit(1);
            }
        }
    }
}

const whatsAppClientInstance = new WhatsAppClientSingleton();
export default whatsAppClientInstance;