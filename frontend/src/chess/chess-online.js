import { Chess } from 'chess.js'
import { renderBoard } from './chess.js'
import { showChessResultModal } from './chess-modal.js'
import { navigate } from '../routes/route_helpers.js'

let _chessWs = null;

export function closeChessConnection(){
	if (_chessWs && (_chessWs.readyState === WebSocket.OPEN || _chessWs.readyState === WebSocket.CONNECTING)){
		_chessWs.close();
	}
	_chessWs = null;
}

function subtitleFromResult(result) {
	if (!result) return '';
	const r = String(result).toLowerCase();
	if (r === 'abandonment')        return 'Your opponent left the game.';
	if (r === '1-0')                return 'White wins';
	if (r === '0-1')                return 'Black wins';
	if (r === '1/2-1/2' || r === '1/2') return 'Game drawn';
	if (r.includes('checkmate'))    return 'Checkmate';
	if (r.includes('stalemate'))    return 'Stalemate';
	if (r.includes('insufficient')) return 'Insufficient material';
	if (r.includes('repetition'))   return 'Threefold repetition';
	if (r.includes('fifty'))        return 'Fifty-move rule';
	return String(result);
}

function updateStatus(statusEl, myTurn) {
	if (!statusEl) return;
	statusEl.textContent = myTurn ? 'Your turn' : "Opponent's turn";
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

export async function initOnlineChessGame(gameId = null){
	const boardEl   = document.getElementById('chess-board');
	const waitingEl = document.getElementById('waiting-overlay');
	const statusEl  = document.getElementById('game-status');

	boardEl.className = 'grid grid-cols-8 w-[36rem] h-[36rem] auto-rows-fr';

	const game = new Chess();
	let myColor   = null;
	let selected  = null;
	let myTurn    = false;
	let gameActive = false;

	//if no gameId was passed in, ask the server for one (normal matchmaking flow)
	if (!gameId) {
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
	}

	const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
	const ws = new WebSocket(`${proto}//${location.host}/ws/chess/${gameId}`);
	_chessWs = ws;

	ws.onmessage = (event) => {
		const data = JSON.parse(event.data);

		if (data.type === 'assign') {
			myColor = data.color;
			if (statusEl) statusEl.textContent = `You are ${myColor}. Waiting for opponent...`;
		}

		else if (data.type === 'gameStart') {
			gameActive = true;
			if (waitingEl) waitingEl.classList.add('hidden');
			game.load(data.fen);
			myTurn = (myColor === 'white');
			updateStatus(statusEl, myTurn);
			renderBoard(game, boardEl, null, myColor === 'black');
		}

		else if (data.type === 'gameState') {
			selected = null;
			game.load(data.fen);
			myTurn = (myColor === data.turn);
			updateStatus(statusEl, myTurn);
			renderBoard(game, boardEl, null, myColor === 'black');
		}

		else if (data.type === 'gameOver') {
			gameActive = false;
			myTurn     = false;
			selected   = null;
			renderBoard(game, boardEl, null, myColor === 'black');

			const sub = subtitleFromResult(data.result);
			const goToHub = () => navigate('/chess-hub');
			if (data.winner === null) {
				showChessResultModal({ outcome: 'draw', title: 'Draw', subtitle: sub || 'The game is a draw.', onClose: goToHub });
			} else if (myColor && data.winner === myColor) {
				showChessResultModal({ outcome: 'win', title: 'Victory', subtitle: sub || 'You won the game.', onClose: goToHub });
			} else {
				showChessResultModal({ outcome: 'loss', title: 'Defeat', subtitle: sub || 'You lost the game.', onClose: goToHub });
			}
		}
	};

	const browserExitHandler = () => closeChessConnection();
	window.addEventListener('beforeunload', browserExitHandler);
	window.addEventListener('pagehide', browserExitHandler);

	ws.onclose = () => {
		gameActive = false;
		myTurn     = false;
		_chessWs = null;
		window.dispatchEvent(new CustomEvent("chessGameLeft"));
		window.removeEventListener('beforeunload', browserExitHandler);
   		window.removeEventListener('pagehide',     browserExitHandler);
	};

	boardEl.addEventListener('click', (e) => {
		if (!myTurn || !gameActive) return;

		const square = e.target.closest('[data-notation]');
		if (!square) return;

		const notation = square.dataset.notation;
		const piece    = game.get(notation);

		if (!selected) {
			//only select your own pieces
			if (piece && piece.color === myColor[0]) {
				selected = notation;
				renderBoard(game, boardEl, selected, myColor === 'black');
			}
			return;
		}

		if (piece && piece.color === myColor[0]) {
			//switch selection to the new piece
			selected = notation;
			renderBoard(game, boardEl, selected, myColor === 'black');
			return;
		}

		const move = game.moves({ square: selected, verbose: true })
		                 .find(m => m.to === notation);

		if (!move) {
			selected = null;
			renderBoard(game, boardEl, null, myColor === 'black');
			return;
		}

		//if move is promotion show promotion picker
		if (move.flags.includes('p')) {
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
