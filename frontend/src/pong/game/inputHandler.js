/**
 * Keyboard input handling and paddle control mapping.
 */
import { triggerSwing, triggerLob, triggerWing } from "./paddleControl.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Setup keyboard listeners.
 */
export function setupInputHandlers(gameState, gameObjects, physics) {
    const keys = {};

    const keyDownHandler = (e) => {
        keys[e.key.toLowerCase()] = true;
    };

    const keyUpHandler = (e) => {
        keys[e.key.toLowerCase()] = false;
    };

    const swingKeyHandler = (e) => {
        if (e.code === "Space" && !gameState.input.swingQueued) {
            e.preventDefault();
            gameState.input.swingQueued = true;
            triggerSwing(gameState, gameObjects);
            setTimeout(() => {
                gameState.input.swingQueued = false;
            }, 40);
        }

        if (e.code === "KeyQ" && !gameState.input.leftLobQueued) {
            e.preventDefault();
            gameState.input.leftLobQueued = true;
            triggerLob(gameState, "left");
            setTimeout(() => {
                gameState.input.leftLobQueued = false;
            }, 40);
        }

        if (e.code === "KeyU" && !gameState.input.rightLobQueued) {
            e.preventDefault();
            gameState.input.rightLobQueued = true;
            triggerLob(gameState, "right");
            setTimeout(() => {
                gameState.input.rightLobQueued = false;
            }, 40);
        }

        if (e.code === "KeyE" && !gameState.input.leftWingQueued) {
            e.preventDefault();
            gameState.input.leftWingQueued = true;
            triggerWing(gameState, gameObjects, "left");
            setTimeout(() => {
                gameState.input.leftWingQueued = false;
            }, 40);
        }

        if (e.code === "KeyO" && !gameState.input.rightWingQueued) {
            e.preventDefault();
            gameState.input.rightWingQueued = true;
            triggerWing(gameState, gameObjects, "right");
            setTimeout(() => {
                gameState.input.rightWingQueued = false;
            }, 40);
        }
    };

    window.addEventListener("keydown", keyDownHandler);
    window.addEventListener("keyup", keyUpHandler);
    window.addEventListener("keydown", swingKeyHandler);

    // Movement and rotation polling
    const keyboardInterval = setInterval(() => {
        if (keys["w"]) gameState.paddles.left.rotationZ -= physics.paddleRotationStep;
        if (keys["s"]) gameState.paddles.left.rotationZ += physics.paddleRotationStep;
        if (keys["i"]) gameState.paddles.right.rotationZ -= physics.paddleRotationStep;
        if (keys["k"]) gameState.paddles.right.rotationZ += physics.paddleRotationStep;

        if (keys["d"]) gameObjects.paddleLeft.position.z -= physics.paddleStepZ;
        if (keys["a"]) gameObjects.paddleLeft.position.z += physics.paddleStepZ;
        if (keys["l"]) gameObjects.paddleRight.position.z -= physics.paddleStepZ;
        if (keys["j"]) gameObjects.paddleRight.position.z += physics.paddleStepZ;
    }, 1000 / 60);

    return {
        cleanup: () => {
            clearInterval(keyboardInterval);
            window.removeEventListener("keydown", keyDownHandler);
            window.removeEventListener("keyup", keyUpHandler);
            window.removeEventListener("keydown", swingKeyHandler);
        },
    };
}
