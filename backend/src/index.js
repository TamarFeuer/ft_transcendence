const Fastify = require('fastify');
const WebSocket = require('ws');
const { randomUUID } = require('crypto');

const fastify = Fastify({ logger: true });

// Game session management
class GameSession {
  constructor(id) {
    this.id = id;
    this.state = {
      ball: { x: 0, y: 0, vx: 3, vy: 1 },
      paddles: { left: 0, right: 0 },
      score: { p1: 0, p2: 0 },
      winningScore: 5
    };
    this.players = { left: null, right: null };
    this.clients = new Set();
    this.status = 'waiting'; // waiting, active, finished
    this.interval = null;
  }

  addPlayer(ws) {
    if (!this.players.left) {
      this.players.left = ws;
      ws.role = 'left';
      ws.gameId = this.id;
      this.clients.add(ws);
      ws.send(JSON.stringify({ type: 'assign', role: 'left' }));
      fastify.log.info(`Player joined as LEFT in game ${this.id}`);
      return true;
    } else if (!this.players.right) {
      this.players.right = ws;
      ws.role = 'right';
      ws.gameId = this.id;
      this.clients.add(ws);
      ws.send(JSON.stringify({ type: 'assign', role: 'right' }));
      fastify.log.info(`Player joined as RIGHT in game ${this.id}`);
      
      // Both players joined, start the game
      // this.startGame();
      return true;
    } else {
      // Game is full, add as spectator
      ws.role = 'spectator';
      ws.gameId = this.id;
      this.clients.add(ws);
      ws.send(JSON.stringify({ type: 'assign', role: 'spectator' }));
      fastify.log.info(`Spectator joined game ${this.id}`);
      return true;
    }
  }

  removePlayer(ws) {
    this.clients.delete(ws);
    if (this.players.left === ws) {
      this.players.left = null;
      fastify.log.info(`LEFT player left game ${this.id}`);
    }
    if (this.players.right === ws) {
      this.players.right = null;
      fastify.log.info(`RIGHT player left game ${this.id}`);
    }

    // If game was active and a player left, end the game
    if (this.status === 'active' && (!this.players.left || !this.players.right)) {
      this.endGame('Player disconnected');
    }

    // Clean up if no clients left
    if (this.clients.size === 0) {
      this.cleanup();
    }
  }

  startGame() {
    if (this.players.left && this.players.right && this.status === 'waiting') {
      this.status = 'active';
      this.broadcast({ type: 'gameStart' });
      fastify.log.info(`Game ${this.id} started`);
      
      // Start game loop
      this.interval = setInterval(() => this.tick(), 1000 / 60);
    }
  }

  tick() {
    const TICK_MS = 1000 / 60;
    const state = this.state;

    // Integrate ball
    state.ball.x += state.ball.vx * (TICK_MS / 1000);
    state.ball.y += state.ball.vy * (TICK_MS / 1000);

    // Top/bottom bounce
    if (state.ball.y > 4 || state.ball.y < -4) {
      state.ball.vy *= -1;
    }

    // Left paddle collision
    if (state.ball.x < -3.5) {
      if (Math.abs(state.ball.y - state.paddles.left) < 1.2) {
        state.ball.vx = Math.abs(state.ball.vx);
        state.ball.vx *= 1.1;
      }
    }

    // Right paddle collision
    if (state.ball.x > 3.5) {
      if (Math.abs(state.ball.y - state.paddles.right) < 1.2) {
        state.ball.vx = -Math.abs(state.ball.vx);
        state.ball.vx *= 1.1;
      }
    }

    // Scoring
    if (state.ball.x < -6) {
      state.score.p2 += 1;
      this.resetBall();
    }
    if (state.ball.x > 6) {
      state.score.p1 += 1;
      this.resetBall();
    }

    // Check win condition
    if (state.score.p1 >= state.winningScore) {
      this.endGame('Player 1');
      return;
    }
    if (state.score.p2 >= state.winningScore) {
      this.endGame('Player 2');
      return;
    }

    // Broadcast state
    this.broadcast({
      type: 'state',
      ball: { x: state.ball.x, y: state.ball.y },
      paddles: state.paddles,
      score: state.score
    });
  }

  resetBall() {
    this.state.ball.x = 0;
    this.state.ball.y = 0;
    const dir = Math.random() > 0.5 ? 1 : -1;
    this.state.ball.vx = 3 * dir;
    this.state.ball.vy = (Math.random() - 0.5) * 2.5;
  }

  endGame(winner) {
    this.status = 'finished';
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.broadcast({ type: 'gameOver', winner });
    fastify.log.info(`Game ${this.id} ended, winner: ${winner}`);
    
    // Clean up after a delay
    setTimeout(() => {
      this.cleanup();
    }, 5000);
  }

  handlePaddleMove(ws, y) {
    const yPos = typeof y === 'number' ? y * 4 : 0;
    if (ws.role === 'left') {
      this.state.paddles.left = yPos;
    } else if (ws.role === 'right') {
      this.state.paddles.right = yPos;
    }
  }

  broadcast(msg) {
    const s = JSON.stringify(msg);
    for (const c of this.clients) {
      try {
        if (c.readyState === 1) c.send(s);
      } catch (e) {
        fastify.log.error('Broadcast error:', e);
      }
    }
  }

  cleanup() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    // Remove from games map
    games.delete(this.id);
    fastify.log.info(`Game ${this.id} cleaned up`);
  }
}

// Global games map
const games = new Map();

// API Routes
fastify.get('/api/health', async () => ({ status: 'ok' }));

fastify.post('/api/game/create', async (request, reply) => {
  const gameId = randomUUID();
  const game = new GameSession(gameId);
  games.set(gameId, game);
  
  fastify.log.info(`Game created: ${gameId}`);
  
  return { 
    gameId, 
    status: 'waiting',
    message: 'Game created. Waiting for players to join.' 
  };
});

fastify.get('/api/game/:gameId', async (request, reply) => {
  const { gameId } = request.params;
  const game = games.get(gameId);
  
  if (!game) {
    reply.code(404);
    return { error: 'Game not found' };
  }
  
  return {
    gameId: game.id,
    status: game.status,
    players: {
      left: game.players.left ? 'connected' : 'empty',
      right: game.players.right ? 'connected' : 'empty'
    },
    score: game.state.score
  };
});

fastify.get('/api/games', async () => {
  return {
    games: Array.from(games.values()).map(g => ({
      id: g.id,
      status: g.status,
      playerCount: g.clients.size
    }))
  };
})

// WebSocket setup
const wss = new WebSocket.Server({ noServer: true });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const gameId = url.searchParams.get('gameId');
  fastify.log.info(`WS connection for gameId: ${gameId}`);
  if (!gameId) {
    ws.close(1008, 'Game ID required');
    return;
  }

  const game = games.get(gameId);
  if (!game) {
    ws.close(1008, 'Game not found');
    return;
  }

  game.addPlayer(ws);
  if (game.players.left && game.players.right) {
    game.startGame();
  }
  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      
      if (data.type === 'paddleMove') {
        game.handlePaddleMove(ws, data.y);
      }
    } catch (e) {
      fastify.log.error('Invalid WS message:', e);
    }
  });

  ws.on('close', () => {
    game.removePlayer(ws);
  });

  ws.on('error', (err) => {
    fastify.log.error('WS error:', err);
    game.removePlayer(ws);
  });
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    
    // Attach WebSocket upgrade handler
    fastify.server.on('upgrade', (request, socket, head) => {
      if (request.url.startsWith('/ws')) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    fastify.log.info('Server listening on port 3000');
    fastify.log.info('WebSocket endpoint: ws://localhost:3000/ws?gameId=<gameId>');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();