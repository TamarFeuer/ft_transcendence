import { Chess } from 'chess.js'
import { renderBoard } from './chess.js'

export async function initOnlineChessGame() {
	const boardEl   = document.getElementById('chess-board');
	const waitingEl = document.getElementById('waiting-overlay');
	const statusEl  = document.getElementById('game-status');

	boardEl.className = 'grid grid-cols-8 w-[36rem] h-[36rem] auto-rows-fr';

	const game = new Chess();
	let myColor   = null;   // 'white' or 'black', assigned by server
	let selected  = null;   // currently selected square notation
	let myTurn    = false;
	let gameActive = false;
	let whiteName = 'White';
	let blackName = 'Black';

	// --- 1. Matchmaking ---
	let gameId;
	try {
		const res = await fetch('/api/chess/join/', {
			method: 'POST',
			credentials: 'include',
		});
		if (!res.ok) {
			const text = await res.text();
			console.error('Chess join failed:', res.status, text);
			if (waitingEl) waitingEl.classList.add('hidden');
			if (statusEl) {
				statusEl.textContent = res.status === 401
					? 'Please log in to play online.'
					: 'Could not join a game. Please try again.';
			}
			return;
		}
		const data = await res.json();
		gameId = data.gameId;
	} catch (err) {
		console.error('Failed to join chess game:', err);
		if (waitingEl) waitingEl.classList.add('hidden');
		if (statusEl) statusEl.textContent = 'Failed to connect. Please try again.';
		return;
	}

	// --- 2. Open WebSocket ---
	// No trailing slash after gameId — Django matches `ws/chess/<uuid>` only (see chessgame/routing.py).
	const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
	const ws = new WebSocket(`${proto}//${location.host}/ws/chess/${gameId}`);

	// --- 3. WebSocket message handler ---
	ws.onmessage = (event) => {
		const data = JSON.parse(event.data);

		if (data.type === 'assign') {
			myColor = data.color;
			if (statusEl) statusEl.textContent = `You are ${myColor}. Waiting for opponent...`;
		}

		else if (data.type === 'gameStart') {
			gameActive = true;
			whiteName  = data.white;
			blackName  = data.black;
			if (waitingEl) waitingEl.classList.add('hidden');
			game.load(data.fen);
			myTurn = (myColor === 'white');
			setStatus(statusEl, myTurn, whiteName, blackName);
			renderBoard(game, boardEl, null, myColor === 'black');
		}

		else if (data.type === 'gameState') {
			selected = null;
			game.load(data.fen);
			myTurn = (myColor === data.turn);
			setStatus(statusEl, myTurn, whiteName, blackName);
			renderBoard(game, boardEl, null, myColor === 'black');
		}

		else if (data.type === 'gameOver') {
			gameActive = false;
			myTurn     = false;
			selected   = null;
			renderBoard(game, boardEl, null, myColor === 'black');
			const winner = data.winner;
			const msg = winner === null
				? 'Draw!'
				: `${winner.charAt(0).toUpperCase() + winner.slice(1)} wins! (${data.result})`;
			setTimeout(() => alert(msg), 100);
		}
	};

	ws.onclose = () => {
		gameActive = false;
		myTurn     = false;
	};

	// --- 4. Click handler ---
	boardEl.addEventListener('click', (e) => {
		if (!myTurn || !gameActive) return;

		const square = e.target.closest('[data-notation]');
		if (!square) return;

		const notation = square.dataset.notation;
		const piece    = game.get(notation);

		if (!selected) {
			// Select one of our own pieces
			if (piece && piece.color === myColor[0]) {
				selected = notation;
				renderBoard(game, boardEl, selected, myColor === 'black');
			}
			return;
		}

		// A piece is already selected — handle second click
		if (piece && piece.color === myColor[0]) {
			// Switch selection to another own piece
			selected = notation;
			renderBoard(game, boardEl, selected, myColor === 'black');
			return;
		}

		const move = game.moves({ square: selected, verbose: true })
		                 .find(m => m.to === notation);

		if (!move) {
			// Clicked on an invalid target — deselect
			selected = null;
			renderBoard(game, boardEl, null, myColor === 'black');
			return;
		}

		if (move.flags.includes('p')) {
			// Pawn promotion — show picker, send move after piece is chosen
			handleOnlinePromotion(selected, notation, ws, () => {
				selected = null;
				myTurn   = false;
				renderBoard(game, boardEl, null, myColor === 'black');
			});
		} else {
			ws.send(JSON.stringify({ type: 'move', from: selected, to: notation }));
			selected = null;
			myTurn   = false;
			renderBoard(game, boardEl, null, myColor === 'black');
		}
	});
}

function handleOnlinePromotion(fromSquare, toSquare, ws, onSent) {
	const picker = document.getElementById('promotion-picker');
	picker.classList.remove('hidden');

	picker.addEventListener('click', (e) => {
		const piece = e.target.dataset.piece;
		if (!piece) return;
		picker.classList.add('hidden');
		ws.send(JSON.stringify({ type: 'move', from: fromSquare, to: toSquare, promotion: piece }));
		onSent();
	}, { once: true });
}

function setStatus(statusEl, myTurn, whiteName, blackName) {
	if (!statusEl) return;
	if (myTurn) {
		statusEl.textContent = 'Your turn';
	} else {
		statusEl.textContent = "Opponent's turn";
	}
}
