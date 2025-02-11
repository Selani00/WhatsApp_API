//const {Client, LocalAuth} = require('whatsapp-web.js')
// const qrcode = require('qrcode-terminal')
// const amqp = require('amqplib');

import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;
import qrcode from 'qrcode-terminal';
import amqp from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const QUEUE_NAME = 'whatsapp_messages';

const SPECIFIC_NUMBERS = ['94706028480', '94767095344','94775249863', '94711570452','94718028480']; // Add your specific numbers here

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
const firstMessageMap = new Map();

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



        // Send the message to RabbitMQ
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: false });
        await channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify({
            from: msg.from,
            message: msg.body,
            timestamp: msg.timestamp
        })));
        console.log('Message sent to RabbitMQ queue:', msg.body);

        // get the waiting number of the msg in queue
        const queueStatus = await channel.checkQueue(QUEUE_NAME);
        console.log('Queue status:', queueStatus);
        

        await channel.close();
        await connection.close();
        
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


export default {
    client: WhatsAppClient,
    initialize: initializeClient
};