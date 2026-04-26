import "../../styles.css";
import { showMessage } from "../../utils/utils.js"
import { handleRoute, navigate } from "../../routes/route_helpers.js";
import { currentEngine, disposeCurrentEngine, resizeListener } from "../../routes/routes.js";

export function initOfflineGame(scene, gameObjects, tournament) {
    return new Promise((resolve) => {
        const defaultPhysics = {
            initialSpeed: 0.04,
            speedAccelBase: 1.000001,
            speedMax: 0.18,
            magnusCoefficient: 0.0008,
            magnusExtraFactor: 40,
            spinDecay: 0.992,
            visualSpinFactor: 100,
            wallLimitY: 5,
            wallSpinRetention: 0.7,
            paddleCollisionDepth: 0.25,
            paddleCollisionHeight: 0.75,
            spinTransferCoefficient: 1.5,
            velocityTransfer: 0.11,
            paddleBounds: 4.5,
            leftPaddleStep: 0.35,
            rightPaddleStep: 0.35,
            mouseFollowFactor: 0.15,
        };
        const physics = { ...defaultPhysics };

        let ballVX = physics.initialSpeed;
        let ballVY = physics.initialSpeed;
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

        const sliderConfigs = [
            { key: "initialSpeed", label: "Initial Speed", min: 0.005, max: 0.2, step: 0.001 },
            { key: "speedAccelBase", label: "Speed Accel", min: 1.0, max: 1.01, step: 0.000001 },
            { key: "speedMax", label: "Max Speed", min: 0.03, max: 0.5, step: 0.001 },
            { key: "magnusCoefficient", label: "Magnus Coef", min: 0, max: 0.01, step: 0.0001 },
            { key: "magnusExtraFactor", label: "Magnus Boost", min: 0, max: 100, step: 1 },
            { key: "spinDecay", label: "Spin Decay", min: 0.9, max: 1.0, step: 0.0001 },
            { key: "visualSpinFactor", label: "Spin Visual", min: 0, max: 250, step: 1 },
            { key: "wallLimitY", label: "Wall Y", min: 3.5, max: 7, step: 0.1 },
            { key: "wallSpinRetention", label: "Wall Spin Keep", min: 0, max: 1, step: 0.01 },
            { key: "paddleCollisionDepth", label: "Paddle Depth", min: 0.05, max: 0.8, step: 0.01 },
            { key: "paddleCollisionHeight", label: "Paddle Height Hitbox", min: 0.2, max: 1.6, step: 0.01 },
            { key: "spinTransferCoefficient", label: "Spin Transfer", min: 0, max: 4, step: 0.01 },
            { key: "velocityTransfer", label: "Velocity Transfer", min: 0, max: 0.5, step: 0.001 },
            { key: "paddleBounds", label: "Paddle Y Limit", min: 2.5, max: 6, step: 0.1 },
            { key: "leftPaddleStep", label: "Left Paddle Step", min: 0.05, max: 1.5, step: 0.01 },
            { key: "rightPaddleStep", label: "Right Paddle Step", min: 0.05, max: 1.5, step: 0.01 },
            { key: "mouseFollowFactor", label: "Mouse Follow", min: 0.01, max: 1, step: 0.01 },
        ];

        const makeValueFormatter = (step) => {
            const stepString = String(step);
            const decimals = stepString.includes(".") ? stepString.split(".")[1].length : 0;
            return (value) => Number(value).toFixed(decimals);
        };

        const createPhysicsPanel = () => {
            const gameContainer = document.getElementById("gameContainer") || document.getElementById("app-root");
            if (!gameContainer) return null;

            const panel = document.createElement("div");
            panel.id = "localPhysicsPanel";
            panel.style.position = "absolute";
            panel.style.left = "16px";
            panel.style.bottom = "16px";
            panel.style.zIndex = "35";
            panel.style.width = "320px";
            panel.style.maxHeight = "65vh";
            panel.style.overflowY = "auto";
            panel.style.padding = "12px";
            panel.style.border = "1px solid rgba(56, 189, 248, 0.5)";
            panel.style.borderRadius = "12px";
            panel.style.background = "rgba(2, 6, 23, 0.8)";
            panel.style.backdropFilter = "blur(6px)";
            panel.style.pointerEvents = "auto";
            panel.style.color = "#e2e8f0";
            panel.style.fontFamily = "monospace";
            panel.style.fontSize = "12px";
            panel.style.userSelect = "none";

            const title = document.createElement("div");
            title.textContent = "Local Physics";
            title.style.fontWeight = "700";
            title.style.marginBottom = "8px";
            title.style.letterSpacing = "0.04em";
            panel.appendChild(title);

            const dragBar = document.createElement("div");
            dragBar.textContent = "Drag";
            dragBar.style.cursor = "move";
            dragBar.style.marginBottom = "10px";
            dragBar.style.padding = "6px 8px";
            dragBar.style.background = "rgba(30, 41, 59, 0.9)";
            dragBar.style.border = "1px solid rgba(148, 163, 184, 0.45)";
            dragBar.style.borderRadius = "8px";
            dragBar.style.textAlign = "center";
            panel.appendChild(dragBar);

            let isDragging = false;
            let dragOffsetX = 0;
            let dragOffsetY = 0;

            const onDragMove = (event) => {
                if (!isDragging) return;
                panel.style.left = `${Math.max(0, event.clientX - dragOffsetX)}px`;
                panel.style.top = `${Math.max(0, event.clientY - dragOffsetY)}px`;
                panel.style.bottom = "auto";
            };

            const onDragUp = () => {
                isDragging = false;
            };

            dragBar.addEventListener("pointerdown", (event) => {
                const rect = panel.getBoundingClientRect();
                isDragging = true;
                dragOffsetX = event.clientX - rect.left;
                dragOffsetY = event.clientY - rect.top;
                dragBar.setPointerCapture(event.pointerId);
            });

            dragBar.addEventListener("pointermove", onDragMove);
            dragBar.addEventListener("pointerup", onDragUp);
            dragBar.addEventListener("pointercancel", onDragUp);

            sliderConfigs.forEach((config) => {
                const row = document.createElement("div");
                row.style.marginBottom = "8px";

                const topLine = document.createElement("div");
                topLine.style.display = "flex";
                topLine.style.justifyContent = "space-between";
                topLine.style.alignItems = "center";

                const label = document.createElement("label");
                label.textContent = config.label;
                label.style.color = "#93c5fd";

                const value = document.createElement("span");
                const format = makeValueFormatter(config.step);
                value.textContent = format(physics[config.key]);

                topLine.appendChild(label);
                topLine.appendChild(value);

                const input = document.createElement("input");
                input.type = "range";
                input.min = String(config.min);
                input.max = String(config.max);
                input.step = String(config.step);
                input.value = String(physics[config.key]);
                input.style.width = "100%";

                input.addEventListener("input", () => {
                    const parsed = Number(input.value);
                    physics[config.key] = parsed;
                    value.textContent = format(parsed);
                });

                row.appendChild(topLine);
                row.appendChild(input);
                panel.appendChild(row);
            });

            const actions = document.createElement("div");
            actions.style.display = "flex";
            actions.style.justifyContent = "flex-end";

            const resetBtn = document.createElement("button");
            resetBtn.type = "button";
            resetBtn.textContent = "Reset Defaults";
            resetBtn.style.padding = "6px 8px";
            resetBtn.style.borderRadius = "6px";
            resetBtn.style.border = "1px solid rgba(34, 197, 94, 0.5)";
            resetBtn.style.background = "rgba(20, 83, 45, 0.8)";
            resetBtn.style.color = "#dcfce7";
            resetBtn.style.cursor = "pointer";

            resetBtn.addEventListener("click", () => {
                sliderConfigs.forEach((config) => {
                    physics[config.key] = defaultPhysics[config.key];
                });

                const allInputs = panel.querySelectorAll("input[type='range']");
                allInputs.forEach((element, index) => {
                    const cfg = sliderConfigs[index];
                    const format = makeValueFormatter(cfg.step);
                    element.value = String(defaultPhysics[cfg.key]);
                    const valueLabel = element.previousSibling?.lastChild;
                    if (valueLabel && valueLabel.nodeType === Node.ELEMENT_NODE) {
                        valueLabel.textContent = format(defaultPhysics[cfg.key]);
                    }
                });
            });

            actions.appendChild(resetBtn);
            panel.appendChild(actions);

            gameContainer.appendChild(panel);
            return panel;
        };

        const physicsPanel = createPhysicsPanel();

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
                if (keys['w']) y = physics.leftPaddleStep;
                if (keys['s']) y = -physics.leftPaddleStep;
                gameObjects.paddleLeft.position.y += y;
                
                // Keep within bounds
                gameObjects.paddleLeft.position.y = Math.max(-physics.paddleBounds, Math.min(physics.paddleBounds, gameObjects.paddleLeft.position.y));
            }
            
            // Right paddle - Arrow keys OR mouse (mouse takes priority)
            if (mouseControlledPaddleY !== null) {
                // Smooth interpolation to mouse position
                const targetY = Math.max(-physics.paddleBounds, Math.min(physics.paddleBounds, mouseControlledPaddleY));
                const diff = targetY - gameObjects.paddleRight.position.y;
                gameObjects.paddleRight.position.y += diff * physics.mouseFollowFactor;
            } else if (keys['ArrowUp'] || keys['ArrowDown']) {
                let y = 0;
                if (keys['ArrowUp']) y = physics.rightPaddleStep;
                if (keys['ArrowDown']) y = -physics.rightPaddleStep;
                gameObjects.paddleRight.position.y += y;
                
                // Keep within bounds
                gameObjects.paddleRight.position.y = Math.max(-physics.paddleBounds, Math.min(physics.paddleBounds, gameObjects.paddleRight.position.y));
            }
        }, 1000 / 60); // Increased from 15 to 60 fps for smoother movement

        const renderObserver = scene.onBeforeRenderObservable.add(() => {
            // Calculate delta time for frame-independent physics
            const currentTime = Date.now();
            const dt = (currentTime - lastFrameTime) / 16.67; // Normalize to 60fps
            lastFrameTime = currentTime;
            
            // Magnus effect: spin creates perpendicular force
            // In real ping pong, topspin makes ball curve downward, backspin upward
            const spinForce = -ballSpin * physics.magnusCoefficient * physics.magnusExtraFactor * dt;
            ballVY += spinForce;
            
            // Air resistance causes spin to decay
            ballSpin *= Math.pow(physics.spinDecay, dt);
            
            // Visual rotation based on spin (rotate around Z axis)
            gameObjects.ball.rotation.z += ballSpin * physics.magnusCoefficient * physics.magnusExtraFactor * physics.visualSpinFactor * dt;
            
            // Update ball position
            gameObjects.ball.position.x += ballVX * dt;
            gameObjects.ball.position.y += ballVY * dt;
            
            // Gradual speed increase (uses config)
            const speedIncrease = Math.pow(physics.speedAccelBase, dt);
            ballVX *= speedIncrease;
            ballVY *= speedIncrease;

            // Clamp maximum speed (resultant velocity)
            const currentSpeed = Math.hypot(ballVX, ballVY);
            if (currentSpeed > physics.speedMax && currentSpeed > 0) {
                const scale = physics.speedMax / currentSpeed;
                ballVX *= scale;
                ballVY *= scale;
            }

            // Ball collision with top/bottom walls
            if (gameObjects.ball.position.y > physics.wallLimitY || gameObjects.ball.position.y < -physics.wallLimitY) {
                ballVY = -ballVY;
                // Wall bounce reduces spin by 30%
                ballSpin *= physics.wallSpinRetention;
            }

            // Calculate paddle velocities (in units per frame)
            const paddleLeftVel = (gameObjects.paddleLeft.position.y - paddleLeftPrevY) / dt;
            const paddleRightVel = (gameObjects.paddleRight.position.y - paddleRightPrevY) / dt;
            paddleLeftPrevY = gameObjects.paddleLeft.position.y;
            paddleRightPrevY = gameObjects.paddleRight.position.y;
            
            // Left paddle collision
            if (gameObjects.ball.position.x < gameObjects.paddleLeft.position.x + physics.paddleCollisionDepth &&
                gameObjects.ball.position.x > gameObjects.paddleLeft.position.x &&
                Math.abs(gameObjects.ball.position.y - gameObjects.paddleLeft.position.y) < physics.paddleCollisionHeight) {
                
                // Simple bounce (no angle effect)
                ballVX = -ballVX;
                
                // SPIN PHYSICS: Fast perpendicular paddle movement creates spin
                // Upward paddle movement = topspin (positive)
                // Downward paddle movement = backspin (negative)
                ballSpin = paddleLeftVel * physics.spinTransferCoefficient;
                
                // Paddle movement also slightly affects ball's vertical velocity
                ballVY += paddleLeftVel * physics.velocityTransfer;
            }
            
            // Right paddle collision
            if (gameObjects.ball.position.x > gameObjects.paddleRight.position.x - physics.paddleCollisionDepth &&
                gameObjects.ball.position.x < gameObjects.paddleRight.position.x &&
                Math.abs(gameObjects.ball.position.y - gameObjects.paddleRight.position.y) < physics.paddleCollisionHeight) {
                
                // Simple bounce (no angle effect)
                ballVX = -ballVX;
                
                // SPIN PHYSICS: Transfer spin from paddle velocity
                ballSpin = paddleRightVel * physics.spinTransferCoefficient;
                
                // Paddle movement affects ball's vertical velocity
                ballVY += paddleRightVel * physics.velocityTransfer;
            }

            if (gameObjects.ball.position.x < -6) {
                scoreP2int++;
                scoreP2.textContent = scoreP2int.toString();
                gameObjects.ball.position.x = 0;
                gameObjects.ball.position.y = 0;
                ballSpin = 0; // Reset spin
                ballVX = physics.initialSpeed;
                ballVY = physics.initialSpeed;
            } else if (gameObjects.ball.position.x > 6) {
                scoreP1int++;
                scoreP1.textContent = scoreP1int.toString();
                gameObjects.ball.position.x = 0;
                gameObjects.ball.position.y = 0;
                ballSpin = 0; // Reset spin
                ballVX = -physics.initialSpeed;
                ballVY = physics.initialSpeed;
            }

            // Check winner
            if (scoreP1int >= 10 || scoreP2int >= 10) {
                setTimeout(() => endGame(true), 0);
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
            physicsPanel?.remove();
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
