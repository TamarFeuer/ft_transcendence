import { MeshBuilder, StandardMaterial } from "@babylonjs/core";
import { Color3 } from "@babylonjs/core/Maths/math.color";

export function createPaddleVisual(paddle, faceColor, scene) {
    const faceMat = new StandardMaterial(`${paddle.name}FaceMat`, scene);
    faceMat.diffuseColor = faceColor instanceof Color3 ? faceColor : new Color3(1, 1, 1);

    const paddleFace = MeshBuilder.CreateBox(`${paddle.name}Face`, {
        width: 0.55,
        height: 1.55,
        depth: 0.12,
    }, scene);
    paddleFace.rotation.y = Math.PI / 2;
    paddleFace.parent = paddle;
    paddleFace.material = faceMat;
    paddle.isVisible = false;
    return { paddleFace };
}
