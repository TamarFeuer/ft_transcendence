import { t, TranslationKey } from './i18n';

const HEIGHT = 8;
const WIDTH = 8;
const MINES_COUNT = 8;

const BLACK = '#000000';
const GRAY = '#b4b4b4';
const WHITE = '#ffffff';

class Minesweeper {
  constructor(height = 8, width = 8, mines = 8) {
    this.height = height;
    this.width = width;
    this.mines = new Set();
    this.minesFound = new Set();

    // Initialize empty board
    this.board = [];
    for (let i = 0; i < this.height; i++) {
      const row = [];
      for (let j = 0; j < this.width; j++) {
        row.push(false);
      }
      this.board.push(row);
    }

    // Add mines randomly
    while (this.mines.size !== mines) {
      const i = Math.floor(Math.random() * height);
      const j = Math.floor(Math.random() * width);
      if (!this.board[i][j]) {
        this.mines.add(`${i},${j}`);
        this.board[i][j] = true;
      }
    }
  }

  isMine(cell) {
    const [i, j] = cell;
    return this.board[i][j];
  }

  nearbyMines(cell) {
    const [cellI, cellJ] = cell;
    let count = 0;

    // Loop over all cells within one row and column
    for (let i = cellI - 1; i <= cellI + 1; i++) {
      for (let j = cellJ - 1; j <= cellJ + 1; j++) {
        // Ignore the cell itself
        if (i === cellI && j === cellJ) continue;

        // Update count if cell in bounds and is mine
        if (i >= 0 && i < this.height && j >= 0 && j < this.width) {
          if (this.board[i][j]) {
            count++;
          }
        }
      }
    }

    return count;
  }

  won(flags) {
    return this.mines.size === flags.size && 
           Array.from(this.mines).every(mine => flags.has(mine));
  }
}

class Sentence {
  constructor(cells, count) {
    this.cells = new Set(cells);
    this.count = count;
  }

  knownMines() {
    if (this.count === this.cells.size) {
      return new Set(this.cells);
    }
    return new Set();
  }

  knownSafes() {
    if (this.count === 0) {
      return new Set(this.cells);
    }
    return new Set();
  }

  markMine(cell) {
    if (this.cells.has(cell)) {
      this.cells.delete(cell);
      this.count--;
    }
  }

  markSafe(cell) {
    if (this.cells.has(cell)) {
      this.cells.delete(cell);
    }
  }
}

class MinesweeperAI {
  constructor(height = 8, width = 8) {
    this.height = height;
    this.width = width;
    this.movesMade = new Set();
    this.mines = new Set();
    this.safes = new Set();
    this.knowledge = [];
  }

  markMine(cell) {
    this.mines.add(cell);
    for (const sentence of this.knowledge) {
      sentence.markMine(cell);
    }
  }

  markSafe(cell) {
    this.safes.add(cell);
    for (const sentence of this.knowledge) {
      sentence.markSafe(cell);
    }
  }

  findNeighbours(cell) {
    const [i, j] = cell;
    const answer = new Set();

    for (let row = i - 1; row <= i + 1; row++) {
      for (let col = j - 1; col <= j + 1; col++) {
        if (row >= 0 && row < this.height && col >= 0 && col < this.width) {
          answer.add(`${row},${col}`);
        }
      }
    }
    answer.delete(`${i},${j}`);
    return answer;
  }

  addKnowledge(cell, count) {
    const cellKey = `${cell[0]},${cell[1]}`;
    
    // 1) mark the cell as a move that has been made
    this.movesMade.add(cellKey);

    // 2) mark the cell as safe
    this.markSafe(cellKey);
    
    // 3) add a new sentence to the AI's knowledge base
    const neighbours = this.findNeighbours(cell);
    const sent = new Sentence(neighbours, count);
    this.addSafes(sent);
    this.addMines(sent);
    
    if (!this.knowledge.some(s => this.sentencesEqual(s, sent))) {
      this.knowledge.push(sent);
    }

    // 4 & 5) Infer new knowledge
    for (const snt of this.knowledge) {
      for (const snt2 of this.knowledge) {
        if (snt !== snt2 && this.isSubset(snt.cells, snt2.cells)) {
          const newCells = new Set([...snt2.cells].filter(x => !snt.cells.has(x)));
          const newSent = new Sentence(newCells, snt2.count - snt.count);
          this.addSafes(newSent);
          this.addMines(newSent);
          if (newSent.count !== 0 && newSent.count !== newSent.cells.size && 
              !this.knowledge.some(s => this.sentencesEqual(s, newSent))) {
            this.knowledge.push(newSent);
          }
        }
      }
    }
  }

  isSubset(set1, set2) {
    return [...set1].every(x => set2.has(x)) && set1.size < set2.size;
  }

  sentencesEqual(s1, s2) {
    return s1.count === s2.count && 
           s1.cells.size === s2.cells.size && 
           [...s1.cells].every(x => s2.cells.has(x));
  }

  addSafes(sentence) {
    for (const cell of sentence.knownSafes()) {
      this.markSafe(cell);
    }
  }

  addMines(sentence) {
    for (const cell of sentence.knownMines()) {
      this.markMine(cell);
    }
  }

  makeSafeMove() {
    for (const cell of this.safes) {
      if (!this.movesMade.has(cell)) {
        const [i, j] = cell.split(',').map(Number);
        return [i, j];
      }
    }
    return null;
  }

  makeRandomMove() {
    const availableCells = [];
    for (let i = 0; i < this.height; i++) {
      for (let j = 0; j < this.width; j++) {
        const cellKey = `${i},${j}`;
        if (!this.movesMade.has(cellKey) && !this.mines.has(cellKey)) {
          availableCells.push([i, j]);
        }
      }
    }
    if (availableCells.length === 0) return null;
    return availableCells[Math.floor(Math.random() * availableCells.length)];
  }
}

// Game initialization function
function initMinesweeper() {
  const canvas = document.getElementById('minesweeperCanvas');
  if (!canvas) {
    throw new Error('Canvas element not found');
  }

  let animationId;
  
  let game = new Minesweeper(HEIGHT, WIDTH, MINES_COUNT);
  let ai = new MinesweeperAI(HEIGHT, WIDTH);
  let revealed = new Set();
  let flags = new Set();
  let lost = false;
  let instructions = true;
  let clickCooldown = false;

  const width = 600;
  const height = 400;
  const BOARD_PADDING = 20;
  const boardWidth = ((2 / 3) * width) - (BOARD_PADDING * 2);
  const boardHeight = height - (BOARD_PADDING * 2);
  const cellSize = Math.floor(Math.min(boardWidth / WIDTH, boardHeight / HEIGHT));
  const boardOrigin = [BOARD_PADDING, BOARD_PADDING];

  const drawGame = () => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear screen (fill with black)
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, width, height);

    if (instructions) {
      // Show instructions
      ctx.fillStyle = WHITE;
      ctx.font = '40px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(t(TranslationKey.MINE_TITLE), width / 2, 50);

      // Rules
      const rules = [
        t(TranslationKey.MINE_RULE_1),
        t(TranslationKey.MINE_RULE_2),
        t(TranslationKey.MINE_RULE_3)
      ];
      ctx.font = '20px Arial';
      for (let i = 0; i < rules.length; i++) {
        ctx.fillText(rules[i], width / 2, 150 + 30 * i);
      }

      // Draw Play button
      const playButton = { x: width / 4, y: (3 / 4) * height, width: width / 2, height: 50 };
      ctx.fillStyle = WHITE;
      ctx.fillRect(playButton.x, playButton.y, playButton.width, playButton.height);
      ctx.fillStyle = BLACK;
      ctx.font = '28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(t(TranslationKey.MINE_PLAY_GAME), playButton.x + playButton.width / 2, playButton.y + playButton.height / 2 + 10);
    } else {
      // Draw board
      for (let i = 0; i < HEIGHT; i++) {
        for (let j = 0; j < WIDTH; j++) {
          const x = boardOrigin[0] + j * cellSize;
          const y = boardOrigin[1] + i * cellSize;

          // Draw cell
          ctx.fillStyle = GRAY;
          ctx.fillRect(x, y, cellSize, cellSize);
          ctx.strokeStyle = WHITE;
          ctx.lineWidth = 3;
          ctx.strokeRect(x, y, cellSize, cellSize);

          const cellKey = `${i},${j}`;

          // Add mine, flag, or number if needed
          if (game.isMine([i, j]) && lost) {
            // Draw mine (red circle)
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.arc(x + cellSize / 2, y + cellSize / 2, cellSize / 4, 0, 2 * Math.PI);
            ctx.fill();
          } else if (flags.has(cellKey)) {
            // Draw flag (triangle)
            ctx.fillStyle = 'red';
            ctx.beginPath();
            ctx.moveTo(x + cellSize / 4, y + cellSize / 4);
            ctx.lineTo(x + 3 * cellSize / 4, y + cellSize / 2);
            ctx.lineTo(x + cellSize / 4, y + 3 * cellSize / 4);
            ctx.closePath();
            ctx.fill();
          } else if (revealed.has(cellKey)) {
            // Show number of nearby mines (always show, including 0)
            const nearbyCount = game.nearbyMines([i, j]);
            ctx.fillStyle = BLACK;
            ctx.font = '20px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(nearbyCount.toString(), x + cellSize / 2, y + cellSize / 2 + 8);
          }
        }
      }

      // Draw buttons
      const aiButtonX = (2 / 3) * width + BOARD_PADDING;
      const aiButtonY = (1 / 3) * height - 50;
      const buttonWidth = (width / 3) - BOARD_PADDING * 2;
      const buttonHeight = 50;

      // AI Help button
      ctx.fillStyle = WHITE;
      ctx.fillRect(aiButtonX, aiButtonY, buttonWidth, buttonHeight);
      ctx.fillStyle = BLACK;
      ctx.font = '28px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(t(TranslationKey.MINE_AI_HELP), aiButtonX + buttonWidth / 2, aiButtonY + buttonHeight / 2 + 10);

      // Restart button
      const resetButtonY = (1 / 3) * height + 20;
      ctx.fillStyle = WHITE;
      ctx.fillRect(aiButtonX, resetButtonY, buttonWidth, buttonHeight);
      ctx.fillStyle = BLACK;
      ctx.fillText(t(TranslationKey.MINE_RESTART), aiButtonX + buttonWidth / 2, resetButtonY + buttonHeight / 2 + 10);

      // Display game status
      const won = game.won(flags);
      const statusText = lost ? t(TranslationKey.MINE_LOST) : won ? t(TranslationKey.MINE_WON) : '';
      if (statusText) {
        ctx.fillStyle = WHITE;
        ctx.font = '28px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(statusText, (5 / 6) * width, (2 / 3) * height);
      }
    }
  };

  // Handle canvas clicks
  const handleCanvasClick = (event) => {
    if (clickCooldown) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;

    if (instructions) {
      // Handle "Play Game" button
      const buttonRect = { x: width / 4, y: (3 / 4) * height, width: width / 2, height: 50 };
      if (mouseX >= buttonRect.x && mouseX <= buttonRect.x + buttonRect.width &&
          mouseY >= buttonRect.y && mouseY <= buttonRect.y + buttonRect.height) {
        instructions = false;
      }
      return;
    }

    // Calculate button positions
    const aiButtonX = (2 / 3) * width + BOARD_PADDING;
    const aiButtonY = (1 / 3) * height - 50;
    const buttonWidth = (width / 3) - BOARD_PADDING * 2;
    const buttonHeight = 50;
    const resetButtonY = (1 / 3) * height + 20;

    // Handle AI Help button
    if (mouseX >= aiButtonX && mouseX <= aiButtonX + buttonWidth &&
        mouseY >= aiButtonY && mouseY <= aiButtonY + buttonHeight && !lost) {
      clickCooldown = true;
      
      let move = ai.makeSafeMove();
      if (move === null) {
        move = ai.makeRandomMove();
        if (move === null) {
          flags = new Set(ai.mines);
        }
      }
      
      if (move) {
        const [i, j] = move;
        const cellKey = `${i},${j}`;
        if (game.isMine(move)) {
          lost = true;
        } else {
          const nearby = game.nearbyMines(move);
          revealed = new Set([...revealed, cellKey]);
          ai.addKnowledge(move, nearby);
        }
      }
      
      setTimeout(() => { clickCooldown = false; }, 100);
      return;
    }

    // Handle Restart button
    if (mouseX >= aiButtonX && mouseX <= aiButtonX + buttonWidth &&
        mouseY >= resetButtonY && mouseY <= resetButtonY + buttonHeight) {
      game = new Minesweeper(HEIGHT, WIDTH, MINES_COUNT);
      ai = new MinesweeperAI(HEIGHT, WIDTH);
      revealed = new Set();
      flags = new Set();
      lost = false;
      return;
    }

    // Handle cell clicks only if game is active
    if (lost) return;

    const boardStartX = boardOrigin[0];
    const boardStartY = boardOrigin[1];
    
    // Check if click is within board area
    if (mouseX >= boardStartX && mouseX < boardStartX + WIDTH * cellSize &&
        mouseY >= boardStartY && mouseY < boardStartY + HEIGHT * cellSize) {
      
      const j = Math.floor((mouseX - boardStartX) / cellSize);
      const i = Math.floor((mouseY - boardStartY) / cellSize);
      
      // Ensure indices are valid
      if (i >= 0 && i < HEIGHT && j >= 0 && j < WIDTH) {
        const cellKey = `${i},${j}`;
        
        // Only proceed if cell is not flagged or already revealed
        if (!flags.has(cellKey) && !revealed.has(cellKey)) {
          const move = [i, j];
          if (game.isMine(move)) {
            lost = true;
          } else {
            const nearby = game.nearbyMines(move);
            revealed = new Set([...revealed, cellKey]);
            ai.addKnowledge(move, nearby);
          }
        }
      }
    }
  };

  // Handle right-click for flagging
  const handleRightClick = (event) => {
    event.preventDefault();
    if (clickCooldown || lost || instructions) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mouseX = (event.clientX - rect.left) * scaleX;
    const mouseY = (event.clientY - rect.top) * scaleY;

    const boardStartX = boardOrigin[0];
    const boardStartY = boardOrigin[1];
    
    // Check if click is within board area
    if (mouseX >= boardStartX && mouseX < boardStartX + WIDTH * cellSize &&
        mouseY >= boardStartY && mouseY < boardStartY + HEIGHT * cellSize) {
      
      const j = Math.floor((mouseX - boardStartX) / cellSize);
      const i = Math.floor((mouseY - boardStartY) / cellSize);
      
      // Ensure indices are valid
      if (i >= 0 && i < HEIGHT && j >= 0 && j < WIDTH) {
        const cellKey = `${i},${j}`;
        
        // Only flag if cell is not revealed
        if (!revealed.has(cellKey)) {
          if (flags.has(cellKey)) {
            flags.delete(cellKey);
          } else {
            flags.add(cellKey);
          }
        }
      }
    }
  };

  // Main game loop
  const gameLoop = () => {
    drawGame();
    animationId = requestAnimationFrame(gameLoop);
  };

  canvas.width = width;
  canvas.height = height;
  
  // Add event listeners
  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('contextmenu', handleRightClick);
  
  // Start game loop
  gameLoop();

  // Cleanup function
  return () => {
    cancelAnimationFrame(animationId);
    canvas.removeEventListener('click', handleCanvasClick);
    canvas.removeEventListener('contextmenu', handleRightClick);
  };
}

// Initialize when custom event is triggered
let minesweeperInitialized = false;
if (typeof window !== 'undefined') {
  window.addEventListener('initMinesweeper', () => {
    if (!minesweeperInitialized) {
      minesweeperInitialized = true;
      initMinesweeper();
    }
  });
}

