const express = require('express')
const messageRouter = require('./routes/messageRouter')
const whatsapp = require('./service/WhatsAppClient')

const app = express()
const PORT = 3010

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

// Start server and initialize WhatsApp client
const startServer = async () => {
    try {
        // First start the Express server
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });

        // Then initialize WhatsApp client with retry logic
        await whatsapp.initialize();
    } catch (error) {
        console.error('Error during startup:', error.message);
        process.exit(1);
    }
};

startServer();