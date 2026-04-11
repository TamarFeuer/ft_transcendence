let tournamentSocket = null;
let reconnectTimer = null;
let activeTournamentId = null;

export function stopTournamentUpdatesSocket() {
	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}

	activeTournamentId = null;

	if (tournamentSocket) {
		try {
			tournamentSocket.onopen = null;
			tournamentSocket.onmessage = null;
			tournamentSocket.onerror = null;
			tournamentSocket.onclose = null;
			tournamentSocket.close();
		} catch (err) {
			console.warn('Failed to close tournament socket cleanly:', err);
		}
		tournamentSocket = null;
	}
}

export function startTournamentUpdatesSocket(tournamentId, onEvent) {
	stopTournamentUpdatesSocket();
	activeTournamentId = String(tournamentId);

	const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
	const url = `${protocol}//${window.location.host}/ws/tournament/${activeTournamentId}`;

	const connect = () => {
		if (!activeTournamentId) return;

		tournamentSocket = new WebSocket(url);

		tournamentSocket.onopen = () => {
			console.log('Tournament WS connected:', activeTournamentId);
		};

		tournamentSocket.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (onEvent) onEvent(data);
			} catch (err) {
				console.error('Failed to parse tournament WS message:', err);
			}
		};

		tournamentSocket.onerror = (err) => {
			console.error('Tournament WS error:', err);
		};

		tournamentSocket.onclose = () => {
			tournamentSocket = null;
			if (!activeTournamentId) return;

			reconnectTimer = setTimeout(() => {
				connect();
			}, 2000);
		};
	};

	connect();
}

