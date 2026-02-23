import {
  ArcRotateCamera,
  HemisphericLight,
  StandardMaterial,
  Color3,
  MeshBuilder,
  Vector3,
  Texture,
  DynamicTexture
} from "@babylonjs/core";

export function initGameScene(scene, canvas, playerCount) {
  const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.4, 12, new Vector3(0, 0, 0), scene);
  camera.attachControl(canvas, true);
  camera.inputs.clear();
  console.log("Player count:", playerCount);
  new HemisphericLight("light", new Vector3(0, 1, 0), scene);

  const paddleMat = new StandardMaterial("paddleMat", scene);
  paddleMat.diffuseColor = new Color3(0.3, 0.6, 1);

  // Create striped ball texture for visible spin
  const ballMat = new StandardMaterial("ballMat", scene);
  const dynamicTexture = new DynamicTexture("ballTexture", 512, scene);
  const ctx = dynamicTexture.getContext();
  
  // Draw orange base
  ctx.fillStyle = "#FF6633";
  ctx.fillRect(0, 0, 512, 512);
  
  // Draw black vertical stripes
  ctx.fillStyle = "#000000";
  for (let i = 0; i < 512; i += 64) {
    ctx.fillRect(i, 0, 32, 512);
  }
  
  dynamicTexture.update();
  ballMat.diffuseTexture = dynamicTexture;

  const paddleLeft = MeshBuilder.CreateBox("paddleLeft", { height: 1.5, width: 0.25, depth: 0.2 }, scene);
  paddleLeft.material = paddleMat;
  paddleLeft.position = new Vector3(-4, 0, 0);

  const paddleRight = MeshBuilder.CreateBox("paddleRight", { height: 1.5, width: 0.25, depth: 0.2 }, scene);
  paddleRight.material = paddleMat;
  paddleRight.position = new Vector3(4, 0, 0);

  const ball = MeshBuilder.CreateSphere("ball", { diameter: 0.3 }, scene);
  ball.material = ballMat;
  ball.position = new Vector3(0, 0, 0);

  const temperature = 5.0; // Initial temperature for AI paddle

  return { paddleLeft, paddleRight, ball, temperature };
}
