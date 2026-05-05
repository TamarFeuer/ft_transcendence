/**
 * Ball physics simulation: gravity, spin, bounces, net collisions.
 */

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Update ball position based on velocity.
 */
export function updateBallPosition(gameState, gameObjects, dt) {
    const { ball } = gameState;
    const { physics } = gameState;
    
    gameObjects.ball.position.x += ball.vx * dt;
    gameObjects.ball.position.y += ball.vy * dt;
    gameObjects.ball.position.z += ball.vz * dt;
}

/**
 * Apply gravity and Magnus force (spin-based curve).
 */
export function applyBallPhysics(gameState, dt) {
    const { ball, physics } = gameState;

    // Gravity
    ball.vy -= physics.gravity * dt;

    // Magnus force from side-spin (curves the ball)
    const sideSpinForce =
        -ball.spinY * ball.vx * physics.magnusCoefficient * physics.magnusExtraFactor * dt;
    ball.vz += sideSpinForce;

    // Spin decay
    ball.spinY *= Math.pow(physics.spinDecay, dt);
}

/**
 * Apply drag and speed clamping.
 */
export function applyBallDrag(gameState, dt) {
    const { ball, physics } = gameState;

    const speedScale = Math.pow(physics.speedMultiplier, dt);
    ball.vx *= speedScale;
    ball.vy *= speedScale;
    ball.vz *= speedScale;

    const currentSpeed = Math.hypot(ball.vx, ball.vy, ball.vz);
    if (currentSpeed > physics.speedMax && currentSpeed > 0) {
        const scale = physics.speedMax / currentSpeed;
        ball.vx *= scale;
        ball.vy *= scale;
        ball.vz *= scale;
    }
}

/**
 * Handle ball bouncing off side walls.
 */
export function handleSideWallCollision(gameState, gameObjects) {
    const { ball, physics } = gameState;
    const ballRadius = 0.15;

    if (Math.abs(gameObjects.ball.position.z) > physics.tableHalfWidth) {
        gameObjects.ball.position.z = clamp(
            gameObjects.ball.position.z,
            -physics.tableHalfWidth,
            physics.tableHalfWidth
        );
        ball.vz = -ball.vz * physics.sideWallRestitution;
        ball.spinY *= physics.sideWallSpinRetention;
    }
}

/**
 * Handle ball collision with center net.
 */
export function handleNetCollision(gameState, gameObjects) {
    const { ball, physics } = gameState;
    const ballRadius = 0.15;

    const insideNetHeight =
        gameObjects.ball.position.y - ballRadius < physics.tableTopY + physics.netHeight;
    const insideNetDepth = Math.abs(gameObjects.ball.position.z) < physics.tableHalfWidth;

    if (
        Math.abs(gameObjects.ball.position.x) < physics.netHalfThickness &&
        insideNetHeight &&
        insideNetDepth
    ) {
        const netSide = gameObjects.ball.position.x >= 0 ? 1 : -1;
        gameObjects.ball.position.x = netSide * physics.netHalfThickness;
        ball.vx = -ball.vx * physics.netBounceDamping;
        ball.vy *= physics.netBounceDamping;
        ball.vz *= physics.netBounceDamping;
        ball.spinY *= physics.netSpinRetention;
    }
}

/**
 * Handle ball bouncing on table surface.
 */
export function handleTableCollision(gameState, gameObjects) {
    const { ball, physics } = gameState;
    const ballRadius = 0.15;

    const overTableX = Math.abs(gameObjects.ball.position.x) <= physics.tableHalfLength;
    const overTableZ = Math.abs(gameObjects.ball.position.z) <= physics.tableHalfWidth;
    const tableSurfaceY =
        physics.tableTopY - Math.abs(gameObjects.ball.position.x) * physics.tableInclinePerUnitX;
    const touchesTable = gameObjects.ball.position.y - ballRadius <= tableSurfaceY;

    if (touchesTable && overTableX && overTableZ && ball.vy < 0) {
        gameObjects.ball.position.y = tableSurfaceY + ballRadius;
        ball.vy = -ball.vy * physics.tableBounceRestitution;
        ball.vx *= physics.tableBounceFriction;
        ball.vz *= physics.tableBounceFriction;
    }

    // Downhill roll assist
    if (
        overTableX &&
        overTableZ &&
        Math.abs(ball.vy) < 0.03 &&
        gameObjects.ball.position.y - ballRadius <= tableSurfaceY + 0.03
    ) {
        const downhillDirection =
            gameObjects.ball.position.x === 0
                ? Math.sign(ball.vx) || 1
                : Math.sign(gameObjects.ball.position.x);
        ball.vx += downhillDirection * physics.tableDownhillAcceleration * (1 / 60);
    }
}

/**
 * Visual spin rotation.
 */
export function updateBallSpin(gameState, gameObjects, dt) {
    const { ball, physics } = gameState;
    gameObjects.ball.rotation.y +=
        ball.spinY *
        physics.magnusCoefficient *
        physics.magnusExtraFactor *
        physics.visualSpinFactor *
        dt;
}

/**
 * Reset ball to center of table.
 */
export function resetBall(gameState, gameObjects, serveDirection = 1) {
    const { ball, physics } = gameState;
    const randomSign = () => (Math.random() > 0.5 ? 1 : -1);

    gameObjects.ball.position.x = 4;
    gameObjects.ball.position.y = physics.tableTopY + 2;
    gameObjects.ball.position.z = 0;
    ball.spinY = 0;
    ball.vx = physics.initialSpeedX * serveDirection * 1.2;
    ball.vy = physics.initialUpwardSpeedY * 0.5;
    ball.vz = physics.initialLateralSpeedZ * randomSign();
}
