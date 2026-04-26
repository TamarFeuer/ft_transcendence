import "../../styles.css";
import { showMessage } from "../../utils/utils.js"
import { handleRoute, navigate } from "../../routes/route_helpers.js";
import { currentEngine, disposeCurrentEngine, resizeListener } from "../../routes/routes.js";
import { MeshBuilder, StandardMaterial, Color3, Vector3 } from "@babylonjs/core";

export function initOfflineGame(scene, gameObjects, tournament) {
    return new Promise((resolve) => {
        // These values are the live tuning knobs for the offline 3D pong model.
        // I keep them grouped so I can reason about ball travel, bounce feel, spin,
        // and paddle motion without hunting through the frame loop.
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
            // Collision dimensions are tuned to match the visible paddle face,
            // plus a small margin for the ball radius.
            paddleCollisionDepth: 0.2,
            paddleCollisionHeight: 0.9,
            paddleCollisionWidth: 0.45,
            spinTransferCoefficient: 1.5,
            velocityTransfer: 0.11,
            paddleBounceBoost: 1.02,
            paddleBaseY: 0.9,
            paddleBoundsZ: 2.5,
            paddleRotationStep: 0.06,
            paddleRotationLimit: 0.65,
            paddleTiltToVerticalVelocity: 0.12,
            paddleApproachBoost: 0.14,
            paddleRetreatDampingStrength: 0.2,
            paddleRetreatDampingMin: 0.65,
            paddleRotationLiftFromSpeed: 0.02,
            paddleStepZ: 0.28,
        };
        const physics = { ...defaultPhysics };

        // The paddles are placed at the two ends of the table on the X axis.
        const paddleLeftBaseX = -5.95;
        const paddleRightBaseX = 5.95;

        // Ball state is tracked directly in 3D world units.
        // X moves along the length of the table, Y is height, and Z is horizontal width.
        let ballVX = physics.initialSpeedX;
        let ballVY = physics.initialUpwardSpeedY;
        let ballVZ = physics.initialLateralSpeedZ;
        let ballSpin = 0;
        let scoreP1int = 0;
        let scoreP2int = 0;
        let paddleLeftRotationZ = 0;
        let paddleRightRotationZ = 0;
        let paddleLeftPrevRotationZ = 0;
        let paddleRightPrevRotationZ = 0;

        let paddleLeftPrevZ = gameObjects.paddleLeft.position.z;
        let paddleRightPrevZ = gameObjects.paddleRight.position.z;
        let lastFrameTime = Date.now();

        // Small helpers keep the frame loop readable.
        const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
        const randomSign = () => (Math.random() > 0.5 ? 1 : -1);

        const createPaddleVisual = (paddle, faceColor) => {
            // I build the visual paddle as a separate mesh so the collision body can
            // stay simple while the rendered shape looks closer to a real paddle.
            const faceMat = new StandardMaterial(`${paddle.name}FaceMat`, scene);
            faceMat.diffuseColor = faceColor;

            // A real paddle is mostly a flat square face, so I model it as a thin slab.
            const paddleFace = MeshBuilder.CreateBox(`${paddle.name}Face`, {
                width: 0.55,
                height: 1.55,
                depth: 0.12,
            }, scene);
            // Rotate the face 90 degrees so the thin side points toward the ball.
            paddleFace.rotation.y = Math.PI / 2;
            paddleFace.parent = paddle;

            paddleFace.material = faceMat;
            paddle.isVisible = false;
            return { paddleFace };
        };

        const positionPaddles = () => {
            // Each paddle starts locked to its end of the table, at the same height.
            gameObjects.paddleLeft.position.x = paddleLeftBaseX;
            gameObjects.paddleRight.position.x = paddleRightBaseX;
            gameObjects.paddleLeft.position.y = physics.paddleBaseY + 2;
            gameObjects.paddleRight.position.y = physics.paddleBaseY;
            gameObjects.paddleLeft.position.z = clamp(gameObjects.paddleLeft.position.z, -physics.paddleBoundsZ, physics.paddleBoundsZ);
            gameObjects.paddleRight.position.z = clamp(gameObjects.paddleRight.position.z, -physics.paddleBoundsZ, physics.paddleBoundsZ);
        };

        const resetBall = (serveDirection = 1) => {
            // I restart the rally from the middle of the table so the serve is predictable.
            gameObjects.ball.position.x = 4; // forward - backward axes
            gameObjects.ball.position.y = physics.tableTopY + 2; // up axes
            gameObjects.ball.position.z = 0; // left - right axes
            ballSpin = 0;
            ballVX = physics.initialSpeedX * serveDirection * 1.2;
            ballVY = physics.initialUpwardSpeedY * 0.5;
            ballVZ = physics.initialLateralSpeedZ * randomSign();
        };

        const createTableArena = () => {
            // Table surface, white boundary lines, a center net, and a dark floor plane
            // give the scene a proper table-tennis feel instead of floating objects.
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
            // I place the camera at the player's end of the table and aim it straight
            // down the length of the table so the view feels like sitting behind the paddle.
            scene.activeCamera.inputs.clear();
            scene.activeCamera.setPosition(new Vector3(-10.8, physics.tableTopY + 5.85, 0));
            scene.activeCamera.setTarget(new Vector3(0, physics.tableTopY + -1.0, 0));
        }

        const arenaMeshes = createTableArena();
        const leftPaddleVisual = createPaddleVisual(gameObjects.paddleLeft, new Color3(0.9, 0.2, 0.18));
        const rightPaddleVisual = createPaddleVisual(gameObjects.paddleRight, new Color3(0.18, 0.3, 0.95));

        const scoreP1 = document.getElementById("scoreP1");
        const scoreP2 = document.getElementById("scoreP2");
        scoreP1.textContent = "0";
        scoreP2.textContent = "0";

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
            { key: "tableBounceRestitution", label: "Table Restitution", min: 0, max: 1.3, step: 0.01 },
            { key: "tableBounceFriction", label: "Table Friction", min: 0.8, max: 1, step: 0.001 },
            { key: "sideWallRestitution", label: "Side Wall Restitution", min: 0, max: 1.3, step: 0.01 },
            { key: "sideWallSpinRetention", label: "Side Wall Spin Keep", min: 0, max: 1, step: 0.01 },
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
        ];

        const makeValueFormatter = (step) => {
            const stepString = String(step);
            const decimals = stepString.includes(".") ? stepString.split(".")[1].length : 0;
            return (value) => Number(value).toFixed(decimals);
        };

        const createPhysicsPanel = () => {
            // The sliders float over the game so I can tune the match while watching the rally.
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
        const keyDownHandler = (e) => keys[e.key.toLowerCase()] = true;
        const keyUpHandler = (e) => keys[e.key.toLowerCase()] = false;

        window.addEventListener("keydown", keyDownHandler);
        window.addEventListener("keyup", keyUpHandler);

        const keyboardInterval = setInterval(() => {
            // W/S and I/K now rotate the paddles instead of translating them on a second axis.
            if (keys['w']) paddleLeftRotationZ -= physics.paddleRotationStep;
            if (keys['s']) paddleLeftRotationZ += physics.paddleRotationStep;
            if (keys['i']) paddleRightRotationZ -= physics.paddleRotationStep;
            if (keys['k']) paddleRightRotationZ += physics.paddleRotationStep;

            // A/D and J/L are the only translation controls left, so each paddle can
            // slide horizontally across the face of the table but not vertically.
            if (keys['a']) gameObjects.paddleLeft.position.z -= physics.paddleStepZ;
            if (keys['d']) gameObjects.paddleLeft.position.z += physics.paddleStepZ;
            if (keys['j']) gameObjects.paddleRight.position.z -= physics.paddleStepZ;
            if (keys['l']) gameObjects.paddleRight.position.z += physics.paddleStepZ;

            // The paddles stay locked to one height so all player motion remains horizontal.
            gameObjects.paddleLeft.position.y = physics.paddleBaseY;
            gameObjects.paddleRight.position.y = physics.paddleBaseY;
            // Only Z translation is allowed now, so the paddles stay anchored to their end.
            gameObjects.paddleLeft.position.x = paddleLeftBaseX;
            gameObjects.paddleRight.position.x = paddleRightBaseX;
            gameObjects.paddleLeft.position.z = clamp(gameObjects.paddleLeft.position.z, -physics.paddleBoundsZ, physics.paddleBoundsZ);
            gameObjects.paddleRight.position.z = clamp(gameObjects.paddleRight.position.z, -physics.paddleBoundsZ, physics.paddleBoundsZ);

            // Clamp the rotation so the paddle can be angled, but not spun wildly.
            paddleLeftRotationZ = clamp(paddleLeftRotationZ, -physics.paddleRotationLimit, physics.paddleRotationLimit);
            paddleRightRotationZ = clamp(paddleRightRotationZ, -physics.paddleRotationLimit, physics.paddleRotationLimit);

            // Apply visible tilt around Z so paddles open/close upward/downward.
            gameObjects.paddleLeft.rotation.z = paddleLeftRotationZ;
            gameObjects.paddleRight.rotation.z = paddleRightRotationZ;
        }, 1000 / 60);

        const renderObserver = scene.onBeforeRenderObservable.add(() => {
            // I compute a frame delta so the physics stay stable even if the frame rate moves around.
            const currentTime = Date.now();
            const dt = (currentTime - lastFrameTime) / 16.67;
            lastFrameTime = currentTime;

            // Gravity pulls the ball down every frame, then spin can bend the path a bit.
            ballVY -= physics.gravity * dt;
            const spinForce = -ballSpin * physics.magnusCoefficient * physics.magnusExtraFactor * dt;
            ballVY += spinForce;

            // Spin slowly decays so the ball eventually settles instead of curving forever.
            ballSpin *= Math.pow(physics.spinDecay, dt);
            gameObjects.ball.rotation.z += ballSpin * physics.magnusCoefficient * physics.magnusExtraFactor * physics.visualSpinFactor * dt;

            // Move the ball through 3D space.
            gameObjects.ball.position.x += ballVX * dt;
            gameObjects.ball.position.y += ballVY * dt;
            gameObjects.ball.position.z += ballVZ * dt;

            // Apply a small drag-style multiplier so the rally does not accelerate forever.
            const speedScale = Math.pow(physics.speedMultiplier, dt);
            ballVX *= speedScale;
            ballVY *= speedScale;
            ballVZ *= speedScale;

            // Clamp the combined speed so the ball never becomes unplayably fast.
            const currentSpeed = Math.hypot(ballVX, ballVY, ballVZ);
            if (currentSpeed > physics.speedMax && currentSpeed > 0) {
                const scale = physics.speedMax / currentSpeed;
                ballVX *= scale;
                ballVY *= scale;
                ballVZ *= scale;
            }

            // Side rails keep the ball inside the table width.
            if (Math.abs(gameObjects.ball.position.z) > physics.tableHalfWidth) {
                gameObjects.ball.position.z = clamp(gameObjects.ball.position.z, -physics.tableHalfWidth, physics.tableHalfWidth);
                ballVZ = -ballVZ * physics.sideWallRestitution;
                ballSpin *= physics.sideWallSpinRetention;
            }

            // The net blocks low shots near the middle of the table.
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

            const ballRadius = 0.15;
            const overTableX = Math.abs(gameObjects.ball.position.x) <= physics.tableHalfLength;
            const overTableZ = Math.abs(gameObjects.ball.position.z) <= physics.tableHalfWidth;
            const touchesTable = gameObjects.ball.position.y - ballRadius <= physics.tableTopY;
            if (touchesTable && overTableX && overTableZ && ballVY < 0) {
                // A bounce on the table reverses the downward velocity and trims some energy.
                gameObjects.ball.position.y = physics.tableTopY + ballRadius;
                ballVY = -ballVY * physics.tableBounceRestitution;
                ballVX *= physics.tableBounceFriction;
                ballVZ *= physics.tableBounceFriction;
            }

            // If the ball falls below the floor plane, I award the point to the opponent.
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

            const paddleLeftVelZ = (gameObjects.paddleLeft.position.z - paddleLeftPrevZ) / Math.max(dt, 0.0001);
            const paddleRightVelZ = (gameObjects.paddleRight.position.z - paddleRightPrevZ) / Math.max(dt, 0.0001);
            const paddleLeftRotVelZ = (paddleLeftRotationZ - paddleLeftPrevRotationZ) / Math.max(dt, 0.0001);
            const paddleRightRotVelZ = (paddleRightRotationZ - paddleRightPrevRotationZ) / Math.max(dt, 0.0001);
            paddleLeftPrevZ = gameObjects.paddleLeft.position.z;
            paddleRightPrevZ = gameObjects.paddleRight.position.z;
            paddleLeftPrevRotationZ = paddleLeftRotationZ;
            paddleRightPrevRotationZ = paddleRightRotationZ;

            // Paddles only interact with the ball when the ball is coming toward them.
            if (ballVX < 0 &&
                gameObjects.ball.position.x < gameObjects.paddleLeft.position.x + physics.paddleCollisionDepth &&
                gameObjects.ball.position.x > gameObjects.paddleLeft.position.x - physics.paddleCollisionDepth &&
                Math.abs(gameObjects.ball.position.y - gameObjects.paddleLeft.position.y) < physics.paddleCollisionHeight &&
                Math.abs(gameObjects.ball.position.z - gameObjects.paddleLeft.position.z) < physics.paddleCollisionWidth) {

                // The paddle sends the ball back across the table and can add spin.
                const toBallZLeft = gameObjects.ball.position.z - gameObjects.paddleLeft.position.z;
                const approachSpeedLeft = Math.sign(toBallZLeft) * paddleLeftVelZ;
                const approachFactorLeft = 1 + Math.max(0, approachSpeedLeft) * physics.paddleApproachBoost;
                const retreatFactorLeft = Math.max(
                    physics.paddleRetreatDampingMin,
                    1 - Math.max(0, -approachSpeedLeft) * physics.paddleRetreatDampingStrength,
                );
                const impactFactorLeft = approachFactorLeft * retreatFactorLeft;

                gameObjects.ball.position.x = gameObjects.paddleLeft.position.x + physics.paddleCollisionDepth;
                ballVX = Math.abs(ballVX) * physics.paddleBounceBoost * impactFactorLeft;
                ballSpin = paddleLeftVelZ * physics.spinTransferCoefficient * impactFactorLeft;
                ballVZ += paddleLeftVelZ * physics.velocityTransfer * impactFactorLeft;

                // Z-axis paddle tilt adds lift/drop to the return trajectory.
                ballVY += Math.sin(paddleLeftRotationZ) * physics.paddleTiltToVerticalVelocity * impactFactorLeft;
                // Faster paddle rotation adds extra upward kick on impact.
                ballVY += Math.abs(paddleLeftRotVelZ) * physics.paddleRotationLiftFromSpeed;
            }

            // Right-paddle collision uses the same logic, mirrored for the opposite end.
            if (ballVX > 0 &&
                gameObjects.ball.position.x > gameObjects.paddleRight.position.x - physics.paddleCollisionDepth &&
                gameObjects.ball.position.x < gameObjects.paddleRight.position.x + physics.paddleCollisionDepth &&
                Math.abs(gameObjects.ball.position.y - gameObjects.paddleRight.position.y) < physics.paddleCollisionHeight &&
                Math.abs(gameObjects.ball.position.z - gameObjects.paddleRight.position.z) < physics.paddleCollisionWidth) {

                // I mirror the bounce so the ball heads back toward the other side.
                const toBallZRight = gameObjects.ball.position.z - gameObjects.paddleRight.position.z;
                const approachSpeedRight = Math.sign(toBallZRight) * paddleRightVelZ;
                const approachFactorRight = 1 + Math.max(0, approachSpeedRight) * physics.paddleApproachBoost;
                const retreatFactorRight = Math.max(
                    physics.paddleRetreatDampingMin,
                    1 - Math.max(0, -approachSpeedRight) * physics.paddleRetreatDampingStrength,
                );
                const impactFactorRight = approachFactorRight * retreatFactorRight;

                gameObjects.ball.position.x = gameObjects.paddleRight.position.x - physics.paddleCollisionDepth;
                ballVX = -Math.abs(ballVX) * physics.paddleBounceBoost * impactFactorRight;
                ballSpin = paddleRightVelZ * physics.spinTransferCoefficient * impactFactorRight;
                ballVZ += paddleRightVelZ * physics.velocityTransfer * impactFactorRight;

                // Same tilt-based vertical deflection on the right paddle.
                ballVY += Math.sin(paddleRightRotationZ) * physics.paddleTiltToVerticalVelocity * impactFactorRight;
                // Faster paddle rotation adds extra upward kick on impact.
                ballVY += Math.abs(paddleRightRotVelZ) * physics.paddleRotationLiftFromSpeed;
            }

            // A point is also scored if the ball exits the table length entirely.
            if (gameObjects.ball.position.x < -physics.goalX) {
                scoreP2int++;
                scoreP2.textContent = scoreP2int.toString();
                resetBall(1);
            } else if (gameObjects.ball.position.x > physics.goalX) {
                scoreP1int++;
                scoreP1.textContent = scoreP1int.toString();
                resetBall(-1);
            }

            if (scoreP1int >= 10 || scoreP2int >= 10) {
                setTimeout(() => endGame(true), 0);
            }
        });

        let hasEnded = false;

        const cleanup = () => {
            // I remove every listener and mesh I created so a fresh match starts cleanly.
            clearInterval(keyboardInterval);
            window.removeEventListener("keydown", keyDownHandler);
            window.removeEventListener("keyup", keyUpHandler);
            window.removeEventListener("beforeunload", browserExitHandler);
            window.removeEventListener("pagehide", browserExitHandler);
            window.removeEventListener("popstate", browserExitHandler);
            scene.onBeforeRenderObservable.remove(renderObserver);
            physicsPanel?.remove();
            Object.values(arenaMeshes).forEach((mesh) => mesh?.dispose());
            Object.values(leftPaddleVisual).forEach((mesh) => mesh?.dispose());
            Object.values(rightPaddleVisual).forEach((mesh) => mesh?.dispose());
            disposeCurrentEngine();
            document.getElementById('renderCanvas')?.remove();
        };

        const endGame = (showWinnerMessage = false) => {
            if (hasEnded) return;
            hasEnded = true;
            cleanup();

            if (showWinnerMessage && !tournament) {
                // Local mode shows a simple message and sends me back to the pong menu.
                showMessage(scoreP1int >= 10 ? "They win!" : "You win!");
                navigate('/pong');
            }

            resolve();
        };

        const browserExitHandler = () => {
            endGame(false);
        };

        window.addEventListener("beforeunload", browserExitHandler);
        window.addEventListener("pagehide", browserExitHandler);
        window.addEventListener("popstate", browserExitHandler);
    });
}
