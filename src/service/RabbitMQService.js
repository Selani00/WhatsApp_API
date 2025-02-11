import amqp from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

class RabbitMQ {
    constructor() {
        if (RabbitMQ.instance) {
            return RabbitMQ.instance;
        }
        this.connection = null;
        this.channel = null;
        RabbitMQ.instance = this;
    }

    async connect() {
        if (!this.connection) {
            this.connection = await amqp.connect(RABBITMQ_URL);
            this.channel = await this.connection.createChannel();
        }
        return { connection: this.connection, channel: this.channel };
    }

    async close() {
        if (this.channel) {
            await this.channel.close();
        }
        if (this.connection) {
            await this.connection.close();
        }
        this.connection = null;
        this.channel = null;
    }
}

const rabbitMQInstance = new RabbitMQ();
export default rabbitMQInstance;