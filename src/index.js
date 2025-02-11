const express = require('express')
const messageRouter = require('./routes/messageRouter')
const whatsapp = require('./service/WhatsAppClient')
const  amqp = require('amqplib');

const app = express()
const PORT = 3010

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const QUEUE_NAME = 'whatsapp_messages';

app.use(express.json())
app.use("/api/messages", messageRouter)

// Catch-all route for undefined endpoints
app.use((req, res, next) => {
    res.status(404).send('Route not found');
});

// Global error-handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', err.stack);
    res.status(500).send('Something went wrong!');
});

// Start RabbitMQ consumer
// Start RabbitMQ consumer
async function startRabbitMQConsumer() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: false });

        console.log('RabbitMQ consumer started. Waiting for messages...');

        channel.consume(QUEUE_NAME, (msg) => {
            if (msg !== null) {
                const messageData = JSON.parse(msg.content.toString());
                console.log('Message received from RabbitMQ:', messageData);

                // Handle the message (e.g., save to database, further processing)
                // For now, just log it
                channel.ack(msg);
            }
        });
    } catch (error) {
        console.error('Error connecting to RabbitMQ:', error);
    }
}


// Start server and initialize WhatsApp client
const startServer = async () => {
    try {
        // First start the Express server
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

        // Then initialize WhatsApp client with retry logic
        await whatsapp.initialize();

        // Start RabbitMQ consumer
        await startRabbitMQConsumer();

    } catch (error) {
        console.error('Error during startup:', error.message);
        process.exit(1);
    }
};

startServer();