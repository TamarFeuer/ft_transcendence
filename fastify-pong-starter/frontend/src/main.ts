import "./styles.css";
import { Engine, Scene } from "@babylonjs/core";
import { initGameScene } from "./game";

let ws: WebSocket | null = null;

window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
  const menu = document.getElementById("menuOverlay") as HTMLDivElement;
  const scoreHud = document.getElementById("scoreHud") as HTMLDivElement;

  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);

  const gameObjects = initGameScene(scene, canvas);

  // connect using current host so nginx proxy works
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  ws = new WebSocket(`${proto}//${location.host}/ws`);

  ws.onopen = () => console.log("WS connected");
  ws.onerror = (e) => console.error("WS error", e);

  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
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
        console.log("role:", data.role);
      }
      if (data.type === "gameOver") {
        alert(`${data.winner} wins!`);
        location.reload();
      }
    } catch (e) {}
  };

  engine.runRenderLoop(() => scene.render());
  window.addEventListener("resize", () => engine.resize());

  // UI buttons
  document.getElementById("start1v1")!.addEventListener("click", () => startMode("1v1"));
  document.getElementById("startTournament")!.addEventListener("click", () => startMode("tournament"));

  function startMode(mode: string) {
    // hide menu
    menu.classList.add("opacity-0", "pointer-events-none");
    setTimeout(() => {
      menu.style.display = "none";
      scoreHud.classList.remove("hidden");
    }, 260);
    ws?.send(JSON.stringify({ type: "selectMode", mode }));
  }

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
});
