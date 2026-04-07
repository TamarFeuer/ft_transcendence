import { Chess } from 'chess.js'

let selectedSquare = null;

const pieces = {
    w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
    b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

function checkGameEnd(game){
	if (game.isCheckmate()) {

		const winner = game.turn() === 'w' ? 'Black' : 'White'; // turn has already switched
		alert(`${winner} wins by checkmate!`);
	}
	if (game.isDraw()) {
		alert('Draw!');
	}
}

function handlePromotion(game, boardEl, fromSquare, toSquare){
	const picker = document.getElementById('promotion-picker');
	picker.classList.remove('hidden');

	picker.addEventListener('click', (e) => {
		const piece = e.target.dataset.piece;
		if (!piece)
			return;

		game.move({from: fromSquare, to: toSquare, promotion: piece});
		picker.classList.add('hidden');
		selectedSquare = null;
		checkGameEnd(game);
		renderBoard(game, boardEl, selectedSquare);
	}, {once: true});
}

function handleSquareClick(game, square, boardEl){
	if (!selectedSquare){
		const piece = game.get(square.dataset.notation);
		console.log('piece is', piece);
		if (piece){

			if (piece.color === game.turn()){
				selectedSquare = square.dataset.notation;
				renderBoard(game, boardEl, selectedSquare);
			}
		}
	}
	else {
		const piece = game.get(square.dataset.notation);
		if (piece && piece.color === game.turn()) {
			// switch selection to the new piece
			selectedSquare = square.dataset.notation;
			renderBoard(game, boardEl, selectedSquare);
		}
		else{
			//check if move results to a promotion
			const move = game.moves({square: selectedSquare, verbose: true}).find(m => m.to === square.dataset.notation);

			//if move is promotion show promotion table
			if (move && move.flags.includes('p')){
				handlePromotion(game, boardEl, selectedSquare, square.dataset.notation);
				return;
			}

			//move the piece to desired square
			const resultedMove = game.move({from: selectedSquare, to: square.dataset.notation});
			if (!resultedMove){
				//TODO show that move is illegal with an animation or sound
			}
			selectedSquare = null;
			//check if game ended and alert players
			checkGameEnd(game);
			renderBoard(game, boardEl, selectedSquare);
		}
	}
}

export function initChessGame(){
	const game = new Chess();
	console.log('initChessGame called');
	const boardEl = document.getElementById('chess-board');
	// const turnEl = document.getElementById('turn-indicator');


	boardEl.className = 'grid grid-cols-8 w-[36rem] h-[36rem] auto-rows-fr';
	// console.log('it goes before click');
	boardEl.addEventListener('click', (e) => {
		const square = e.target.closest('[data-notation]');

		if (square){
			handleSquareClick(game, square, boardEl);
		}
	})
	renderBoard(game, boardEl, selectedSquare);
}

function getNotation(rowIndex, columnIndex){
	const rows = ['8', '7', '6', '5', '4', '3', '2', '1'];
	const columns = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

	return columns[columnIndex] + rows[rowIndex];
}

function drawDot(square){
	const dotWrap = document.createElement('div');
	dotWrap.className = 'absolute inset-0 flex items-center justify-center pointer-events-none';

	const dot = document.createElement('div');
	dot.className = 'w-3 h-3 rounded-full bg-gray-400/70';

	dotWrap.appendChild(dot);
	square.appendChild(dotWrap);
}

export function renderBoard(game, boardEl, selectedSquare, flipped = false){

	let possibleMoves = [];

	boardEl.innerHTML = '';
	if (selectedSquare){
		possibleMoves = game.moves({
			square: selectedSquare,
			verbose: true}).map(m => m.to); //return an array of only the "to" squares the piece can move
		}
	//in case player is black, flip the board for them
	let rows = game.board();
	if (flipped){
		rows = rows.reverse();
		rows = rows.map(row => row.reverse());
	}	
	//go through each row to render the pieces and the board
	rows.forEach((row, rowIndex) => {
		row.forEach((cell, cellIndex) => {
			const square = document.createElement('div');
			//which square needs to be light
			const isLight = (rowIndex + cellIndex) % 2 === 0
			square.className = `relative w-full h-full flex items-center justify-center text-4xl ${isLight ? 'bg-amber-100' : 'bg-amber-800'}`;

			//name the square
			square.dataset.notation = getNotation(rowIndex, cellIndex);

			//if cell has a piece then render the piece
			if (cell){
				// console.log('cell type', cell.type, 'in square ', square.dataset.notation);
				const symbol = pieces[cell.color][cell.type];
				square.textContent = symbol;
			}

			//if user clicks their piece, highlight it
			if (square.dataset.notation === selectedSquare){
				square.className += ' [box-shadow:inset_0_0_0_3px_rgb(250_204_21)]';
			}

			//highlight possible moves if user clicks their own piece
			if (possibleMoves.includes(square.dataset.notation)){
				drawDot(square);

			}
			boardEl.appendChild(square);
		})
	})
}