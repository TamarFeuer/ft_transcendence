/**
 * Paddle movement, rotation, and special attack animations.
 */

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Update paddle positions and rotations from state.
 */
export function updatePaddleVisuals(gameState, gameObjects, paddleLeftBaseX, paddleRightBaseX, physics) {
    const { paddles } = gameState;

    // Apply rotation
    gameObjects.paddleLeft.rotation.z = paddles.left.rotationZ;
    gameObjects.paddleRight.rotation.z = paddles.right.rotationZ;

    // Restore base positions (can be overridden by special moves)
    gameObjects.paddleLeft.position.x = paddleLeftBaseX;
    gameObjects.paddleRight.position.x = paddleRightBaseX;
    gameObjects.paddleLeft.position.y = physics.paddleBaseY;
    gameObjects.paddleRight.position.y = physics.paddleBaseY;

    // Clamp Z bounds
    gameObjects.paddleLeft.position.z = clamp(
        gameObjects.paddleLeft.position.z,
        -physics.paddleBoundsZ,
        physics.paddleBoundsZ
    );
    gameObjects.paddleRight.position.z = clamp(
        gameObjects.paddleRight.position.z,
        -physics.paddleBoundsZ,
        physics.paddleBoundsZ
    );

    // Clamp rotation
    paddles.left.rotationZ = clamp(
        paddles.left.rotationZ,
        -physics.paddleRotationLimit,
        physics.paddleRotationLimit
    );
    paddles.right.rotationZ = clamp(
        paddles.right.rotationZ,
        -physics.paddleRotationLimit,
        physics.paddleRotationLimit
    );
}

/**
 * Update swing animation timers and positions.
 */
export function updateSwingAnimation(gameState, gameObjects, paddleLeftBaseX, paddleRightBaseX, physics, dt) {
    const { paddles } = gameState;

    if (paddles.left.swingTimer > 0) {
        paddles.left.swingTimer = Math.max(0, paddles.left.swingTimer - dt * 0.01667);
        const progress = 1 - paddles.left.swingTimer / physics.paddleSwingDuration;
        const curve = Math.sin(Math.PI * progress);
        paddles.left.swingIntensity = curve;
        gameObjects.paddleLeft.position.x = paddleLeftBaseX + curve * physics.paddleSwingReach;
        gameObjects.paddleLeft.rotation.z =
            paddles.left.rotationZ + curve * physics.paddleSwingRotationBoost;
    } else {
        paddles.left.swingIntensity = 0;
        gameObjects.paddleLeft.position.x = paddleLeftBaseX;
    }

    if (paddles.right.swingTimer > 0) {
        paddles.right.swingTimer = Math.max(0, paddles.right.swingTimer - dt * 0.01667);
        const progress = 1 - paddles.right.swingTimer / physics.paddleSwingDuration;
        const curve = Math.sin(Math.PI * progress);
        paddles.right.swingIntensity = curve;
        gameObjects.paddleRight.position.x = paddleRightBaseX - curve * physics.paddleSwingReach;
        gameObjects.paddleRight.rotation.z =
            paddles.right.rotationZ - curve * physics.paddleSwingRotationBoost;
    } else {
        paddles.right.swingIntensity = 0;
        gameObjects.paddleRight.position.x = paddleRightBaseX;
    }
}

/**
 * Update lob animation timers and effects.
 */
export function updateLobAnimation(gameState, gameObjects, physics, dt) {
    const { paddles } = gameState;

    if (paddles.left.lobTimer > 0) {
        paddles.left.lobTimer = Math.max(0, paddles.left.lobTimer - dt * 0.01667);
        const progress = 1 - paddles.left.lobTimer / physics.paddleLobDuration;
        paddles.left.lobIntensity = Math.sin(Math.PI * progress);
        gameObjects.paddleLeft.rotation.z +=
            paddles.left.lobIntensity * physics.paddleLobRotationBoost;
    } else {
        paddles.left.lobIntensity = 0;
    }

    if (paddles.right.lobTimer > 0) {
        paddles.right.lobTimer = Math.max(0, paddles.right.lobTimer - dt * 0.01667);
        const progress = 1 - paddles.right.lobTimer / physics.paddleLobDuration;
        paddles.right.lobIntensity = Math.sin(Math.PI * progress);
        gameObjects.paddleRight.rotation.z -=
            paddles.right.lobIntensity * physics.paddleLobRotationBoost;
    } else {
        paddles.right.lobIntensity = 0;
    }
}

/**
 * Update wing (side shot) animation timers and effects.
 */
export function updateWingAnimation(gameState, gameObjects, paddleBoundsZ, physics, dt) {
    const { paddles } = gameState;

    if (paddles.left.wingTimer > 0) {
        paddles.left.wingTimer = Math.max(0, paddles.left.wingTimer - dt * 0.01667);
        const progress = 1 - paddles.left.wingTimer / physics.paddleWingDuration;
        paddles.left.wingIntensity = Math.sin(Math.PI * progress);
        gameObjects.paddleLeft.position.z = clamp(
            paddles.left.wingStartZ +
                paddles.left.wingDirection * paddles.left.wingIntensity * physics.paddleWingSideReach,
            -paddleBoundsZ,
            paddleBoundsZ
        );
        gameObjects.paddleLeft.rotation.z +=
            paddles.left.wingDirection * paddles.left.wingIntensity * physics.paddleWingRotationBoost;
    } else {
        paddles.left.wingIntensity = 0;
    }

    if (paddles.right.wingTimer > 0) {
        paddles.right.wingTimer = Math.max(0, paddles.right.wingTimer - dt * 0.01667);
        const progress = 1 - paddles.right.wingTimer / physics.paddleWingDuration;
        paddles.right.wingIntensity = Math.sin(Math.PI * progress);
        gameObjects.paddleRight.position.z = clamp(
            paddles.right.wingStartZ +
                paddles.right.wingDirection * paddles.right.wingIntensity * physics.paddleWingSideReach,
            -paddleBoundsZ,
            paddleBoundsZ
        );
        gameObjects.paddleRight.rotation.z +=
            paddles.right.wingDirection * paddles.right.wingIntensity * physics.paddleWingRotationBoost;
    } else {
        paddles.right.wingIntensity = 0;
    }
}

/**
 * Calculate paddle velocity for impact calculations.
 */
export function getPaddleVelocities(gameState, gameObjects, dt) {
    const { paddles } = gameState;

    const paddleLeftVelZ =
        (gameObjects.paddleLeft.position.z - paddles.left.prevZ) / Math.max(dt, 0.0001);
    const paddleRightVelZ =
        (gameObjects.paddleRight.position.z - paddles.right.prevZ) / Math.max(dt, 0.0001);
    const paddleLeftRotVelZ =
        (paddles.left.rotationZ - paddles.left.prevRotationZ) / Math.max(dt, 0.0001);
    const paddleRightRotVelZ =
        (paddles.right.rotationZ - paddles.right.prevRotationZ) / Math.max(dt, 0.0001);

    // Update prev values for next frame
    paddles.left.prevZ = gameObjects.paddleLeft.position.z;
    paddles.right.prevZ = gameObjects.paddleRight.position.z;
    paddles.left.prevRotationZ = paddles.left.rotationZ;
    paddles.right.prevRotationZ = paddles.right.rotationZ;

    return { paddleLeftVelZ, paddleRightVelZ, paddleLeftRotVelZ, paddleRightRotVelZ };
}

/**
 * Trigger swing animation.
 */
export function triggerSwing(gameState, gameObjects) {
    const { paddles, ball } = gameState;
    if (ball.vx < 0 || gameObjects.ball.position.x < 0) {
        paddles.left.swingTimer = gameState.physics.paddleSwingDuration;
    } else {
        paddles.right.swingTimer = gameState.physics.paddleSwingDuration;
    }
}

/**
 * Trigger lob animation.
 */
export function triggerLob(gameState, side) {
    const { paddles, physics } = gameState;
    if (side === "left") {
        paddles.left.lobTimer = physics.paddleLobDuration;
    } else {
        paddles.right.lobTimer = physics.paddleLobDuration;
    }
}

/**
 * Trigger wing animation.
 */
export function triggerWing(gameState, gameObjects, side) {
    const { paddles, physics } = gameState;
    if (side === "left") {
        paddles.left.wingTimer = physics.paddleWingDuration;
        paddles.left.wingStartZ = gameObjects.paddleLeft.position.z;
        paddles.left.wingDirection =
            Math.sign(gameObjects.ball.position.z - gameObjects.paddleLeft.position.z) || 1;
    } else {
        paddles.right.wingTimer = physics.paddleWingDuration;
        paddles.right.wingStartZ = gameObjects.paddleRight.position.z;
        paddles.right.wingDirection =
            Math.sign(gameObjects.ball.position.z - gameObjects.paddleRight.position.z) || 1;
    }
}
