import express from 'express';
import rabbitMQInstance from './service/RabbitMQService.js';
import whatsAppClientInstance from './service/WhatsAppClient.js';

const app = express();
const PORT = 5700;

const QUEUE_NAME = 'whatsapp_messages';
const SPECIFIC_NUMBERS = ['94706028480', '94767095344','94775249863', '94711570452','94718028480'];

app.use(express.json());

app.use((req, res, next) => {
    res.status(404).send('Route not found');
});

app.use((err, req, res, next) => {
    console.error('Global error handler:', err.stack);
    res.status(500).send('Something went wrong!');
});

const unprocessedMessages = new Set();

async function handleMessageAndReply(message) {
    try {
        if (!message) {
            console.error('Message object is undefined');
            return;
        }

        // Add the message to the unprocessed set
        unprocessedMessages.add(message.from);

        const chatId = message.from.includes('@c.us') 
            ? message.from 
            : `${message.from}@c.us`;

        let chat;
        try {
            chat = await whatsAppClientInstance.client.getChatById(chatId);
        } catch (error) {
            console.error('Error getting chat:', error);
            return;
        }

        if (chat && message.message.toLowerCase() === 'hi' && SPECIFIC_NUMBERS.includes(message.from.split('@')[0])) {
            await chat.sendStateTyping();
            const delay = Math.floor(Math.random() * 3000) + 2000;
            setTimeout(async () => {
                try {
                    await chat.sendMessage('Hello! How can I assist you today?');
                    console.log('Reply sent successfully');

                    // Remove the message from the unprocessed set after replying
                    unprocessedMessages.delete(message.from);
                    
                } catch (sendError) {
                    console.error('Error sending message:', sendError);
                }
            }, delay);
        }
    } catch (error) {
        console.error('Error in handleMessageAndReply:', error);
    }
}

async function startRabbitMQConsumer() {
    try {
        const { channel } = await rabbitMQInstance.connect();
        await channel.assertQueue(QUEUE_NAME, { durable: false });

        console.log('RabbitMQ consumer started. Waiting for messages...');

        channel.consume(QUEUE_NAME, async(msg) => {
            if (msg !== null) {
                const messageData = JSON.parse(msg.content);

                console.log('Message received from RabbitMQ:', messageData);
                await handleMessageAndReply(messageData);

                channel.ack(msg); 
                console.log('Message acknowledged and removed from the queue.');

                console.log('Unprocessed messages:', unprocessedMessages.size);
            }
        });
    } catch (error) {
        console.error('Error connecting to RabbitMQ:', error);
    }
}

const startServer = async () => {
    try {
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

        await whatsAppClientInstance.initialize();
        await startRabbitMQConsumer();
    } catch (error) {
        console.error('Error during startup:', error.message);
        process.exit(1);
    }
};

startServer();