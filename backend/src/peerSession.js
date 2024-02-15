module.exports = class PeerSession {
    constructor() {
        this.transports = [];
        this.producers = [];
        this.consumers = [];
        this.process = undefined;
        this.remotePorts = [];
    }

    addProducer(producer) {
        this.producers.push(producer);
    }

    findProducerById(id) {
        return this.producers.find(producer => producer.id === id);
    }

    findProducersByKind(kind) {
        return this.producers.filter(producer => producer.kind === kind);
    }

    addConsumer(consumer) {
        this.consumers.push(consumer);
    }

    findConsumerByKind(kind) {
        return this.consumers.find(consumer => consumer.kind === kind);
    }

    addRemotePort(port) {
        this.remotePorts.push(port);
    }

    removeRemotePort(port) {
        this.remotePorts = this.remotePorts.filter(p => p !== port);
    }

    addTransport(transport) {
        this.transports.push(transport);
    }

    findTransportById(id) {
        return this.transports.find(transport => transport.id === id);
    }

    removeTransport(transport) {
        this.transports = this.transports.filter(t => t !== transport);
    }
}
