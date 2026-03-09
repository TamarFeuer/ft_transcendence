import { Chess } from 'chess.js'

const pieces = {
    w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
    b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

export function initChessGame(){
	const game = new Chess();
	const boardEl = document.getElementById('chess-board');
	const turnEl = document.getElementById('turn-indicator');


	boardEl.className = 'grid grid-cols-8 w-[36rem] h-[36rem] auto-rows-fr';
	renderBoard(game, boardEl);
}

function renderBoard(game, boardEl){
	console.log(game.board());

	boardEl.innerHTML = '';
	//go through each row to render the pieces and the board
	game.board().forEach((row, rowIndex) => {
		row.forEach((cell, cellIndex) => {
			const square = document.createElement('div');
			//which square needs to be light
			const isLight = (rowIndex + cellIndex) % 2 === 0
			square.className = `w-full h-full flex items-center justify-center text-4xl ${isLight ? 'bg-amber-100' : 'bg-amber-800'}`;
			//if cell has a piece then render the piece
			if (cell){
				console.log('cell type', cell.type);
				const symbol = pieces[cell.color][cell.type];
				square.textContent = symbol;
			}
			boardEl.appendChild(square);
		})
	})
}