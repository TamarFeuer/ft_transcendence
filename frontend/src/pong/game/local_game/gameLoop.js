/**
 * Main game loop: physics, collisions, paddle impacts.
 */
import * as ballPhysics from "./ballPhysics.js";
import * as paddleControl from "./paddleControl.js";
import * as scoreManager from "./scoreManager.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Create the main render loop observer.
 */
export function createGameLoop(gameState, gameObjects, scene, physics, arenaMeshes, paddleLeftBaseX, paddleRightBaseX) {
    const renderObserver = scene.onBeforeRenderObservable.add(() => {
        const currentTime = Date.now();
        const dt = (currentTime - gameState.timing.lastFrameTime) / 16.67;
        gameState.timing.lastFrameTime = currentTime;

        // ============ BALL PHYSICS ============
        ballPhysics.applyBallPhysics(gameState, dt);
        ballPhysics.updateBallPosition(gameState, gameObjects, dt);
        ballPhysics.applyBallDrag(gameState, dt);
        ballPhysics.handleSideWallCollision(gameState, gameObjects);
        ballPhysics.handleRoofCollision(gameState, gameObjects);
        ballPhysics.handleEndWallCollision(gameState, gameObjects);
        ballPhysics.handleNetCollision(gameState, gameObjects);
        ballPhysics.handleTableCollision(gameState, gameObjects);
        ballPhysics.updateBallSpin(gameState, gameObjects, dt);

        // ============ PADDLE UPDATES ============
        paddleControl.updatePaddleVisuals(gameState, gameObjects, paddleLeftBaseX, paddleRightBaseX, physics);
        paddleControl.updateSwingAnimation(gameState, gameObjects, paddleLeftBaseX, paddleRightBaseX, physics, dt);
        paddleControl.updateLobAnimation(gameState, gameObjects, physics, dt);
        paddleControl.updateWingAnimation(gameState, gameObjects, physics.paddleBoundsZ, physics, dt);

        // ============ PADDLE VELOCITIES ============
        const { paddleLeftVelZ, paddleRightVelZ, paddleLeftRotVelZ, paddleRightRotVelZ } =
            paddleControl.getPaddleVelocities(gameState, gameObjects, dt);

        // ============ PADDLE COLLISIONS ============
        handleLeftPaddleCollision(
            gameState,
            gameObjects,
            physics,
            paddleLeftVelZ,
            paddleLeftRotVelZ
        );
        handleRightPaddleCollision(
            gameState,
            gameObjects,
            physics,
            paddleRightVelZ,
            paddleRightRotVelZ
        );

        // ============ SCORING ============
        const pointWinner = scoreManager.checkBallOutOfBounds(gameState, gameObjects, physics);
        if (pointWinner) {
            scoreManager.awardPoint(gameState, pointWinner);
            const serveDirection = pointWinner === "p1" ? -1 : 1;
            ballPhysics.resetBall(gameState, gameObjects, serveDirection);
        }

        if (scoreManager.isGameOver(gameState)) {
            return true; // Signal to end game
        }
    });

    return renderObserver;
}

/**
 * Left paddle collision with ball.
 */
function handleLeftPaddleCollision(gameState, gameObjects, physics, paddleLeftVelZ, paddleLeftRotVelZ) {
    const { ball, paddles } = gameState;

    if (
        ball.vx < 0 &&
        gameObjects.ball.position.x <
            gameObjects.paddleLeft.position.x + physics.paddleCollisionDepth &&
        gameObjects.ball.position.x >
            gameObjects.paddleLeft.position.x - physics.paddleCollisionDepth &&
        Math.abs(gameObjects.ball.position.y - gameObjects.paddleLeft.position.y) <
            physics.paddleCollisionHeight &&
        Math.abs(gameObjects.ball.position.z - gameObjects.paddleLeft.position.z) <
            physics.paddleCollisionWidth
    ) {
        const toBallZLeft =
            gameObjects.ball.position.z - gameObjects.paddleLeft.position.z;
        const approachSpeedLeft = Math.sign(toBallZLeft) * paddleLeftVelZ;
        const approachFactorLeft =
            1 + Math.max(0, approachSpeedLeft) * physics.paddleApproachBoost;
        const retreatFactorLeft = Math.max(
            physics.paddleRetreatDampingMin,
            1 - Math.max(0, -approachSpeedLeft) * physics.paddleRetreatDampingStrength
        );
        const impactFactorLeft = approachFactorLeft * retreatFactorLeft;

        gameObjects.ball.position.x =
            gameObjects.paddleLeft.position.x + physics.paddleCollisionDepth;
        
        // Velocity-aware swing boost: more boost on slow balls, less on fast balls
        const normalizedSpeedLeft = Math.min(1, Math.abs(ball.vx) / (physics.speedMax * 0.4));
        const slowBoostFactorLeft = 0.8 + 0.3 * (1 - normalizedSpeedLeft);
        
        ball.vx =
            Math.abs(ball.vx) *
            physics.paddleBounceBoost *
            impactFactorLeft *
            (1 + paddles.left.swingIntensity * slowBoostFactorLeft);
        ball.spinY =
            paddleLeftVelZ * physics.spinTransferCoefficient * impactFactorLeft;
        ball.vz +=
            paddleLeftVelZ *
            physics.velocityTransfer *
            impactFactorLeft *
            (1 + paddles.left.swingIntensity * 0.25);

        ball.vy +=
            Math.sin(paddles.left.rotationZ) *
            physics.paddleTiltToVerticalVelocity *
            impactFactorLeft;
        ball.vy += paddles.left.swingIntensity * 0.02;
        ball.vy += Math.abs(paddleLeftRotVelZ) * physics.paddleRotationLiftFromSpeed;

        if (paddles.left.lobIntensity > 0) {
            const lobForwardFactor = Math.max(
                0.12,
                1 - physics.paddleLobSlowFactor * paddles.left.lobIntensity
            );
            ball.vx *= lobForwardFactor;
            ball.vz *=
                1 -
                (1 - physics.paddleLobSideDamping) * paddles.left.lobIntensity;
            ball.vy += physics.paddleLobLiftBoost * paddles.left.lobIntensity;
        }

        if (paddles.left.wingIntensity > 0) {
            ball.vx *= physics.paddleWingForwardFactor;
            ball.vy += physics.paddleWingLiftBoost * paddles.left.wingIntensity;
            ball.vz +=
                paddles.left.wingDirection *
                physics.paddleWingSideBoost *
                paddles.left.wingIntensity;
            ball.spinY +=
                paddles.left.wingDirection *
                physics.paddleWingSpinBoost *
                paddles.left.wingIntensity;
        }
    }
}

/**
 * Right paddle collision with ball.
 */
function handleRightPaddleCollision(gameState, gameObjects, physics, paddleRightVelZ, paddleRightRotVelZ) {
    const { ball, paddles } = gameState;

    if (
        ball.vx > 0 &&
        gameObjects.ball.position.x >
            gameObjects.paddleRight.position.x - physics.paddleCollisionDepth &&
        gameObjects.ball.position.x <
            gameObjects.paddleRight.position.x + physics.paddleCollisionDepth &&
        Math.abs(gameObjects.ball.position.y - gameObjects.paddleRight.position.y) <
            physics.paddleCollisionHeight &&
        Math.abs(gameObjects.ball.position.z - gameObjects.paddleRight.position.z) <
            physics.paddleCollisionWidth
    ) {
        const toBallZRight =
            gameObjects.ball.position.z - gameObjects.paddleRight.position.z;
        const approachSpeedRight = Math.sign(toBallZRight) * paddleRightVelZ;
        const approachFactorRight =
            1 + Math.max(0, approachSpeedRight) * physics.paddleApproachBoost;
        const retreatFactorRight = Math.max(
            physics.paddleRetreatDampingMin,
            1 - Math.max(0, -approachSpeedRight) * physics.paddleRetreatDampingStrength
        );
        const impactFactorRight = approachFactorRight * retreatFactorRight;

        gameObjects.ball.position.x =
            gameObjects.paddleRight.position.x - physics.paddleCollisionDepth;
        
        // Velocity-aware swing boost: more boost on slow balls, less on fast balls
        const normalizedSpeedRight = Math.min(1, Math.abs(ball.vx) / (physics.speedMax * 0.4));
        const slowBoostFactorRight = 0.8 + 0.3 * (1 - normalizedSpeedRight);
        
        ball.vx =
            -Math.abs(ball.vx) *
            physics.paddleBounceBoost *
            impactFactorRight *
            (1 + paddles.right.swingIntensity * slowBoostFactorRight);
        ball.spinY =
            paddleRightVelZ * physics.spinTransferCoefficient * impactFactorRight;
        ball.vz +=
            paddleRightVelZ *
            physics.velocityTransfer *
            impactFactorRight *
            (1 + paddles.right.swingIntensity * 0.25);

        ball.vy +=
            Math.sin(paddles.right.rotationZ) *
            physics.paddleTiltToVerticalVelocity *
            impactFactorRight;
        ball.vy += paddles.right.swingIntensity * 0.02;
        ball.vy += Math.abs(paddleRightRotVelZ) * physics.paddleRotationLiftFromSpeed;

        if (paddles.right.lobIntensity > 0) {
            const lobForwardFactor = Math.max(
                0.12,
                1 - physics.paddleLobSlowFactor * paddles.right.lobIntensity
            );
            ball.vx *= lobForwardFactor;
            ball.vz *=
                1 -
                (1 - physics.paddleLobSideDamping) * paddles.right.lobIntensity;
            ball.vy += physics.paddleLobLiftBoost * paddles.right.lobIntensity;
        }

        if (paddles.right.wingIntensity > 0) {
            ball.vx *= physics.paddleWingForwardFactor;
            ball.vy += physics.paddleWingLiftBoost * paddles.right.wingIntensity;
            ball.vz +=
                paddles.right.wingDirection *
                physics.paddleWingSideBoost *
                paddles.right.wingIntensity;
            ball.spinY +=
                paddles.right.wingDirection *
                physics.paddleWingSpinBoost *
                paddles.right.wingIntensity;
        }
    }
}
