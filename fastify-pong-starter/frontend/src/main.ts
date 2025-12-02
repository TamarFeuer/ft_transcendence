import './styles.css';
import { Engine, Scene } from '@babylonjs/core';
import { createGame } from './game';


window.addEventListener("DOMContentLoaded", () => {
    console.log("DOM fully loaded");

    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    const menu = document.getElementById("menuOverlay") as HTMLDivElement;
    if (!canvas) {
        console.error("Canvas not found");
        return;
    }
    const engine = new Engine(canvas, true);
    const scene = new Scene(engine);

    createGame(scene, canvas);

    engine.runRenderLoop(() => {scene.render();});
    window.addEventListener('resize', () => {engine.resize();});

    // === UI Buttons ===
    const btn1v1 = document.getElementById("start1v1")!;
    const btnTournament = document.getElementById("startTournament")!;

    btn1v1.addEventListener("click", () => startMode("1v1"));
    btnTournament.addEventListener("click", () => startMode("tournament"));

    function startMode(mode: "1v1" | "tournament") {
        console.log("Selected mode:", mode);

        // Hide menu with fade-out effect
        menu.classList.add("opacity-0", "pointer-events-none");
        setTimeout(() => menu.style.display = "none", 300);

        // Tell backend what mode you want (via WS)
        if (window.ws) {
        window.ws.send(JSON.stringify({ type: "selectMode", mode }));
        }
    }
    
});