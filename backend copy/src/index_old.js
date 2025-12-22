const Fastify = require('fastify');
const WebSocket = require('ws');

const fastify = Fastify({ logger: true });

// simple health endpoint
fastify.get('/api/health', async () => ({ status: 'ok' }));

// game state (server authoritative)
const state = {
  ball: { x: 0, y: 0, vx: 3, vy: 1 },
  paddles: { left: 0, right: 0 }, // y positions
  score: { p1: 0, p2: 0 },
  winningScore: 5
};

let players = { left: null, right: null }; // map socket -> role
const clients = new Set();

// helper broadcast
function broadcast(msg) {
  const s = JSON.stringify(msg);
  for (const c of clients) {
    try { if (c.readyState === 1) c.send(s); } catch (e) {}
  }
}

// We'll attach a WebSocket server to Fastify's underlying HTTP server using 'ws'.
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws, req) => {
  clients.add(ws);
  fastify.log.info('WS connected, clients:', clients.size);

  // assign role if available
  if (!players.left) {
    players.left = ws;
    ws.role = 'left';
    ws.send(JSON.stringify({ type: 'assign', role: 'left' }));
  } else if (!players.right) {
    players.right = ws;
    ws.role = 'right';
    ws.send(JSON.stringify({ type: 'assign', role: 'right' }));
  } else {
    ws.role = 'spectator';
    ws.send(JSON.stringify({ type: 'assign', role: 'spectator' }));
  }

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      console.log('Received WS message', data);
      if (data.type === 'paddleMove') {
        const y = typeof data.y === 'number' ? data.y * 4 : 0;
        if (ws.role === 'left') state.paddles.left = y;
        else if (ws.role === 'right') state.paddles.right = y;
      }
      if (data.type === 'selectMode') {
        fastify.log.info('Mode selected:', data.mode);
      }
    } catch (e) {
      fastify.log.error('Invalid WS message', e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    fastify.log.info('WS disconnected, clients:', clients.size);
    if (players.left === ws) players.left = null;
    if (players.right === ws) players.right = null;
  });
});

// Server game loop (60Hz)
const TICK_MS = 1000 / 60;
setInterval(() => {
  // integrate ball
  state.ball.x += state.ball.vx * (TICK_MS / 1000);
  state.ball.y += state.ball.vy * (TICK_MS / 1000);

  // top/bottom bounce
  if (state.ball.y > 4 || state.ball.y < -4) state.ball.vy *= -1;

  // paddle collision - simple AABB
  // left paddle ~ x = -4
  if (state.ball.x < -3.5) {
    if (Math.abs(state.ball.y - state.paddles.left) < 1.2) {
      state.ball.vx = Math.abs(state.ball.vx);
      // small speedup
      state.ball.vx *= 1.1;
    }
  }
  // right paddle ~ x = 4
  if (state.ball.x > 3.5) {
    if (Math.abs(state.ball.y - state.paddles.right) < 1.2) {
      state.ball.vx = -Math.abs(state.ball.vx);
      state.ball.vx *= 1.1;
    }
  }

  // scoring
  if (state.ball.x < -6) {
    state.score.p2 += 1;
    resetBall();
  }
  if (state.ball.x > 6) {
    state.score.p1 += 1;
    resetBall();
  }

  // check win
  if (state.score.p1 >= state.winningScore || state.score.p2 >= state.winningScore) {
    broadcast({ type: 'gameOver', winner: state.score.p1 >= state.winningScore ? 'Player 1' : 'Player 2' });
    // reset scores
    state.score.p1 = 0;
    state.score.p2 = 0;
  }

  // broadcast state
  broadcast({ type: 'state', ball: { x: state.ball.x, y: state.ball.y }, paddles: state.paddles, score: state.score });

}, TICK_MS);

function resetBall() {
  state.ball.x = 0;
  state.ball.y = 0;
  // random direction
  const dir = Math.random() > 0.5 ? 1 : -1;
  state.ball.vx = 3 * dir;
  state.ball.vy = (Math.random() - 0.5) * 2.5;
}

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    // attach upgrade handler so ws can take over '/ws' connections
    fastify.server.on('upgrade', (request, socket, head) => {
      if (request.url === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    fastify.log.info('Server listening 3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
