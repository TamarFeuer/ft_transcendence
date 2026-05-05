import "../../styles.css";
import { showMessage } from "../../utils/utils.js";
import { handleRoute, navigate } from "../../routes/route_helpers.js";
import { currentEngine, disposeCurrentEngine, resizeListener } from "../../routes/routes.js";
import { Color3, Vector3 } from "@babylonjs/core";

// Game modules
import defaultPhysics from "./physicsConfig.js";
import { createGameState } from "./gameState.js";
import { setupSceneCamera, setupScoreUI } from "./sceneSetup.js";
import { createPaddleVisual } from "./paddleVisuals.js";
import { createTableArena, positionPaddles } from "./arenaBuilder.js";
import { createPhysicsPanel } from "./physicsPanel.js";
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

        // Slider configuration for physics parameters
        const sliderConfigs = [
            // Ball launch and travel controls.
            { key: "initialSpeedX", label: "Initial Speed X", min: 0.02, max: 0.3, step: 0.001 },
            { key: "initialLateralSpeedZ", label: "Initial Speed Z", min: 0, max: 0.15, step: 0.001 },
            { key: "initialUpwardSpeedY", label: "Initial Speed Y", min: 0, max: 0.2, step: 0.001 },
            { key: "speedMultiplier", label: "Speed Multiplier", min: 0.98, max: 1.01, step: 0.0001 },
            { key: "speedMax", label: "Max Speed", min: 0.03, max: 0.5, step: 0.001 },
            { key: "gravity", label: "Gravity", min: 0, max: 0.02, step: 0.0001 },
            // Spin and curve controls.
            { key: "magnusCoefficient", label: "Magnus Coef", min: 0, max: 0.01, step: 0.0001 },
            { key: "magnusExtraFactor", label: "Magnus Boost", min: 0, max: 100, step: 1 },
            { key: "spinDecay", label: "Spin Decay", min: 0.9, max: 1.0, step: 0.0001 },
            { key: "visualSpinFactor", label: "Spin Visual", min: 0, max: 250, step: 1 },
            // Surface, net, and wall bounce tuning.
            { key: "tableInclinePerUnitX", label: "Table Incline", min: 0, max: 0.05, step: 0.001 },
            { key: "tableDownhillAcceleration", label: "Table Downhill Accel", min: 0, max: 0.01, step: 0.0001 },
            { key: "tableBounceRestitution", label: "Table Restitution", min: 0, max: 1.3, step: 0.01 },
            { key: "tableBounceFriction", label: "Table Friction", min: 0.8, max: 1, step: 0.001 },
            { key: "sideWallRestitution", label: "Side Wall Restitution", min: 0, max: 1.3, step: 0.01 },
            { key: "sideWallSpinRetention", label: "Side Wall Spin Keep", min: 0, max: 1, step: 0.01 },
            { key: "netHeight", label: "Net Height", min: 0.2, max: 2, step: 0.01 },
            { key: "netBounceDamping", label: "Net Damping", min: 0, max: 1, step: 0.01 },
            { key: "netSpinRetention", label: "Net Spin Keep", min: 0, max: 1, step: 0.01 },
            // Paddle contact volumes and hit reaction.
            { key: "paddleCollisionDepth", label: "Paddle Depth", min: 0.05, max: 0.8, step: 0.01 },
            { key: "paddleCollisionHeight", label: "Paddle Height Hitbox", min: 0.2, max: 1.8, step: 0.01 },
            { key: "paddleCollisionWidth", label: "Paddle Width Hitbox", min: 0.2, max: 1.8, step: 0.01 },
            { key: "spinTransferCoefficient", label: "Spin Transfer", min: 0, max: 4, step: 0.01 },
            { key: "velocityTransfer", label: "Velocity Transfer", min: 0, max: 0.5, step: 0.001 },
            { key: "paddleBounceBoost", label: "Paddle Bounce Boost", min: 0.8, max: 1.3, step: 0.01 },
            { key: "paddleApproachBoost", label: "Approach Boost", min: 0, max: 0.5, step: 0.01 },
            { key: "paddleRetreatDampingStrength", label: "Retreat Damping", min: 0, max: 0.6, step: 0.01 },
            { key: "paddleRetreatDampingMin", label: "Retreat Min Factor", min: 0.2, max: 1, step: 0.01 },
            { key: "paddleRotationLiftFromSpeed", label: "Rotation Lift", min: 0, max: 0.08, step: 0.001 },
            // Paddle placement and movement controls.
            { key: "paddleBaseY", label: "Paddle Base Y", min: 0.6, max: 1.6, step: 0.01 },
            { key: "paddleBoundsZ", label: "Paddle Z Limit", min: 0.8, max: 3, step: 0.1 },
            { key: "paddleRotationStep", label: "Paddle Rotation Step", min: 0.01, max: 0.2, step: 0.01 },
            { key: "paddleRotationLimit", label: "Paddle Rotation Limit", min: 0.1, max: 1.2, step: 0.01 },
            { key: "paddleStepZ", label: "Paddle Step Z", min: 0.05, max: 1.2, step: 0.01 },
            { key: "paddleSwingReach", label: "Swing Reach", min: 0.1, max: 0.8, step: 0.01 },
            { key: "paddleSwingRotationBoost", label: "Swing Rotation Boost", min: 0, max: 1, step: 0.01 },
            { key: "paddleSwingDuration", label: "Swing Duration", min: 0.05, max: 0.5, step: 0.01 },
            { key: "paddleLobDuration", label: "Lob Duration", min: 0.05, max: 0.5, step: 0.01 },
            { key: "paddleLobLiftBoost", label: "Lob Lift Boost", min: 0, max: 0.4, step: 0.01 },
            { key: "paddleLobSlowFactor", label: "Lob Slow Factor", min: 0, max: 0.9, step: 0.01 },
            { key: "paddleLobSideDamping", label: "Lob Side Damping", min: 0, max: 1, step: 0.01 },
            { key: "paddleLobRotationBoost", label: "Lob Rotation Boost", min: 0, max: 0.8, step: 0.01 },
            { key: "paddleWingDuration", label: "Wing Duration", min: 0.05, max: 0.5, step: 0.01 },
            { key: "paddleWingReach", label: "Wing Reach", min: 0.05, max: 0.8, step: 0.01 },
            { key: "paddleWingSideReach", label: "Wing Side Reach", min: 0.05, max: 0.8, step: 0.01 },
            { key: "paddleWingLiftBoost", label: "Wing Lift Boost", min: 0, max: 0.4, step: 0.01 },
            { key: "paddleWingSideBoost", label: "Wing Side Boost", min: 0, max: 0.2, step: 0.01 },
            { key: "paddleWingSpinBoost", label: "Wing Spin Boost", min: 0, max: 2, step: 0.01 },
            { key: "paddleWingForwardFactor", label: "Wing Forward Factor", min: 0.6, max: 1.2, step: 0.01 },
            { key: "paddleWingRotationBoost", label: "Wing Rotation Boost", min: 0, max: 0.8, step: 0.01 },
        ];

        const makeValueFormatter = (step) => {
            const stepString = String(step);
            const decimals = stepString.includes(".") ? stepString.split(".")[1].length : 0;
            return (value) => Number(value).toFixed(decimals);
        };

        const highImpactKeys = new Set([
            "tableInclinePerUnitX",
            "tableDownhillAcceleration",
            "netHeight",
            "spinTransferCoefficient",
            "velocityTransfer",
            "magnusCoefficient",
            "magnusExtraFactor",
            "paddleTiltToVerticalVelocity",
            "paddleRotationLiftFromSpeed",
            "paddleApproachBoost",
            "paddleRetreatDampingStrength",
            "paddleRetreatDampingMin",
            "gravity",
            "paddleStepZ",
            "paddleSwingReach",
            "paddleSwingRotationBoost",
            "paddleLobLiftBoost",
            "paddleLobSlowFactor",
            "paddleWingLiftBoost",
            "paddleWingSideBoost",
            "paddleWingSpinBoost",
        ]);

        const highImpactHints = {
            tableInclinePerUnitX: "How steeply table drops toward each end",
            tableDownhillAcceleration: "How strongly ball is pulled downhill on table",
            netHeight: "How tall the center and side net looks/blocks",
            spinTransferCoefficient: "How much sideways paddle motion becomes Y-axis side-spin",
            velocityTransfer: "How much sideways paddle motion becomes sideways ball speed",
            magnusCoefficient: "How strongly side-spin bends flight in Z",
            magnusExtraFactor: "Extra magnus multiplier",
            paddleTiltToVerticalVelocity: "Tilt contribution to upward/downward kick",
            paddleRotationLiftFromSpeed: "Extra lift from fast paddle rotation",
            paddleApproachBoost: "Boost when paddle moves toward contact point",
            paddleRetreatDampingStrength: "Power loss when paddle moves away",
            paddleRetreatDampingMin: "Minimum retained power when retreating",
            gravity: "Higher gravity keeps arcs lower",
            paddleStepZ: "How fast paddle slides sideways",
            paddleSwingReach: "How far the scripted swing thrusts the paddle",
            paddleSwingRotationBoost: "How much extra rotation the swing adds",
            paddleLobLiftBoost: "Extra upward kick for scoop/lob hit",
            paddleLobSlowFactor: "How much a lob removes forward speed",
            paddleWingLiftBoost: "Upward kick for the wing shot",
            paddleWingSideBoost: "Sideways kick for the wing shot",
            paddleWingSpinBoost: "Extra spin from wing brushing contact",
        };

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
                showMessage(winner === "p1" ? "You win!" : "They win!");
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
