import "../../styles.css";
import { showMessage } from "../../utils/utils.js"
import { handleRoute, navigate } from "../../routes/route_helpers.js";
import { currentEngine, disposeCurrentEngine, resizeListener } from "../../routes/routes.js";

export function initOfflineGame(scene, gameObjects, tournament) {
    return new Promise((resolve) => {
        // Speed configuration: tweak these to make the game slower/faster
        const SPEED_INITIAL = 0.04;       // starting speed (lower = slower)
        const SPEED_ACCEL_BASE = 1.000001; // per-frame accel base (1.0 = no growth)
        const SPEED_MAX = 0.18;           // cap max resultant speed

        let ballVX = SPEED_INITIAL;
        let ballVY = SPEED_INITIAL;
        let ballSpin = 0; // Angular velocity (positive = topspin, negative = backspin)
        let scoreP1int = 0;
        let scoreP2int = 0;
        
        // Track paddle positions for velocity calculation
        let paddleLeftPrevY = gameObjects.paddleLeft.position.y;
        let paddleRightPrevY = gameObjects.paddleRight.position.y;
        let lastFrameTime = Date.now();

        const scoreP1 = document.getElementById("scoreP1");
        const scoreP2 = document.getElementById("scoreP2");
        scoreP1.textContent = "0";
        scoreP2.textContent = "0";

        const keys = {};
        let mouseControlledPaddleY = null; // Track mouse position for right paddle

        // Handlers
        const keyDownHandler = (e) => keys[e.key] = true;
        const keyUpHandler = (e) => keys[e.key] = false;
        
        // Mouse control for right paddle
        const pointerMoveHandler = (e) => {
            // Normalize mouse Y position to game coordinates (-4 to 4)
            const normalized = 1 - (e.clientY / window.innerHeight); // 0 to 1
            mouseControlledPaddleY = (normalized - 0.5) * 8; // -4 to 4
        };

        window.addEventListener("keydown", keyDownHandler);
        window.addEventListener("keyup", keyUpHandler);
        window.addEventListener("pointermove", pointerMoveHandler);
                
        // Smoother keyboard controls with higher frequency and smaller steps
        const keyboardInterval = setInterval(() => {
            // Left paddle - W/S keys
            if (keys['w'] || keys['s']) {
                let y = 0;
                if (keys['w']) y = 0.35; // Reduced from 0.8 for smoother movement
                if (keys['s']) y = -0.35;
                gameObjects.paddleLeft.position.y += y;
                
                // Keep within bounds
                gameObjects.paddleLeft.position.y = Math.max(-4.5, Math.min(4.5, gameObjects.paddleLeft.position.y));
            }
            
            // Right paddle - Arrow keys OR mouse (mouse takes priority)
            if (mouseControlledPaddleY !== null) {
                // Smooth interpolation to mouse position
                const targetY = Math.max(-4.5, Math.min(4.5, mouseControlledPaddleY));
                const diff = targetY - gameObjects.paddleRight.position.y;
                gameObjects.paddleRight.position.y += diff * 0.15; // Smooth follow
            } else if (keys['ArrowUp'] || keys['ArrowDown']) {
                let y = 0;
                if (keys['ArrowUp']) y = 0.35; // Reduced from 0.8 for smoother movement
                if (keys['ArrowDown']) y = -0.35;
                gameObjects.paddleRight.position.y += y;
                
                // Keep within bounds
                gameObjects.paddleRight.position.y = Math.max(-4.5, Math.min(4.5, gameObjects.paddleRight.position.y));
            }
        }, 1000 / 60); // Increased from 15 to 60 fps for smoother movement

        const renderObserver = scene.onBeforeRenderObservable.add(() => {
            // Calculate delta time for frame-independent physics
            const currentTime = Date.now();
            const dt = (currentTime - lastFrameTime) / 16.67; // Normalize to 60fps
            lastFrameTime = currentTime;
            
            // Magnus effect: spin creates perpendicular force
            // In real ping pong, topspin makes ball curve downward, backspin upward
            const magnusCoefficient = 0.0008;
            const extra_factor = 40
            const spinForce = -ballSpin * magnusCoefficient  * extra_factor * dt;
            ballVY += spinForce;
            
            // Air resistance causes spin to decay
            const spinDecay = 0.992;
            ballSpin *= Math.pow(spinDecay, dt);
            
            // Visual rotation based on spin (rotate around Z axis)
            gameObjects.ball.rotation.z += ballSpin * magnusCoefficient * extra_factor * 100 * dt;
            
            // Update ball position
            gameObjects.ball.position.x += ballVX * dt;
            gameObjects.ball.position.y += ballVY * dt;
            
            // Gradual speed increase (uses config)
            const speedIncrease = Math.pow(SPEED_ACCEL_BASE, dt);
            ballVX *= speedIncrease;
            ballVY *= speedIncrease;

            // Clamp maximum speed (resultant velocity)
            const currentSpeed = Math.hypot(ballVX, ballVY);

            // Ball collision with top/bottom walls
            if (gameObjects.ball.position.y > 5 || gameObjects.ball.position.y < -5) {
                ballVY = -ballVY;
                // Wall bounce reduces spin by 30%
                ballSpin *= 0.7;
            }

            // Calculate paddle velocities (in units per frame)
            const paddleLeftVel = (gameObjects.paddleLeft.position.y - paddleLeftPrevY) / dt;
            const paddleRightVel = (gameObjects.paddleRight.position.y - paddleRightPrevY) / dt;
            paddleLeftPrevY = gameObjects.paddleLeft.position.y;
            paddleRightPrevY = gameObjects.paddleRight.position.y;
            
            // Left paddle collision
            if (gameObjects.ball.position.x < gameObjects.paddleLeft.position.x + 0.25 &&
                gameObjects.ball.position.x > gameObjects.paddleLeft.position.x &&
                Math.abs(gameObjects.ball.position.y - gameObjects.paddleLeft.position.y) < 0.75) {
                
                // Simple bounce (no angle effect)
                ballVX = -ballVX;
                
                // SPIN PHYSICS: Fast perpendicular paddle movement creates spin
                // Upward paddle movement = topspin (positive)
                // Downward paddle movement = backspin (negative)
                const spinTransferCoefficient = 1.5;
                ballSpin = paddleLeftVel * spinTransferCoefficient;
                
                // Paddle movement also slightly affects ball's vertical velocity
                const velocityTransfer = 0.11;
                ballVY += paddleLeftVel * velocityTransfer;
            }
            
            // Right paddle collision
            if (gameObjects.ball.position.x > gameObjects.paddleRight.position.x - 0.25 &&
                gameObjects.ball.position.x < gameObjects.paddleRight.position.x &&
                Math.abs(gameObjects.ball.position.y - gameObjects.paddleRight.position.y) < 0.75) {
                
                // Simple bounce (no angle effect)
                ballVX = -ballVX;
                
                // SPIN PHYSICS: Transfer spin from paddle velocity
                const spinTransferCoefficient = 1.5;
                ballSpin = paddleRightVel * spinTransferCoefficient;
                
                // Paddle movement affects ball's vertical velocity
                const velocityTransfer = 0.11;
                ballVY += paddleRightVel * velocityTransfer;
            }

            if (gameObjects.ball.position.x < -6) {
                scoreP2int++;
                scoreP2.textContent = scoreP2int.toString();
                gameObjects.ball.position.x = 0;
                gameObjects.ball.position.y = 0;
                ballSpin = 0; // Reset spin
                ballVX = SPEED_INITIAL;
                ballVY = SPEED_INITIAL;
            } else if (gameObjects.ball.position.x > 6) {
                scoreP1int++;
                scoreP1.textContent = scoreP1int.toString();
                gameObjects.ball.position.x = 0;
                gameObjects.ball.position.y = 0;
                ballSpin = 0; // Reset spin
                ballVX = -SPEED_INITIAL;
                ballVY = SPEED_INITIAL;
            }

            // Check winner
            if (scoreP1int >= 10 || scoreP2int >= 10) {
                endGame(true);
            }
        });

        let hasEnded = false;

        const cleanup = () => {
            clearInterval(keyboardInterval);
            window.removeEventListener("keydown", keyDownHandler);
            window.removeEventListener("keyup", keyUpHandler);
            window.removeEventListener("pointermove", pointerMoveHandler);
            window.removeEventListener("beforeunload", browserExitHandler);
            window.removeEventListener("pagehide", browserExitHandler);
            window.removeEventListener("popstate", browserExitHandler);
            scene.onBeforeRenderObservable.remove(renderObserver);
            disposeCurrentEngine();
            document.getElementById('renderCanvas')?.remove();
        };

        const endGame = (showWinnerMessage = false) => {
            if (hasEnded) return;
            hasEnded = true;
            cleanup();
            
            if (showWinnerMessage && !tournament) {
                showMessage(scoreP1int >= 10 ? "They win!" : "You win!");
                navigate('/pong');
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
