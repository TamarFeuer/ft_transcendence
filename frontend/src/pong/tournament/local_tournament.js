import { createGameCanvas } from "../../routes/routes.js";

import { showMessage } from "../../utils/utils.js"
import { handleRoute, navigate } from "../../routes/route_helpers.js";
import { t } from '../../i18n/index.js';


export async function startLocalTournament(playerCount) {
	const players = [];
	for (let i = 0; i < playerCount; i++) {
		const name = prompt(`Enter name for Player ${i + 1}:`) || `Player ${i + 1}`;
		players.push(name);
	}

	const schedule = [];
	for (let i = 0; i < playerCount; i++) {
		for (let j = i + 1; j < playerCount; j++) {
			schedule.push([i, j]);
		}
	}

	const scores = new Array(playerCount).fill(0);

	for (const [i, j] of schedule) {
		showMessage(t('TOURN_MATCH', { p1: players[i], p2: players[j] }));

		const appRoot = document.getElementById("app-root");
		appRoot.innerHTML = `
			<div id="gameContainer">
				<canvas id="renderCanvas"></canvas>
				<div id="scoreHud" class="score-hud">
					<div>${players[i]}: <span id="scoreP1">0</span></div>
					<div>${players[j]}: <span id="scoreP2">0</span></div>
				</div>
			</div>
		`;

		const canvas = createGameCanvas();
		const engine = new Engine(canvas, true);
		const scene = new Scene(engine);
		const gameObjects = initGameScene(scene, canvas, 2);

		engine.runRenderLoop(() => scene.render());

		await initOfflineGame(scene, gameObjects, true);

		const p1Score = parseInt(document.getElementById("scoreP1").textContent || "0");
		const p2Score = parseInt(document.getElementById("scoreP2").textContent || "0");

		if (p1Score > p2Score) scores[i]++;
		else scores[j]++;

		scene.dispose();
		engine.dispose();
	}

	let winner = 0;
	for (let i = 1; i < playerCount; i++) {
		if (scores[i] > scores[winner]) winner = i;
	}

	showMessage(t('TOURN_WINNER', { name: players[winner], wins: scores[winner] }));
	navigate('/');
}