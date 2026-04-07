//end of game overlay, chess.com style panel, close is only the x top left

function escapeHtml(text) {
	const div = document.createElement('div');
	div.textContent = text;
	return div.innerHTML;
}

//outcome picks the top border color, title and subtitle are plain text
export function showChessResultModal({ outcome = 'draw', title, subtitle = '' }) {
	const existing = document.getElementById('chess-result-modal-overlay');
	if (existing) existing.remove();

	const border = {
		win: 'border-emerald-500',
		loss: 'border-red-500',
		draw: 'border-slate-400',
		neutral: 'border-amber-500/90',
	}[outcome] || 'border-slate-400';

	const overlay = document.createElement('div');
	overlay.id = 'chess-result-modal-overlay';
	overlay.className =
		'fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-[3px] p-4';
	overlay.setAttribute('role', 'dialog');
	overlay.setAttribute('aria-modal', 'true');
	overlay.setAttribute('aria-labelledby', 'chess-result-modal-title');

	overlay.innerHTML = `
		<div class="relative w-full max-w-[22rem] rounded-lg border-t-4 ${border} bg-[#262421] shadow-2xl shadow-black/90 ring-1 ring-white/[0.08] overflow-hidden">
			<button type="button" class="chess-modal-close absolute top-3 left-3 z-10 flex h-9 w-9 items-center justify-center rounded-md text-white/65 hover:bg-white/[0.08] hover:text-white transition-colors" aria-label="Close">
				<span class="text-2xl leading-none font-light select-none">&times;</span>
			</button>
			<div class="pt-12 pb-9 px-7 text-center">
				<h2 id="chess-result-modal-title" class="text-[1.65rem] font-semibold tracking-tight text-white mb-1.5">${escapeHtml(title)}</h2>
				${subtitle ? `<p class="text-[0.95rem] text-white/60 leading-relaxed">${escapeHtml(subtitle)}</p>` : ''}
			</div>
		</div>
	`;

	const close = () => overlay.remove();
	overlay.querySelector('.chess-modal-close').addEventListener('click', close);

	document.body.appendChild(overlay);
}
