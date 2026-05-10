import "../../../styles.css";
import { showMessage } from "../../../utils/utils.js";
import { handleRoute, navigate } from "../../../routes/route_helpers.js";
import { currentEngine, disposeCurrentEngine, resizeListener } from "../../../routes/routes.js";
import { Color3, Vector3 } from "@babylonjs/core";

// Game modules
import defaultPhysics from "./physicsConfig.js";
import { createGameState } from "./gameState.js";
import { setupSceneCamera, setupScoreUI } from "./sceneSetup.js";
import { createPaddleVisual } from "./paddleVisuals.js";
import { createTableArena, positionPaddles } from "./arenaBuilder.js";
import { createPhysicsPanel } from "./physicsPanel.js";
import { sliderConfigs, makeValueFormatter, highImpactKeys, highImpactHints } from "./physicsPanelConfig.js";
import * as ballPhysics from "./ballPhysics.js";
import { setupInputHandlers } from "./inputHandler.js";
import { createGameLoop } from "./gameLoop.js";
import * as scoreManager from "./scoreManager.js";

export function initOfflineGame(scene, gameObjects, tournament) {
    return new Promise((resolve) => {
        // ============ INITIALIZATION ============

        // 1. Create centralized game state
        const gameState = createGameState(defaultPhysics);
        
        // Initialize prev Z positions
        gameState.paddles.left.prevZ = gameObjects.paddleLeft.position.z;
        gameState.paddles.right.prevZ = gameObjects.paddleRight.position.z;

        // 2. Setup scene and camera
        setupSceneCamera(scene, gameState.physics);
        setupScoreUI(gameState);

        // 3. Create arena and visuals
        const paddleLeftBaseX = -5.95;
        const paddleRightBaseX = 5.95;
        
        const arenaMeshes = createTableArena(scene, gameState.physics);
        positionPaddles(gameObjects, gameState.physics, paddleLeftBaseX, paddleRightBaseX);
        
        const leftPaddleVisual = createPaddleVisual(gameObjects.paddleLeft, new Color3(0.9, 0.2, 0.18), scene);
        const rightPaddleVisual = createPaddleVisual(gameObjects.paddleRight, new Color3(0.18, 0.3, 0.95), scene);

        // 4. Reset ball and initialize game
        ballPhysics.resetBall(gameState, gameObjects, 1);

        // ============ PHYSICS TUNING PANEL ============

        // ============ UI AND INPUT SETUP ============

        gameState.ui.physicsPanel = createPhysicsPanel(
            gameState.physics,
            defaultPhysics,
            sliderConfigs,
            makeValueFormatter,
            highImpactKeys,
            highImpactHints,
            arenaMeshes
        );

        const inputManager = setupInputHandlers(gameState, gameObjects, gameState.physics);

        // ============ MAIN GAME LOOP ============

        const renderObserver = createGameLoop(
            gameState,
            gameObjects,
            scene,
            gameState.physics,
            arenaMeshes,
            paddleLeftBaseX,
            paddleRightBaseX
        );

        // ============ CLEANUP AND END GAME ============

        let hasEnded = false;

        const cleanup = () => {
            inputManager.cleanup();
            gameState.ui.physicsPanel?.remove();
            Object.values(arenaMeshes).forEach((mesh) => mesh?.dispose());
            Object.values(leftPaddleVisual).forEach((mesh) => mesh?.dispose());
            Object.values(rightPaddleVisual).forEach((mesh) => mesh?.dispose());
            scene.onBeforeRenderObservable.remove(renderObserver);
            disposeCurrentEngine();
            document.getElementById("renderCanvas")?.remove();
        };

        const endGame = (showWinnerMessage = false) => {
            if (hasEnded) return;
            hasEnded = true;
            cleanup();

            if (showWinnerMessage && !tournament) {
                const winner = scoreManager.getWinner(gameState);
                showMessage(winner === "p1" ? "Red wins!" : "Blue wins!");
                navigate("/pong");
            }

            resolve();
        };

        const browserExitHandler = () => endGame(false);
        window.addEventListener("beforeunload", browserExitHandler);
        window.addEventListener("pagehide", browserExitHandler);
        window.addEventListener("popstate", browserExitHandler);

        // ============ GAME STATE MONITORING ============

        // Poll game state each frame to check for game over condition
        const stateCheckInterval = setInterval(() => {
            if (scoreManager.isGameOver(gameState)) {
                clearInterval(stateCheckInterval);
                setTimeout(() => endGame(true), 0);
            }
        }, 100);
    });
}
