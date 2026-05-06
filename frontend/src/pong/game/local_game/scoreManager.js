/**
 * Score tracking and win condition logic.
 */

/**
 * Check if ball has gone out of bounds and award points.
 */
export function checkBallOutOfBounds(gameState, gameObjects, physics) {
    const ballRadius = 0.15;
    
    // Ball fell below floor
    if (gameObjects.ball.position.y < physics.floorY) {
        if (gameObjects.ball.position.x < 0) {
            return "p2";
        } else {
            return "p1";
        }
    }

    // Ball exited table length
    if (gameObjects.ball.position.x < -physics.goalX) {
        return "p2";
    } else if (gameObjects.ball.position.x > physics.goalX) {
        return "p1";
    }

    return null;
}

/**
 * Award point to player.
 */
export function awardPoint(gameState, player) {
    if (player === "p1") {
        gameState.score.p1++;
        if (gameState.ui.scoreP1) {
            gameState.ui.scoreP1.textContent = gameState.score.p1.toString();
        }
    } else if (player === "p2") {
        gameState.score.p2++;
        if (gameState.ui.scoreP2) {
            gameState.ui.scoreP2.textContent = gameState.score.p2.toString();
        }
    }
}

/**
 * Check if game is over (one player reaches 10 points).
 */
export function isGameOver(gameState) {
    return gameState.score.p1 >= 10 || gameState.score.p2 >= 10;
}

/**
 * Get winner name.
 */
export function getWinner(gameState) {
    if (gameState.score.p1 >= 10) return "p1";
    if (gameState.score.p2 >= 10) return "p2";
    return null;
}
