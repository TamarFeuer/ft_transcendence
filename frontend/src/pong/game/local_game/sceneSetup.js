import { Vector3 } from "@babylonjs/core";

/**
 * Initialize camera and scene view.
 */
export function setupSceneCamera(scene, physics) {
    if (scene.activeCamera) {
        scene.activeCamera.inputs.clear();
        scene.activeCamera.setPosition(
            new Vector3(-10.8, physics.tableTopY + 5.85, 0)
        );
        scene.activeCamera.setTarget(
            new Vector3(0, physics.tableTopY - 1.0, 0)
        );
    }
}

/**
 * Initialize UI references and display.
 */
export function setupScoreUI(gameState) {
    gameState.ui.scoreP1 = document.getElementById("scoreP1");
    gameState.ui.scoreP2 = document.getElementById("scoreP2");
    
    if (gameState.ui.scoreP1) gameState.ui.scoreP1.textContent = "0";
    if (gameState.ui.scoreP2) gameState.ui.scoreP2.textContent = "0";
}
