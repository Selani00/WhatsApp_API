// const express = require('express')
// const messageRouter = require('./routes/messageRouter')
// const whatsapp  = require('./service/WhatsAppClient_')
// const  amqp = require('amqplib');


import express from 'express'
// import messageRouter from './routes/messageRouter.js'
import amqp from 'amqplib'
import  whatsapp from './service/WhatsAppClient_.js';
import e from 'express';

const app = express()
const PORT = 5700

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const QUEUE_NAME = 'whatsapp_messages';

app.use(express.json())
// app.use("/api/messages", messageRouter)

const SPECIFIC_NUMBERS = ['94706028480', '94767095344','94775249863', '94711570452','94718028480']; // Add your specific numbers here


// Catch-all route for undefined endpoints
app.use((req, res, next) => {
    res.status(404).send('Route not found');
});

// Global error-handling middleware
app.use((err, req, res, next) => {
    console.error('Global error handler:', err.stack);
    res.status(500).send('Something went wrong!');
});



async function handleMessageAndReply(message) {
    try {
        // First check if the message object exists
        if (!message) {
            console.error('Message object is undefined');
            return;
        }

        // Get the WhatsApp client instance
        const { client } = whatsapp;

        // Format the chat ID properly (add @c.us if not present)
        const chatId = message.from.includes('@c.us') 
            ? message.from 
            : `${message.from}@c.us`;

        // Get the chat safely
        let chat;
        try {
            chat = await client.getChatById(chatId);
        } catch (error) {
            console.error('Error getting chat:', error);
            return;
        }
        if (chat) {

            if (message.message.toLowerCase() === 'hi' && SPECIFIC_NUMBERS.includes(message.from.split('@')[0])){
                // Show typing indicator
                await chat.sendStateTyping();

                // Your reply logic here
                const delay = Math.floor(Math.random() * 3000) + 2000;
                
                setTimeout(async () => {
                    try {
                        await chat.sendMessage('Hello! How can I assist you today?');
                        console.log('Reply sent successfully');
                    } catch (sendError) {
                        console.error('Error sending message:', sendError);
                    }
                }, delay);

            }
            
        }
    } catch (error) {
        console.error('Error in handleMessageAndReply:', error);
    }
}

// Start RabbitMQ consumer
async function startRabbitMQConsumer() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: false });

        console.log('RabbitMQ consumer started. Waiting for messages...');

        channel.consume(QUEUE_NAME, async(msg) => {
            if (msg !== null) {
                const messageData = JSON.parse(msg.content);
                console.log('Message received from RabbitMQ:', messageData);

                // Handle the message (e.g., send reply)
                await handleMessageAndReply(messageData);

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