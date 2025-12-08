import "./styles.css";
import { Engine, Scene } from "@babylonjs/core";
import { initGameScene } from "./game";
import { c } from "vite/dist/node/moduleRunnerTransport.d-DJ_mE5sf";
import "./tictactoe";
import "./mine";
import { initI18n, t, TranslationKey, updatePageTranslations, setLanguage, getCurrentLanguage, Language } from "./i18n";

let ws: WebSocket | null = null;

window.addEventListener("DOMContentLoaded", () => {
  // Initialize i18n
  initI18n();
  
  // Update page translations
  updatePageTranslations();
  
  // Setup language selector
  const languageSelect = document.getElementById("languageSelect") as HTMLSelectElement;
  languageSelect.value = getCurrentLanguage();
  languageSelect.addEventListener("change", (e) => {
    const target = e.target as HTMLSelectElement;
    setLanguage(target.value as Language);
    updatePageTranslations();
  });
  
  // Listen for language change events
  window.addEventListener("languagechange", () => {
    updatePageTranslations();
  });
  
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error("Canvas element not found");
  }
  const tictactoeCanvas = document.getElementById("tictactoeCanvas") as HTMLCanvasElement;
  if (!tictactoeCanvas) {
    throw new Error("TicTacToe Canvas element not found");
  }
  const minesweeperCanvas = document.getElementById("minesweeperCanvas") as HTMLCanvasElement;
  if (!minesweeperCanvas) {
    throw new Error("Minesweeper Canvas element not found");
  }
  const tictactoeReturnBtn = document.getElementById("tictactoeReturnBtn") as HTMLButtonElement;
  const minesweeperReturnBtn = document.getElementById("minesweeperReturnBtn") as HTMLButtonElement;
  const pongReturnBtn = document.getElementById("pongReturnBtn") as HTMLButtonElement;
  const menu = document.getElementById("menuOverlay") as HTMLDivElement;
  const scoreHud = document.getElementById("scoreHud") as HTMLDivElement;
  const scoreP1 = document.getElementById("player1Score") as HTMLElement;
  const scoreP2 = document.getElementById("player2Score") as HTMLElement;
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);

  const gameObjects = initGameScene(scene, canvas, 2);

  // connect using current host so nginx proxy works
  const proto = location.protocol === "https:" ? "wss:" : "ws:";

  function initWebsocket()
  {
    ws = new WebSocket(`${proto}//${location.host}/ws`);

    ws.onopen = () => console.log(t(TranslationKey.WS_CONNECTED));
    ws.onerror = (e) => console.error(t(TranslationKey.WS_ERROR), e);

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        console.log(t(TranslationKey.WS_MESSAGE), data);
        if (data.type === "state") {
          const { ball, paddles, score } = data;
          gameObjects.ball.position.x = ball.x;
          gameObjects.ball.position.y = ball.y;
          gameObjects.paddleLeft.position.y = paddles.left;
          gameObjects.paddleRight.position.y = paddles.right;
          (document.getElementById("scoreP1") as HTMLElement).textContent = String(score.p1);
          (document.getElementById("scoreP2") as HTMLElement).textContent = String(score.p2);
        }
        if (data.type === "assign") {
          console.log(t(TranslationKey.WS_ROLE), data.role);
        }
        if (data.type === "gameOver") {
          alert(t(TranslationKey.MSG_PLAYER_WINS, { player: data.winner }));
          location.reload();
        }
      } catch (e) {}
    };

    // input sending: use mouse or touch to set paddle y for your role
    function sendPaddle(yNorm: number) {
      ws?.send(JSON.stringify({ type: "paddleMove", y: yNorm }));
    }

    // mouse/touch
    window.addEventListener("pointermove", (e) => {
      const normalized = 1 - (e.clientY / window.innerHeight); // 0..1
      const mapped = (normalized - 0.5) * 2; // -1..1
      sendPaddle(mapped);
    });

    // keyboard for convenience
    const keys: Record<string, boolean> = {};
    window.addEventListener("keydown", (e) => keys[e.key] = true);
    window.addEventListener("keyup", (e) => keys[e.key] = false);
    setInterval(() => {
      // keyboard controlling: W/S -> -1..1 mapping
      if (keys['w'] || keys['s']) {
        let y = 0;
        if (keys['w']) y = 1;
        if (keys['s']) y = -1;
        sendPaddle(y);
      }
    }, 1000 / 15);
  }

  function initOfflineGame(scene: Scene, gameObjects: { paddleLeft: any; paddleRight: any; ball: any; }, playerCount: number) {
    let ballVX = 0.07;
    let ballVY = 0.07;
    scoreP1.textContent = "0";
    let scoreP1int = 0;
    scoreP2.textContent = "0";
    let scoreP2int = 0;
    const keys: Record<string, boolean> = {};
    window.addEventListener("keydown", (e) => keys[e.key] = true);
    window.addEventListener("keyup", (e) => keys[e.key] = false);

    setInterval(() => {
      // keyboard controlling: W/S -> -1..1 mapping
      if (keys['w'] || keys['s']) {
        let y = 0;
        if (keys['w']) y = 0.8;
        if (keys['s']) y = -0.8;
        gameObjects.paddleLeft.position.y += y;
        console.log(gameObjects.paddleLeft.position.y);
      }
      if (keys['ArrowUp'] || keys['ArrowDown']) {
        let y = 0;
        if (keys['ArrowUp']) y = 0.8;
        if (keys['ArrowDown']) y = -0.8;
        gameObjects.paddleRight.position.y += y;
        console.log(gameObjects.paddleRight.position.y);
      }
    }, 1000 / 15);
  
    const renderObserver = scene.onBeforeRenderObservable.add(() => {
      // move ball
      gameObjects.ball.position.x += ballVX;
      gameObjects.ball.position.y += ballVY;
      ballVX *= 1.00005; // gradually speed up
      ballVY *= 1.00005; // gradually speed up

      // simple wall collision
      if (gameObjects.ball.position.y > 5 || gameObjects.ball.position.y < -5) {
        ballVY = -ballVY;
      }

      // simple paddle collision
      if (gameObjects.ball.position.x < gameObjects.paddleLeft.position.x + 0.25 &&
          gameObjects.ball.position.x > gameObjects.paddleLeft.position.x &&
          Math.abs(gameObjects.ball.position.y - gameObjects.paddleLeft.position.y) < 0.75) {
        ballVX = -ballVX;
      }
      if (gameObjects.ball.position.x > gameObjects.paddleRight.position.x - 0.25 &&
          gameObjects.ball.position.x < gameObjects.paddleRight.position.x &&
          Math.abs(gameObjects.ball.position.y - gameObjects.paddleRight.position.y) < 0.75) {
        ballVX = -ballVX;
      }

      // reset if out of bounds
      if (gameObjects.ball.position.x < -6)
      {
        scoreP2int++;
        scoreP2.textContent = scoreP2int.toString();
        gameObjects.ball.position.x = 0;
        gameObjects.ball.position.y = 0;
      }
      else if (gameObjects.ball.position.x > 6)
      {
        scoreP1int++;
        scoreP1.textContent = scoreP1int.toString();
        gameObjects.ball.position.x = 0;
        gameObjects.ball.position.y = 0;
      }
      if (scoreP1int >= 10)
      {
        scene.onBeforeRenderObservable.remove(renderObserver);
        alert(t(TranslationKey.MSG_PLAYER_WINS, { player: t(TranslationKey.PLAYER_1) }));
        location.reload();
        return;
      }
      else if (scoreP2int >= 10)
      {
        scene.onBeforeRenderObservable.remove(renderObserver);
        alert(t(TranslationKey.MSG_PLAYER_WINS, { player: t(TranslationKey.PLAYER_2) }));
        location.reload();
        return;

      }
      // simple AI for right paddle
      // gameObjects.paddleRight.position.y += (gameObjects.ball.position.y - gameObjects.paddleRight.position.y) * 0.3;
    });
  }

  engine.runRenderLoop(() => scene.render());
  window.addEventListener("resize", () => engine.resize());

  // UI buttons
  let playerAliases: [string, number][] = [];
  const gameSelection = document.getElementById('GameSelection')!;
  const step1 = document.getElementById('LocalOrOnlineSelection')!;
  const localOptions = document.getElementById('localOptions')!;
  const onlineOptions = document.getElementById('onlineOptions')!;
  const playerCountContainer = document.getElementById('playerCountContainer')!;
  const playersTournamentRegistration = document.getElementById('playersTournamentRegistration')!;
  const setPlayerAliasContainer = document.getElementById('setPlayerAliasContainer')!;

  const tttBtn = document.getElementById('tttBtn')!;
  const mineBtn = document.getElementById('mineBtn')!;
  const pongBtn = document.getElementById('pongBtn')!;

  const localBtn = document.getElementById('localBtn')!;
  const onlineBtn = document.getElementById('onlineBtn')!;

  const singlePlayerBtn = document.getElementById('singlePlayerBtn')!;
  const localMultiBtn = document.getElementById('localMultiBtn')!;
  const localTournamentBtn = document.getElementById('localTournamentBtn')!;

  const onlineMultiBtn = document.getElementById('onlineMultiBtn')!;
  const onlineTournamentBtn = document.getElementById('onlineTournamentBtn')!;
  const startGameBtn = document.getElementById('startGameBtn')!;
  const registerPlayersBtn = document.getElementById('registerPlayersBtn')!;
  let selectedMode = '';

  // Step 1: choose LOCAL or ONLINE


  tttBtn.addEventListener('click', () => {
    // Hide menu and pong canvas
    menu.style.display = 'none';
    scoreHud.style.display = 'none';
    canvas.style.display = 'none';
    minesweeperCanvas.style.display = 'none';
    minesweeperReturnBtn.style.display = 'none';
    pongReturnBtn.style.display = 'none';
    // Show tictactoe canvas and return button
    tictactoeCanvas.style.display = 'block';
    tictactoeReturnBtn.style.display = 'block';
    // Trigger the tictactoe initialization by dispatching custom event
    window.dispatchEvent(new CustomEvent('initTicTacToe'));
  });

  mineBtn.addEventListener('click', () => {
    // Hide menu and pong canvas
    menu.style.display = 'none';
    scoreHud.style.display = 'none';
    canvas.style.display = 'none';
    tictactoeCanvas.style.display = 'none';
    tictactoeReturnBtn.style.display = 'none';
    pongReturnBtn.style.display = 'none';
    // Show minesweeper canvas and return button
    minesweeperCanvas.style.display = 'block';
    minesweeperReturnBtn.style.display = 'block';
    // Trigger the minesweeper initialization by dispatching custom event
    window.dispatchEvent(new CustomEvent('initMinesweeper'));
  });

  // Return button handlers
  tictactoeReturnBtn.addEventListener('click', () => {
    tictactoeCanvas.style.display = 'none';
    tictactoeReturnBtn.style.display = 'none';
    canvas.style.display = 'block';
    menu.style.display = 'flex';
  });

  minesweeperReturnBtn.addEventListener('click', () => {
    minesweeperCanvas.style.display = 'none';
    minesweeperReturnBtn.style.display = 'none';
    canvas.style.display = 'block';
    menu.style.display = 'flex';
  });

  pongBtn.addEventListener('click', () => {
    gameSelection.style.display = 'none';
    step1.style.display = 'flex';
  });

  localBtn.addEventListener('click', () => {
    step1.style.display = 'none';
    localOptions.style.display = 'flex';
  });

  onlineBtn.addEventListener('click', () => {
    step1.style.display = 'none';
    onlineOptions.style.display = 'flex';
  });

  // Local options
  localMultiBtn.addEventListener('click', () => {
    selectedMode = 'localMultiplayer';
    localOptions.style.display = 'none';
    playerCountContainer.style.display = 'flex';
  });

  localTournamentBtn.addEventListener('click', () => {
    selectedMode = 'localTournament';
    localOptions.style.display = 'none';
    playersTournamentRegistration.style.display = 'flex';
  });

  registerPlayersBtn.addEventListener('click', () => {
    const playerCount = parseInt((document.getElementById('TournamentPlayerCount') as HTMLInputElement).value);
    if (playerCount >= 2) {
      alert(t(TranslationKey.MSG_PLAYERS_REGISTERED, { count: playerCount.toString() }));
      playersTournamentRegistration.style.display = 'none';
      setPlayerAliasContainer.style.display = 'flex';
      setPlayerAliasContainer.dataset.playerCount = playerCount.toString();
    } else {
      alert(t(TranslationKey.MSG_MIN_PLAYERS_ERROR));
    }
  });
  const setAliasBtn = document.getElementById('setAliasBtn')!;

  setAliasBtn.addEventListener('click', () => {
    const playerAliasInput = document.getElementById('playerAlias') as HTMLInputElement;
    const alias = playerAliasInput.value.trim();
    if (alias.length > 0) 
    {
      playerAliases.push([alias, 0]);
      const totalPlayers = parseInt(setPlayerAliasContainer.dataset.playerCount || '0');
      console.log(playerAliases.length, " total players: ", totalPlayers);
      if (playerAliases.length < totalPlayers) 
      {
        alert(t(TranslationKey.MSG_ALIAS_SET, { alias, next: (playerAliases.length + 1).toString() }));
        playerAliasInput.value = '';
      }
      else
      {
        const playerNames = playerAliases.map(([name]) => name).join(', ');
        alert(t(TranslationKey.MSG_ALL_PLAYERS_REGISTERED, { count: totalPlayers.toString(), players: playerNames }));
        setPlayerAliasContainer.style.display = 'none';
        startMode(selectedMode, totalPlayers);
      }
    }
    else {
      alert(t(TranslationKey.MSG_VALID_ALIAS_ERROR));
    }
  });

  // Online options
  onlineMultiBtn.addEventListener('click', () => {
    selectedMode = 'onlineMultiplayer';
    alert(t(TranslationKey.MSG_STARTING_ONLINE_MULTIPLAYER));
    // start online multiplayer logic here
  });

  onlineTournamentBtn.addEventListener('click', () => {
    selectedMode = 'onlineTournament';
    alert(t(TranslationKey.MSG_STARTING_ONLINE_TOURNAMENT));
    // start online tournament logic here
  });

  singlePlayerBtn.addEventListener('click', () => {
      selectedMode = 'singlePlayer';
      alert(t(TranslationKey.MSG_STARTING_SINGLEPLAYER));
  });

  // Player count submission
  startGameBtn.addEventListener('click', () => {
    const playerCount = parseInt(document.getElementById('playerCount')!.getAttribute('value') || '2');
    if (playerCount >= 2) {
      alert(t(TranslationKey.MSG_STARTING_GAME_WITH_PLAYERS, { mode: selectedMode, count: playerCount.toString() }));
      // start local multiplayer/tournament logic here
      startMode(selectedMode, playerCount)
    } else {
      alert(t(TranslationKey.MSG_MIN_PLAYERS_ERROR));
    }
  });

  function startTounament(mode: string, playerCount: number, playerAliasesParam: string[] = []) {
    const schedule: [string, string][] = [];
    // Simple round-robin scheduling
    for (let i = 0; i < playerCount; i++) {
      for (let j = i + 1; j < playerCount; j++) {
        const playerA = playerAliasesParam.length === playerCount ? playerAliasesParam[i] : `Player ${i + 1}`;
        const playerB = playerAliasesParam.length === playerCount ? playerAliasesParam[j] : `Player ${j + 1}`;
        schedule.push([playerA, playerB]);
      }
    }
  }

  function startMode(mode: string, playerCount: number, playerAliasesParam: string[] = []) {
    if (mode == "onlineMultiplayer") 
    {
      initWebsocket();
      ws?.send(JSON.stringify({ type: "selectMode", mode }));
    }
    else if (mode == "localMultiplayer")
    {
      initOfflineGame(scene, gameObjects, playerCount);
    }
    else if (mode == "localTournament")
    {
      startTounament(mode, playerCount, playerAliasesParam);
    }
    else if (mode == "singlePlayer")
    {
      initOfflineGame(scene, gameObjects, 1);
    }
    //show score HUD
    // scoreHud.classList.remove("hidden");
    // hide menu
    menu.classList.add("opacity-0", "pointer-events-none");
    setTimeout(() => {
      menu.style.display = "none";
      scoreHud.classList.remove("hidden");
      pongReturnBtn.style.display = "block";
    }, 260);
  }

  // Pong return button handler
  pongReturnBtn.addEventListener('click', () => {
    // Hide pong game and return button
    pongReturnBtn.style.display = 'none';
    scoreHud.classList.add("hidden");
    // Show menu
    menu.style.display = 'flex';
    menu.classList.remove("opacity-0", "pointer-events-none");
    // Reset game state if needed
  });
});
us