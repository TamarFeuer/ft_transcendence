import "../../styles.css";
import { showMessage } from "../../utils/utils.js"
import { handleRoute, navigate } from "../../routes/route_helpers.js";
import { currentEngine, disposeCurrentEngine, resizeListener } from "../../routes/routes.js";
import { MeshBuilder, StandardMaterial, Color3, Vector3 } from "@babylonjs/core";

export function initOfflineGame(scene, gameObjects, tournament) {
    return new Promise((resolve) => {
        const defaultPhysics = {
            initialSpeedX: 0.12,
            initialLateralSpeedZ: 0.015,
            initialUpwardSpeedY: 0.09,
            speedMultiplier: 0.999,
            speedMax: 0.24,
            gravity: 0.0042,
            magnusCoefficient: 0.0008,
            magnusExtraFactor: 40,
            spinDecay: 0.992,
            visualSpinFactor: 100,
            tableTopY: 0,
            tableHalfLength: 5.3,
            tableHalfWidth: 2.95,
            tableBounceRestitution: 0.9,
            tableBounceFriction: 0.985,
            sideWallRestitution: 0.92,
            sideWallSpinRetention: 0.9,
            netHeight: 0.85,
            netHalfThickness: 0.05,
            netBounceDamping: 0.6,
            netSpinRetention: 0.75,
            floorY: -2,
            goalX: 6.3,
            paddleCollisionDepth: 0.35,
            paddleCollisionHeight: 0.8,
            paddleCollisionWidth: 0.75,
            spinTransferCoefficient: 1.5,
            velocityTransfer: 0.11,
            paddleBounceBoost: 1.02,
            paddleY: 0.65,
            paddleBoundsZ: 2.5,
            leftPaddleStep: 0.35,
            rightPaddleStep: 0.35,
            mouseFollowFactor: 0.15,
        };
        const physics = { ...defaultPhysics };

        let ballVX = physics.initialSpeedX;
        let ballVY = physics.initialUpwardSpeedY;
        let ballVZ = physics.initialLateralSpeedZ;
        let ballSpin = 0; // Angular velocity (positive = topspin, negative = backspin)
        let scoreP1int = 0;
        let scoreP2int = 0;
        
        // Track paddle positions for velocity calculation (z-axis in 3D table view)
        let paddleLeftPrevZ = gameObjects.paddleLeft.position.z;
        let paddleRightPrevZ = gameObjects.paddleRight.position.z;
        let lastFrameTime = Date.now();

        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        const randomSign = () => (Math.random() > 0.5 ? 1 : -1);

        const positionPaddles = () => {
            gameObjects.paddleLeft.position.x = -4.95;
            gameObjects.paddleRight.position.x = 4.95;
            gameObjects.paddleLeft.position.y = physics.paddleY;
            gameObjects.paddleRight.position.y = physics.paddleY;
            gameObjects.paddleLeft.position.z = clamp(gameObjects.paddleLeft.position.z, -physics.paddleBoundsZ, physics.paddleBoundsZ);
            gameObjects.paddleRight.position.z = clamp(gameObjects.paddleRight.position.z, -physics.paddleBoundsZ, physics.paddleBoundsZ);
        };

        const resetBall = (serveDirection = 1) => {
            gameObjects.ball.position.x = 0;
            gameObjects.ball.position.y = physics.tableTopY + 0.4;
            gameObjects.ball.position.z = 0;
            ballSpin = 0;
            ballVX = physics.initialSpeedX * serveDirection;
            ballVY = physics.initialUpwardSpeedY;
            ballVZ = physics.initialLateralSpeedZ * randomSign();
        };

        const createTableArena = () => {
            const tableMat = new StandardMaterial("localTableMat", scene);
            tableMat.diffuseColor = new Color3(0.06, 0.22, 0.36);

            const lineMat = new StandardMaterial("localTableLineMat", scene);
            lineMat.diffuseColor = new Color3(0.95, 0.95, 0.95);

            const netMat = new StandardMaterial("localNetMat", scene);
            netMat.diffuseColor = new Color3(0.92, 0.92, 0.95);

            const floorMat = new StandardMaterial("localFloorMat", scene);
            floorMat.diffuseColor = new Color3(0.08, 0.1, 0.14);

            const table = MeshBuilder.CreateBox("localPongTable", {
                width: physics.tableHalfLength * 2,
                height: 0.16,
                depth: physics.tableHalfWidth * 2,
            }, scene);
            table.position = new Vector3(0, physics.tableTopY - 0.08, 0);
            table.material = tableMat;

            const centerLine = MeshBuilder.CreateBox("localPongCenterLine", {
                width: physics.tableHalfLength * 2,
                height: 0.01,
                depth: 0.02,
            }, scene);
            centerLine.position = new Vector3(0, physics.tableTopY + 0.085, 0);
            centerLine.material = lineMat;

            const sideLineLeft = MeshBuilder.CreateBox("localPongSideLineLeft", {
                width: physics.tableHalfLength * 2,
                height: 0.01,
                depth: 0.02,
            }, scene);
            sideLineLeft.position = new Vector3(0, physics.tableTopY + 0.085, physics.tableHalfWidth - 0.06);
            sideLineLeft.material = lineMat;

            const sideLineRight = MeshBuilder.CreateBox("localPongSideLineRight", {
                width: physics.tableHalfLength * 2,
                height: 0.01,
                depth: 0.02,
            }, scene);
            sideLineRight.position = new Vector3(0, physics.tableTopY + 0.085, -physics.tableHalfWidth + 0.06);
            sideLineRight.material = lineMat;

            const net = MeshBuilder.CreateBox("localPongNet", {
                width: physics.netHalfThickness * 2,
                height: physics.netHeight,
                depth: physics.tableHalfWidth * 2 - 0.08,
            }, scene);
            net.position = new Vector3(0, physics.tableTopY + physics.netHeight / 2, 0);
            net.material = netMat;

            const floor = MeshBuilder.CreateGround("localPongFloor", { width: 22, height: 14 }, scene);
            floor.position.y = physics.floorY;
            floor.material = floorMat;

            return { table, centerLine, sideLineLeft, sideLineRight, net, floor };
        };

        positionPaddles();
        resetBall(1);

        if (scene.activeCamera) {
            scene.activeCamera.alpha = -Math.PI / 2;
            scene.activeCamera.beta = Math.PI / 3;
            scene.activeCamera.radius = 14;
            scene.activeCamera.setTarget(new Vector3(0, physics.tableTopY + 0.5, 0));
        }

        const arenaMeshes = createTableArena();

        const scoreP1 = document.getElementById("scoreP1");
        const scoreP2 = document.getElementById("scoreP2");
        scoreP1.textContent = "0";
        scoreP2.textContent = "0";

        const sliderConfigs = [
            { key: "initialSpeedX", label: "Initial Speed X", min: 0.02, max: 0.3, step: 0.001 },
            { key: "initialLateralSpeedZ", label: "Initial Speed Z", min: 0, max: 0.15, step: 0.001 },
            { key: "initialUpwardSpeedY", label: "Initial Speed Y", min: 0, max: 0.2, step: 0.001 },
            { key: "speedMultiplier", label: "Speed Multiplier", min: 0.98, max: 1.01, step: 0.0001 },
            { key: "speedMax", label: "Max Speed", min: 0.03, max: 0.5, step: 0.001 },
            { key: "gravity", label: "Gravity", min: 0, max: 0.02, step: 0.0001 },
            { key: "magnusCoefficient", label: "Magnus Coef", min: 0, max: 0.01, step: 0.0001 },
            { key: "magnusExtraFactor", label: "Magnus Boost", min: 0, max: 100, step: 1 },
            { key: "spinDecay", label: "Spin Decay", min: 0.9, max: 1.0, step: 0.0001 },
            { key: "visualSpinFactor", label: "Spin Visual", min: 0, max: 250, step: 1 },
            { key: "tableBounceRestitution", label: "Table Restitution", min: 0, max: 1.3, step: 0.01 },
            { key: "tableBounceFriction", label: "Table Friction", min: 0.8, max: 1, step: 0.001 },
            { key: "sideWallRestitution", label: "Side Wall Restitution", min: 0, max: 1.3, step: 0.01 },
            { key: "sideWallSpinRetention", label: "Side Wall Spin Keep", min: 0, max: 1, step: 0.01 },
            { key: "netBounceDamping", label: "Net Damping", min: 0, max: 1, step: 0.01 },
            { key: "netSpinRetention", label: "Net Spin Keep", min: 0, max: 1, step: 0.01 },
            { key: "paddleCollisionDepth", label: "Paddle Depth", min: 0.05, max: 0.8, step: 0.01 },
            { key: "paddleCollisionHeight", label: "Paddle Height Hitbox", min: 0.2, max: 1.6, step: 0.01 },
            { key: "paddleCollisionWidth", label: "Paddle Width Hitbox", min: 0.2, max: 1.6, step: 0.01 },
            { key: "spinTransferCoefficient", label: "Spin Transfer", min: 0, max: 4, step: 0.01 },
            { key: "velocityTransfer", label: "Velocity Transfer", min: 0, max: 0.5, step: 0.001 },
            { key: "paddleBounceBoost", label: "Paddle Bounce Boost", min: 0.8, max: 1.3, step: 0.01 },
            { key: "paddleBoundsZ", label: "Paddle Z Limit", min: 0.8, max: 3, step: 0.1 },
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
        let mouseControlledPaddleZ = null; // Track mouse position for right paddle

        // Handlers
        const keyDownHandler = (e) => keys[e.key] = true;
        const keyUpHandler = (e) => keys[e.key] = false;
        
        // Mouse control for right paddle
        const pointerMoveHandler = (e) => {
            // Normalize mouse Y position to table z coordinates
            const normalized = 1 - (e.clientY / window.innerHeight); // 0 to 1
            mouseControlledPaddleZ = (normalized - 0.5) * (physics.tableHalfWidth * 2);
        };

        window.addEventListener("keydown", keyDownHandler);
        window.addEventListener("keyup", keyUpHandler);
        window.addEventListener("pointermove", pointerMoveHandler);
                
        // Smoother keyboard controls with higher frequency and smaller steps
        const keyboardInterval = setInterval(() => {
            // Left paddle - W/S keys
            if (keys['w'] || keys['s']) {
                let z = 0;
                if (keys['w']) z = physics.leftPaddleStep;
                if (keys['s']) z = -physics.leftPaddleStep;
                gameObjects.paddleLeft.position.z += z;
                
                // Keep within bounds
                gameObjects.paddleLeft.position.z = clamp(gameObjects.paddleLeft.position.z, -physics.paddleBoundsZ, physics.paddleBoundsZ);
            }
            
            // Right paddle - Arrow keys OR mouse (mouse takes priority)
            if (mouseControlledPaddleZ !== null) {
                // Smooth interpolation to mouse position
                const targetZ = clamp(mouseControlledPaddleZ, -physics.paddleBoundsZ, physics.paddleBoundsZ);
                const diff = targetZ - gameObjects.paddleRight.position.z;
                gameObjects.paddleRight.position.z += diff * physics.mouseFollowFactor;
            } else if (keys['ArrowUp'] || keys['ArrowDown']) {
                let z = 0;
                if (keys['ArrowUp']) z = physics.rightPaddleStep;
                if (keys['ArrowDown']) z = -physics.rightPaddleStep;
                gameObjects.paddleRight.position.z += z;
                
                // Keep within bounds
                gameObjects.paddleRight.position.z = clamp(gameObjects.paddleRight.position.z, -physics.paddleBoundsZ, physics.paddleBoundsZ);
            }

            gameObjects.paddleLeft.position.y = physics.paddleY;
            gameObjects.paddleRight.position.y = physics.paddleY;
        }, 1000 / 60); // Increased from 15 to 60 fps for smoother movement

        const renderObserver = scene.onBeforeRenderObservable.add(() => {
            // Calculate delta time for frame-independent physics
            const currentTime = Date.now();
            const dt = (currentTime - lastFrameTime) / 16.67; // Normalize to 60fps
            lastFrameTime = currentTime;
            
            // Gravity + spin-driven lift/force.
            ballVY -= physics.gravity * dt;
            const spinForce = -ballSpin * physics.magnusCoefficient * physics.magnusExtraFactor * dt;
            ballVY += spinForce;
            
            // Air resistance causes spin to decay
            ballSpin *= Math.pow(physics.spinDecay, dt);
            
            // Visual rotation based on spin.
            gameObjects.ball.rotation.z += ballSpin * physics.magnusCoefficient * physics.magnusExtraFactor * physics.visualSpinFactor * dt;
            
            // Update ball position
            gameObjects.ball.position.x += ballVX * dt;
            gameObjects.ball.position.y += ballVY * dt;
            gameObjects.ball.position.z += ballVZ * dt;
            
            // General speed scaling (drag/boost).
            const speedScale = Math.pow(physics.speedMultiplier, dt);
            ballVX *= speedScale;
            ballVY *= speedScale;
            ballVZ *= speedScale;

            // Clamp maximum speed (resultant velocity)
            const currentSpeed = Math.hypot(ballVX, ballVY, ballVZ);
            if (currentSpeed > physics.speedMax && currentSpeed > 0) {
                const scale = physics.speedMax / currentSpeed;
                ballVX *= scale;
                ballVY *= scale;
                ballVZ *= scale;
            }

            // Side rail bounce on table width.
            if (Math.abs(gameObjects.ball.position.z) > physics.tableHalfWidth) {
                gameObjects.ball.position.z = clamp(gameObjects.ball.position.z, -physics.tableHalfWidth, physics.tableHalfWidth);
                ballVZ = -ballVZ * physics.sideWallRestitution;
                ballSpin *= physics.sideWallSpinRetention;
            }

            // Ball-net collision.
            const insideNetHeight = gameObjects.ball.position.y - 0.15 < physics.tableTopY + physics.netHeight;
            const insideNetDepth = Math.abs(gameObjects.ball.position.z) < physics.tableHalfWidth;
            if (Math.abs(gameObjects.ball.position.x) < physics.netHalfThickness && insideNetHeight && insideNetDepth) {
                const netSide = gameObjects.ball.position.x >= 0 ? 1 : -1;
                gameObjects.ball.position.x = netSide * physics.netHalfThickness;
                ballVX = -ballVX * physics.netBounceDamping;
                ballVY *= physics.netBounceDamping;
                ballVZ *= physics.netBounceDamping;
                ballSpin *= physics.netSpinRetention;
            }

            // Bounce on table top.
            const ballRadius = 0.15;
            const overTableX = Math.abs(gameObjects.ball.position.x) <= physics.tableHalfLength;
            const overTableZ = Math.abs(gameObjects.ball.position.z) <= physics.tableHalfWidth;
            const touchesTable = gameObjects.ball.position.y - ballRadius <= physics.tableTopY;
            if (touchesTable && overTableX && overTableZ && ballVY < 0) {
                gameObjects.ball.position.y = physics.tableTopY + ballRadius;
                ballVY = -ballVY * physics.tableBounceRestitution;
                ballVX *= physics.tableBounceFriction;
                ballVZ *= physics.tableBounceFriction;
            }

            // Lost point if ball drops below floor outside playable bounce.
            if (gameObjects.ball.position.y < physics.floorY) {
                if (gameObjects.ball.position.x < 0) {
                    scoreP2int++;
                    scoreP2.textContent = scoreP2int.toString();
                    resetBall(1);
                } else {
                    scoreP1int++;
                    scoreP1.textContent = scoreP1int.toString();
                    resetBall(-1);
                }
            }

            // Calculate paddle velocities (in units per frame) on z-axis.
            const paddleLeftVelZ = (gameObjects.paddleLeft.position.z - paddleLeftPrevZ) / Math.max(dt, 0.0001);
            const paddleRightVelZ = (gameObjects.paddleRight.position.z - paddleRightPrevZ) / Math.max(dt, 0.0001);
            paddleLeftPrevZ = gameObjects.paddleLeft.position.z;
            paddleRightPrevZ = gameObjects.paddleRight.position.z;

            // Left paddle collision in 3D.
            if (ballVX < 0 &&
                gameObjects.ball.position.x < gameObjects.paddleLeft.position.x + physics.paddleCollisionDepth &&
                gameObjects.ball.position.x > gameObjects.paddleLeft.position.x - physics.paddleCollisionDepth &&
                Math.abs(gameObjects.ball.position.y - gameObjects.paddleLeft.position.y) < physics.paddleCollisionHeight &&
                Math.abs(gameObjects.ball.position.z - gameObjects.paddleLeft.position.z) < physics.paddleCollisionWidth) {

                gameObjects.ball.position.x = gameObjects.paddleLeft.position.x + physics.paddleCollisionDepth;
                ballVX = Math.abs(ballVX) * physics.paddleBounceBoost;
                ballSpin = paddleLeftVelZ * physics.spinTransferCoefficient;
                ballVZ += paddleLeftVelZ * physics.velocityTransfer;
            }
            
            // Right paddle collision in 3D.
            if (ballVX > 0 &&
                gameObjects.ball.position.x > gameObjects.paddleRight.position.x - physics.paddleCollisionDepth &&
                gameObjects.ball.position.x < gameObjects.paddleRight.position.x + physics.paddleCollisionDepth &&
                Math.abs(gameObjects.ball.position.y - gameObjects.paddleRight.position.y) < physics.paddleCollisionHeight &&
                Math.abs(gameObjects.ball.position.z - gameObjects.paddleRight.position.z) < physics.paddleCollisionWidth) {

                gameObjects.ball.position.x = gameObjects.paddleRight.position.x - physics.paddleCollisionDepth;
                ballVX = -Math.abs(ballVX) * physics.paddleBounceBoost;
                ballSpin = paddleRightVelZ * physics.spinTransferCoefficient;
                ballVZ += paddleRightVelZ * physics.velocityTransfer;
            }

            if (gameObjects.ball.position.x < -physics.goalX) {
                scoreP2int++;
                scoreP2.textContent = scoreP2int.toString();
                resetBall(1);
            } else if (gameObjects.ball.position.x > physics.goalX) {
                scoreP1int++;
                scoreP1.textContent = scoreP1int.toString();
                resetBall(-1);
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
            Object.values(arenaMeshes).forEach((mesh) => mesh?.dispose());
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
