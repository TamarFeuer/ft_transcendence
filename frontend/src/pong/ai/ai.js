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
            const ballY = gameObjects.ball.position.y;

            // AI tries to move paddle towards ball
            const difference = ballY - paddleY;
            const direction = difference > 0 ? 1 : -1;

            if (gameObjects.ball.position.x < 0 && Math.abs(difference) > 0.5) {
                // Current energy (distance from ball)
                const currentEnergy = Math.abs(difference);

                // Propose a random move
                const proposedMove = Math.random() < 0.5 ? 0.8 : -0.8;
                const newY = paddleY + proposedMove;
                const newEnergy = Math.abs(ballY - newY);

                // Energy difference (negative = improvement)
                const deltaE = newEnergy - currentEnergy;

                // Acceptance probability: always accept improvements,
                // sometimes accept worse moves based on temperature
                const acceptProbability = deltaE < 0 ? 1.0 : Math.exp(-deltaE / gameObjects.temperature);

                // Accept or reject the move
                if (Math.random() < acceptProbability) {
                    // Move the paddle if the move makes and improvement, if not wait for the next iteration to try again
                    if ((newY - paddleY) * direction > 0) {
                    gameObjects.paddleLeft.position.y = newY;
                    }
                }

                // Cool down
                gameObjects.temperature *= 0.99;
                if (gameObjects.temperature < 0.5) {
                    gameObjects.temperature = 0.5;
                }
            }

            // Keep paddle within bounds
            if (gameObjects.paddleRight.position.y > 4.5) {
                gameObjects.paddleRight.position.y = 4.5;
            }
            if (gameObjects.paddleRight.position.y < -4.5) {
                gameObjects.paddleRight.position.y = -4.5;

            }
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
                endGame(true);
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
                showMessage(scoreP1int >= 10 ? "Player 1 wins!" : "Player 2 wins!");
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
