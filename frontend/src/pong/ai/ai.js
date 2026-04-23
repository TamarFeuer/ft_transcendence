import { showMessage } from "../../utils/utils.js";
import { disposeCurrentEngine } from "../../routes/routes.js";
import { navigate } from "../../routes/route_helpers.js";

export function initAIGame(scene, gameObjects, tournament) {
    return new Promise((resolve) => {
        let ballVX = 0.07;
        let ballVY = 0.07;
        let scoreP1int = 0;
        let scoreP2int = 0;
        let standartSpeed = 1000 / 15;

        const scoreP1 = document.getElementById("scoreP1");
        const scoreP2 = document.getElementById("scoreP2");
        scoreP1.textContent = "0";
        scoreP2.textContent = "0";

        const keys = {};

        // Handlers
        const keyDownHandler = (e) => keys[e.key] = true;
        const keyUpHandler = (e) => keys[e.key] = false;

        window.addEventListener("keydown", keyDownHandler);
        window.addEventListener("keyup", keyUpHandler);

        // AI controls (W/S)

        // Simulated Annealing
        const keyboardIntervalP1 = setInterval(() => {
            const paddleY = gameObjects.paddleLeft.position.y;
            const ballX   = gameObjects.ball.position.x;
            const ballY   = gameObjects.ball.position.y;
            const paddleX = gameObjects.paddleLeft.position.x; // -4

            let targetY;

            if (ballVX < 0) {
                // Ball is heading toward the AI — predict landing Y
                const ticksToReach = (ballX - paddleX) / Math.abs(ballVX);
                let predictedY = ballY + ballVY * ticksToReach;

                // Simulate wall bounces (walls at y = +5 and y = -5)
                const topWall = 5, bottomWall = -5;
                const range = topWall - bottomWall; // 10
                // Fold predictedY into [bottomWall, topWall] with bounce reflections
                predictedY = predictedY - bottomWall;       // shift to [0, range]
                predictedY = ((predictedY % (range * 2)) + range * 2) % (range * 2); // wrap to [0, 2*range]
                if (predictedY > range) predictedY = range * 2 - predictedY; // reflect
                predictedY = predictedY + bottomWall;       // shift back

                // Add error: AI aims near the right spot but not perfectly
                const maxError = 2.5; // higher = more misses (~50/50 at 2.5)
                targetY = predictedY + (Math.random() * 2 - 1) * maxError;
            } else {
                // Ball moving away — drift back to center so AI is ready
                targetY = 0;
            }

            const difference = targetY - paddleY;
            const speed = 0.15;

            if (Math.abs(difference) > 0.1) {
                gameObjects.paddleLeft.position.y += Math.sign(difference) * Math.min(speed, Math.abs(difference));
            }

            // Clamp AI paddle within bounds (fix #2 also applied here)
            gameObjects.paddleLeft.position.y = Math.max(-4.5, Math.min(4.5, gameObjects.paddleLeft.position.y));
        }, standartSpeed);

        // Player 2 controls (Arrow keys)
        const keyboardIntervalP2 = setInterval(() => {
            let y = 0;
            if (keys['ArrowUp']) y = 0.8;
            if (keys['ArrowDown']) y = -0.8;
            gameObjects.paddleRight.position.y += y;

            // Keep paddle within bounds
            if (gameObjects.paddleRight.position.y > 4.5) {
                gameObjects.paddleRight.position.y = 4.5;
            }
            if (gameObjects.paddleRight.position.y < -4.5) {
                gameObjects.paddleRight.position.y = -4.5;
            }
        }, standartSpeed);

        const renderObserver = scene.onBeforeRenderObservable.add(() => {
            gameObjects.ball.position.x += ballVX;
            gameObjects.ball.position.y += ballVY;
            ballVX *= 1.00005; // Gradually speeds up
            ballVY *= 1.00005;

            // Ball collision logic
            if (gameObjects.ball.position.y > 5 || gameObjects.ball.position.y < -5) {
                ballVY = -ballVY;
            }

            // Ball and paddle collision
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

            // Paddle misses the ball
            if (gameObjects.ball.position.x < -6) {
                scoreP2int++;
                scoreP2.textContent = scoreP2int.toString();
                gameObjects.ball.position.x = 0;
                gameObjects.ball.position.y = 0;
            } else if (gameObjects.ball.position.x > 6) {
                scoreP1int++;
                scoreP1.textContent = scoreP1int.toString();
                gameObjects.ball.position.x = 0;
                gameObjects.ball.position.y = 0;
            }

            // Check winner
            if (scoreP1int >= 10 || scoreP2int >= 10) {
                setTimeout(() => endGame(true), 0);
            }
        });
        // cleanup & end logic & evenlisteners

        let hasEnded = false;

        const cleanup = () => {
            clearInterval(keyboardIntervalP1);
            clearInterval(keyboardIntervalP2);
            window.removeEventListener("keydown", keyDownHandler);
            window.removeEventListener("keyup", keyUpHandler);
            window.removeEventListener("beforeunload", browserExitHandler);
            window.removeEventListener("pagehide", browserExitHandler);
            window.removeEventListener("popstate", browserExitHandler);
            scene.onBeforeRenderObservable.remove(renderObserver);
            disposeCurrentEngine()
            document.getElementById('renderCanvas')?.remove();
        };

        const endGame = (showWinnerMessage = false) => {
            if (hasEnded) return;
            hasEnded = true;
            cleanup();

            if (showWinnerMessage && !tournament) {
                showMessage(scoreP1int >= 10 ? "AI wins!" : "You win!");
                navigate('/pong')
            }

            resolve();
        };

        const browserExitHandler = () => {
            endGame(false);
        };

        // Ensure the match ends cleanly when user refreshes or navigates back.
        window.addEventListener("beforeunload", browserExitHandler);
        window.addEventListener("pagehide", browserExitHandler);
        window.addEventListener("popstate", browserExitHandler);

    });
}
