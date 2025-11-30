const Fastify = require('fastify');
const websocket = require('fastify-websocket');


const fastify = Fastify({ logger: true });
fastify.register(websocket);


// Simple HTTP health endpoint
fastify.get('/api/health', async () => ({ status: 'ok' }));


// WebSocket endpoint for realtime pong
fastify.get('/ws', { websocket: true }, (connection /* SocketStream */, req) => {
const { socket } = connection;
fastify.log.info('WS connected');


socket.on('message', (message) => {
// Broadcast received message to all connected clients
// fastify-websocket does not provide a server-level list; store manually
try {
const data = JSON.parse(message.toString());
// attach received timestamp and echo to everyone
const out = JSON.stringify({ ...data, ts: Date.now() });
// naive broadcast using fastify.websocketServer.clients
if (fastify.websocketServer && fastify.websocketServer.clients) {
fastify.websocketServer.clients.forEach((client) => {
if (client.readyState === 1) client.send(out);
});
}
} catch (e) {
fastify.log.error('Invalid WS message', e);
}
});


socket.on('close', () => fastify.log.info('WS disconnected'));
});


// Expose the underlying ws Server reference on ready hook
fastify.addHook('onReady', async () => {
// fastify.websocketServer is set by fastify-websocket plugin
fastify.log.info('Server ready, websocket server available');
});


const start = async () => {
try {
await fastify.listen({ port: 3000, host: '0.0.0.0' });
} catch (err) {
fastify.log.error(err);
process.exit(1);
}
};
start();