const express = require('express')
const router = express.Router()
const whatsapp = require('../service/WhatsAppClient')


router.get('/', (req, res) => {
    res.send('Test route')
})

// Send a message
router.post('/message', async (req, res, next) => {
    try {
        // Format the phone number
        let phoneNumber = req.body.phoneNumber.toString().replace(/[^\d]/g, '');
        
        // Add country code if not present (assuming default is India +91)
        if (phoneNumber.length === 10) {
            phoneNumber = '91' + phoneNumber;
        }
        
        // Add the suffix required by WhatsApp Web API
        const formattedNumber = phoneNumber + '@c.us';
        
        await whatsapp.client.sendMessage(formattedNumber, req.body.msg);
        res.status(200).send('Message sent successfully');
    } catch (error) {
        console.error('Error sending message:', error.message);
        next(error);
    }
});

module.exports = router