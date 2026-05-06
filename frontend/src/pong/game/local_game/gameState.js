/**
 * Centralized game state object.
 * All mutable game state lives here for easy inspection and debugging.
 */
export function createGameState(defaultPhysics) {
    return {
        // Physics tuning
        physics: { ...defaultPhysics },

        // Ball state
        ball: {
            vx: defaultPhysics.initialSpeedX,
            vy: defaultPhysics.initialUpwardSpeedY,
            vz: defaultPhysics.initialLateralSpeedZ,
            spinY: 0,
        },

        // Paddle state
        paddles: {
            left: {
                rotationZ: 0,
                prevRotationZ: 0,
                prevZ: 0, // Will be set from gameObjects
                swingTimer: 0,
                swingIntensity: 0,
                lobTimer: 0,
                lobIntensity: 0,
                wingTimer: 0,
                wingIntensity: 0,
                wingDirection: 1,
                wingStartZ: 0,
            },
            right: {
                rotationZ: 0,
                prevRotationZ: 0,
                prevZ: 0,
                swingTimer: 0,
                swingIntensity: 0,
                lobTimer: 0,
                lobIntensity: 0,
                wingTimer: 0,
                wingIntensity: 0,
                wingDirection: 1,
                wingStartZ: 0,
            },
        },

        // Input queuing
        input: {
            swingQueued: false,
            leftLobQueued: false,
            rightLobQueued: false,
            leftWingQueued: false,
            rightWingQueued: false,
        },

        // Scoring
        score: {
            p1: 0,
            p2: 0,
        },

        // Timing
        timing: {
            lastFrameTime: Date.now(),
        },

        // UI references
        ui: {
            scoreP1: null,
            scoreP2: null,
            physicsPanel: null,
        },
    };
}
