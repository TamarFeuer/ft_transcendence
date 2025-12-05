import {
  ArcRotateCamera,
  HemisphericLight,
  StandardMaterial,
  Color3,
  MeshBuilder,
  Vector3,
  Scene as BabylonScene,
  Mesh
} from "@babylonjs/core";

export function initGameScene(scene: BabylonScene, canvas: HTMLCanvasElement) {
  const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.4, 12, new Vector3(0, 0, 0), scene);
  camera.attachControl(canvas, true);
  // disable rotation inputs so camera stays fixed
  camera.inputs.clear();

  new HemisphericLight("light", new Vector3(0, 1, 0), scene);

  const paddleMat = new StandardMaterial("paddleMat", scene);
  paddleMat.diffuseColor = new Color3(0.3, 0.6, 1);

  const ballMat = new StandardMaterial("ballMat", scene);
  ballMat.diffuseColor = new Color3(1, 0.4, 0.2);

  const paddleLeft = MeshBuilder.CreateBox("paddleLeft", { height: 1.5, width: 0.25, depth: 0.2 }, scene);
  paddleLeft.material = paddleMat;
  paddleLeft.position = new Vector3(-4, 0, 0);

  const paddleRight = MeshBuilder.CreateBox("paddleRight", { height: 1.5, width: 0.25, depth: 0.2 }, scene);
  paddleRight.material = paddleMat;
  paddleRight.position = new Vector3(4, 0, 0);

  const ball = MeshBuilder.CreateSphere("ball", { diameter: 0.3 }, scene);
  ball.material = ballMat;
  ball.position = new Vector3(0, 0, 0);

  return { paddleLeft, paddleRight, ball };
}
