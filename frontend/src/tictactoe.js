// import { t, TranslationKey } from './i18n';

const X = "X";
const O = "O";
const EMPTY = null;

const initialState = () => [
  [EMPTY, EMPTY, EMPTY],
  [EMPTY, EMPTY, EMPTY],
  [EMPTY, EMPTY, EMPTY]
];

const player = (board) => {
  let numX = 0;
  let numO = 0;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[i][j] === X) numX++;
      else if (board[i][j] === O) numO++;
    }
  }
  if (numX + numO === 9) return "FULL";
  else if (numX === numO) return X;
  else return O;
};

const actions = (board) => {
  const answer = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (board[i][j] === EMPTY) {
        answer.push([i, j]);
      }
    }
  }
  return answer;
};

const result = (board, action) => {
  const [i, j] = action;
  const pl = player(board);
  const res = board.map(row => [...row]);
  res[i][j] = pl;
  return res;
};

const winner = (board) => {
  // Check rows
  for (let n = 0; n < 3; n++) {
    if (board[n][0] && board[n][0] === board[n][1] && board[n][1] === board[n][2]) {
      return board[n][0];
    }
  }
  // Check columns
  for (let n = 0; n < 3; n++) {
    if (board[0][n] && board[0][n] === board[1][n] && board[1][n] === board[2][n]) {
      return board[0][n];
    }
  }
  // Check diagonals
  if (board[0][2] && board[0][2] === board[1][1] && board[1][1] === board[2][0]) {
    return board[0][2];
  }
  if (board[0][0] && board[0][0] === board[1][1] && board[1][1] === board[2][2]) {
    return board[0][0];
  }
  return EMPTY;
};

const terminal = (board) => {
  return player(board) === "FULL" || winner(board) !== EMPTY;
};

const utility = (board) => {
  const win = winner(board);
  if (win === X) return 1;
  else if (win === O) return -1;
  else return 0;
};

const minimax = (board) => {
  const maxVal = (board) => {
    let bestAction = [0, 0];
    if (terminal(board)) {
      return [utility(board), bestAction];
    }
    let v = -100;
    for (const action of actions(board)) {
      const newVal = minVal(result(board, action))[0];
      if (newVal > v) {
        v = newVal;
        bestAction = action;
      }
    }
    return [v, bestAction];
  };

  const minVal = (board) => {
    let bestAction = [0, 0];
    if (terminal(board)) {
      return [utility(board), bestAction];
    }
    let v = 100;
    for (const action of actions(board)) {
      const newVal = maxVal(result(board, action))[0];
      if (newVal < v) {
        v = newVal;
        bestAction = action;
      }
    }
    return [v, bestAction];
  };

  if (terminal(board)) return null;
  const pl = player(board);

  if (pl === X) {
    return maxVal(board)[1];
  }
  if (pl === O) {
    return minVal(board)[1];
  }
  return null;
};

// Game initialization function
export function initTicTacToe() {
  console.log('initTicTacToe called');
  const canvas = document.getElementById('tictactoeCanvas');
  if (!canvas) {
    console.error('Canvas element not found!');
    throw new Error('Canvas element not found');
  }
  console.log('Canvas found:', canvas);

  let animationId;
  
  let user = null;
  let board = initialState();
  let aiTurn = false;
  let clickCooldown = false;

  const width = 600;
  const height = 400;

  const black = '#000000';
  const white = '#ffffff';

  const drawGame = () => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear screen (fill with black)
    ctx.fillStyle = black;
    ctx.fillRect(0, 0, width, height);

    if (user === null) {
      // Let user choose a player
      
      // Draw title
      ctx.fillStyle = white;
      ctx.font = '40px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(t(TranslationKey.TTT_TITLE), width / 2, 50);

      // Draw player selection buttons
      const playXButton = { x: width / 8, y: height / 2, width: width / 4, height: 50 };
      const playOButton = { x: 5 * (width / 8), y: height / 2, width: width / 4, height: 50 };

      // Draw Play as X button
      ctx.fillStyle = white;
      ctx.fillRect(playXButton.x, playXButton.y, playXButton.width, playXButton.height);
      ctx.fillStyle = black;
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(t(TranslationKey.TTT_PLAY_AS_X), playXButton.x + playXButton.width / 2, playXButton.y + playXButton.height / 2 + 8);

      // Draw Play as O button
      ctx.fillStyle = white;
      ctx.fillRect(playOButton.x, playOButton.y, playOButton.width, playOButton.height);
      ctx.fillStyle = black;
      ctx.fillText(t(TranslationKey.TTT_PLAY_AS_O), playOButton.x + playOButton.width / 2, playOButton.y + playOButton.height / 2 + 8);
      
    } else {
      // Draw game board
      const tileSize = 80;
      const tileOriginX = width / 2 - (1.5 * tileSize);
      const tileOriginY = height / 2 - (1.5 * tileSize);

      // Store tile positions for click detection
      const tiles = [];
      
      for (let i = 0; i < 3; i++) {
        const row = [];
        for (let j = 0; j < 3; j++) {
          const x = tileOriginX + j * tileSize;
          const y = tileOriginY + i * tileSize;
          
          // Draw tile border
          ctx.strokeStyle = white;
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, tileSize, tileSize);

          // Draw X or O if present
          if (board[i][j] !== EMPTY) {
            ctx.fillStyle = white;
            ctx.font = '60px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(board[i][j], x + tileSize / 2, y + tileSize / 2 + 20);
          }
          
          row.push({ x, y, width: tileSize, height: tileSize });
        }
        tiles.push(row);
      }

      // Store tiles for click detection
      canvas.tiles = tiles;

      const gameOver = terminal(board);
      const currentPlayer = player(board);

      // Show title
      let title;
      if (gameOver) {
        const gameWinner = winner(board);
        if (gameWinner === null) {
          title = t(TranslationKey.TTT_GAME_OVER_TIE);
        } else {
          title = t(TranslationKey.TTT_GAME_OVER_WINS, { winner: gameWinner });
        }
      } else if (user === currentPlayer) {
        title = t(TranslationKey.TTT_PLAY_AS, { player: user });
      } else {
        title = t(TranslationKey.TTT_COMPUTER_THINKING);
      }
      
      ctx.fillStyle = white;
      ctx.font = '40px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(title, width / 2, 30);

      // Draw "Play Again" button if game is over
      if (gameOver) {
        const againButton = { x: width / 3, y: height - 65, width: width / 3, height: 50 };
        ctx.fillStyle = white;
        ctx.fillRect(againButton.x, againButton.y, againButton.width, againButton.height);
        ctx.fillStyle = black;
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(t(TranslationKey.TTT_PLAY_AGAIN), againButton.x + againButton.width / 2, againButton.y + againButton.height / 2 + 8);
      }
    }
  };

  // Handle canvas clicks
  const handleCanvasClick = (event) => {
    if (clickCooldown) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    if (user === null) {
      // Handle player selection
      const playXButton = { x: width / 8, y: height / 2, width: width / 4, height: 50 };
      const playOButton = { x: 5 * (width / 8), y: height / 2, width: width / 4, height: 50 };

      if (mouseX >= playXButton.x && mouseX <= playXButton.x + playXButton.width &&
          mouseY >= playXButton.y && mouseY <= playXButton.y + playXButton.height) {
        clickCooldown = true;
        setTimeout(() => {
          user = X;
          clickCooldown = false;
        }, 200);
      } else if (mouseX >= playOButton.x && mouseX <= playOButton.x + playOButton.width &&
                 mouseY >= playOButton.y && mouseY <= playOButton.y + playOButton.height) {
        clickCooldown = true;
        setTimeout(() => {
          user = O;
          clickCooldown = false;
        }, 200);
      }
    } else {
      // Handle game moves
      const gameOver = terminal(board);
      const currentPlayer = player(board);
      const tiles = canvas.tiles;

      if (!gameOver && user === currentPlayer && tiles) {
        // Check for user move
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const tile = tiles[i][j];
            if (board[i][j] === EMPTY && 
                mouseX >= tile.x && mouseX <= tile.x + tile.width &&
                mouseY >= tile.y && mouseY <= tile.y + tile.height) {
              board = result(board, [i, j]);
              return;
            }
          }
        }
      }

      // Handle "Play Again" button
      if (gameOver) {
        const againButton = { x: width / 3, y: height - 65, width: width / 3, height: 50 };
        if (mouseX >= againButton.x && mouseX <= againButton.x + againButton.width &&
            mouseY >= againButton.y && mouseY <= againButton.y + againButton.height) {
          clickCooldown = true;
          setTimeout(() => {
            user = null;
            board = initialState();
            aiTurn = false;
            clickCooldown = false;
          }, 200);
        }
      }
    }
  };

  // AI move logic
  let aiTimer = null;
  const checkAiMove = () => {
    if (user !== null) {
      const gameOver = terminal(board);
      const currentPlayer = player(board);

      if (user !== currentPlayer && !gameOver && !aiTurn) {
        aiTurn = true;
        aiTimer = window.setTimeout(() => {
          const move = minimax(board);
          if (move) {
            board = result(board, move);
          }
          aiTurn = false;
          aiTimer = null;
        }, 500);
      }
    }
  };

  // Main game loop
  const gameLoop = () => {
    drawGame();
    checkAiMove();
    animationId = requestAnimationFrame(gameLoop);
  };

  canvas.width = width;
  canvas.height = height;
  
  // Add event listeners
  canvas.addEventListener('click', handleCanvasClick);
  
  // Start game loop
  gameLoop();

  // Cleanup function
  return () => {
    cancelAnimationFrame(animationId);
    if (aiTimer) clearTimeout(aiTimer);
    canvas.removeEventListener('click', handleCanvasClick);
  };
}

// Initialize when custom event is triggered
let tictactoeInitialized = false;
if (typeof window !== 'undefined') {
  window.addEventListener('initTicTacToe', () => {
    if (!tictactoeInitialized) {
      tictactoeInitialized = true;
      initTicTacToe();
      println('Tic Tac Toe initialized');
    }
  });
}

// document.getElementById('backBtn')?.addEventListener('click', () => navigate('/'));