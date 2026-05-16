import { MeshBuilder, StandardMaterial, Color3, Vector3 } from "@babylonjs/core";

export function createTableArena(scene, physics) {
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
        height: 1,
        depth: physics.tableHalfWidth * 2 - 0.08,
    }, scene);
    net.scaling.y = physics.netHeight;
    net.position = new Vector3(0, physics.tableTopY + physics.netHeight / 2, 0);
    net.material = netMat;

    const floor = MeshBuilder.CreateGround("localPongFloor", { width: 22, height: 14 }, scene);
    floor.position.y = physics.floorY;
    floor.material = floorMat;

    const roof = MeshBuilder.CreateBox("localPongRoof", {
        width: physics.tableHalfLength * 2,
        height: 0.02,
        depth: physics.tableHalfWidth * 2,
    }, scene);
    roof.position = new Vector3(0, physics.roofY, 0);
    roof.isVisible = false;

    const endWallHeight = physics.roofY - physics.endWallStartY;
    const endWallLeft = MeshBuilder.CreateBox("localPongEndWallLeft", {
        width: 0.04,
        height: endWallHeight,
        depth: physics.tableHalfWidth * 2,
    }, scene);
    endWallLeft.position = new Vector3(-physics.goalX, physics.endWallStartY + endWallHeight / 2, 0);
    endWallLeft.isVisible = false;

    const endWallRight = MeshBuilder.CreateBox("localPongEndWallRight", {
        width: 0.04,
        height: endWallHeight,
        depth: physics.tableHalfWidth * 2,
    }, scene);
    endWallRight.position = new Vector3(physics.goalX, physics.endWallStartY + endWallHeight / 2, 0);
    endWallRight.isVisible = false;

    return { table, centerLine, sideLineLeft, sideLineRight, net, floor, roof, endWallLeft, endWallRight };
}

export function positionPaddles(gameObjects, physics, paddleLeftBaseX, paddleRightBaseX) {
    gameObjects.paddleLeft.position.x = paddleLeftBaseX;
    gameObjects.paddleRight.position.x = paddleRightBaseX;
    gameObjects.paddleLeft.position.y = physics.paddleBaseY + 2;
    gameObjects.paddleRight.position.y = physics.paddleBaseY;
    gameObjects.paddleLeft.position.z = Math.max(-physics.paddleBoundsZ, Math.min(physics.paddleBoundsZ, gameObjects.paddleLeft.position.z));
    gameObjects.paddleRight.position.z = Math.max(-physics.paddleBoundsZ, Math.min(physics.paddleBoundsZ, gameObjects.paddleRight.position.z));
}
