import { ArcRotateCamera, HemisphericLight,StandardMaterial, Color3, MeshBuilder, Vector3, Scene as BabylonScene, AbstractMesh } from '@babylonjs/core';

export function createGame(scene: BabylonScene, canvas?: HTMLCanvasElement) {
	// 1. Create camera
	const camera = new ArcRotateCamera("cam", -Math.PI / 2, Math.PI / 2.6, 10, new Vector3(0, 0, 0), scene);
	camera.attachControl(canvas, true);

	// 2. Add light
	const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);

	// court (invisible plane), paddles and ball
	const paddleMat = new StandardMaterial('pMat', scene);
	paddleMat.diffuseColor = new Color3(0.2, 0.6, 1);

	const ballMat = new StandardMaterial('bMat', scene);
	ballMat.diffuseColor = new Color3(1, 0.4, 0.2);

	const leftPaddle = MeshBuilder.CreateBox('leftP', { height: 1.5, width: 0.3, depth: 0.2 }, scene);
	leftPaddle.material = paddleMat;
	leftPaddle.position = new Vector3(-3.5, 0, 0);

	const rightPaddle = leftPaddle.clone('rightP') as AbstractMesh;
	rightPaddle.position.x = 3.5;

	const ball = MeshBuilder.CreateSphere('ball', { diameter: 0.25 }, scene) ;
	ball.material = ballMat;
	ball.position = new Vector3(0, 0, 0);

	// basic local physics
	let vel = new Vector3(3, 0.5, 0);

	// WebSocket connection
	const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	const wsUrl = `${proto}//${window.location.host}/ws`;
	const ws = new WebSocket(wsUrl);

	ws.onopen = () => console.log('ws open', wsUrl);
	ws.onmessage = (ev) => {
		// we will receive broadcast messages from server
		try {
			const data = JSON.parse(ev.data);
			// This demo simply logs; you can sync paddles/ball here
			// console.log('ws msg', data);
		} catch (e) {}
	};

	// input
	const keys: Record<string, boolean> = {};
	window.addEventListener('keydown', (e) => (keys[(e as KeyboardEvent).key] = true));
	window.addEventListener('keyup', (e) => (keys[(e as KeyboardEvent).key] = false));

	scene.registerBeforeRender(() => {
		const dt = scene.getEngine().getDeltaTime() / 1000; // seconds

		// local paddle control (W/S for left, ArrowUp/Down for right)
		if (keys['w']) leftPaddle.position.y += 4 * dt;
		if (keys['s']) leftPaddle.position.y -= 4 * dt;
		if (keys['ArrowUp']) rightPaddle.position.y += 4 * dt;
		if (keys['ArrowDown']) rightPaddle.position.y -= 4 * dt;

		// ball movement
		ball.position.addInPlace(vel.scale(dt));

		// simple collisions with top/bottom
		if (ball.position.y > 3.5 || ball.position.y < -3.5) vel.y *= -1;

		// paddle collisions (naive)
		if (ball.position.x < -3.2 && Math.abs(ball.position.y - leftPaddle.position.y) < 1) vel.x = Math.abs(vel.x);
		if (ball.position.x > 3.2 && Math.abs(ball.position.y - rightPaddle.position.y) < 1) vel.x = -Math.abs(vel.x);

		// out of bounds -> reset
		if (ball.position.x < -5 || ball.position.x > 5) {
			ball.position = new Vector3(0, 0, 0);
			vel = new Vector3(3 * (Math.random() > 0.5 ? 1 : -1), (Math.random() - 0.5) * 2, 0);
		}

		// send local state occasionally
		if (ws.readyState === WebSocket.OPEN && Math.random() < 0.02) {
			const payload = {
				type: 'state',
				leftY: leftPaddle.position.y,
				rightY: rightPaddle.position.y,
				ball: { x: ball.position.x, y: ball.position.y }
			};
			ws.send(JSON.stringify(payload));
		}
	});

	return { leftPaddle, rightPaddle, ball };
}