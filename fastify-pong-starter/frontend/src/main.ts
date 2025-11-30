import './styles.css';
import { Engine, Scene } from '@babylonjs/core';
import { createGame } from './game';


const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new Engine(canvas, true);
const scene = new Scene(engine);


createGame(scene, canvas);


engine.runRenderLoop(() => {
scene.render();
});


window.addEventListener('resize', () => {
engine.resize();
});