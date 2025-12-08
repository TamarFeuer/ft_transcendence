import { TranslationKey } from '../keys';

export const es: Record<TranslationKey, string> = {
  [TranslationKey.PAGE_TITLE]: 'Pong',
  [TranslationKey.MAIN_TITLE]: 'Pong',
  
  [TranslationKey.BTN_TIC_TAC_TOE]: 'Tres en Raya',
  [TranslationKey.BTN_MINESWEEPER]: 'Buscaminas',
  [TranslationKey.BTN_PONG]: 'Pong',
  
  [TranslationKey.BTN_LOCAL]: 'LOCAL',
  [TranslationKey.BTN_ONLINE]: 'EN LÍNEA',
  [TranslationKey.BTN_SINGLEPLAYER]: 'UN JUGADOR',
  [TranslationKey.BTN_MULTIPLAYER]: 'MULTIJUGADOR',
  [TranslationKey.BTN_TOURNAMENT]: 'TORNEO',
  
  [TranslationKey.LABEL_PLAYER_COUNT]: 'Introduce el número de jugadores:',
  [TranslationKey.BTN_START_GAME]: 'INICIAR JUEGO',
  [TranslationKey.BTN_REGISTER_PLAYERS]: 'REGISTRAR JUGADORES',
  [TranslationKey.LABEL_PLAYER_ALIAS]: 'Introduce tu alias:',
  [TranslationKey.BTN_SET_ALIAS]: 'ESTABLECER ALIAS',
  
  [TranslationKey.PLAYER_1]: 'Jugador 1',
  [TranslationKey.PLAYER_2]: 'Jugador 2',
  [TranslationKey.LABEL_LANGUAGE]: 'Idioma:',
  
  [TranslationKey.MSG_PLAYER_WINS]: '¡{player} gana!',
  [TranslationKey.MSG_TIC_TAC_TOE_NOT_IMPLEMENTED]: 'Tres en Raya seleccionado. (Aún no implementado)',
  [TranslationKey.MSG_MINESWEEPER_NOT_IMPLEMENTED]: 'Buscaminas seleccionado. (Aún no implementado)',
  [TranslationKey.MSG_PLAYERS_REGISTERED]: 'Registrados {count} jugadores para el torneo.',
  [TranslationKey.MSG_MIN_PLAYERS_ERROR]: 'El número de jugadores debe ser 2 o más.',
  [TranslationKey.MSG_ALIAS_SET]: 'Alias "{alias}" establecido. Introduce el alias del jugador {next}.',
  [TranslationKey.MSG_ALL_PLAYERS_REGISTERED]: 'Todos los {count} jugadores registrados: {players}. Comenzando el juego.',
  [TranslationKey.MSG_VALID_ALIAS_ERROR]: 'Por favor, introduce un alias válido.',
  [TranslationKey.MSG_STARTING_ONLINE_MULTIPLAYER]: 'Iniciando Juego Multijugador en Línea',
  [TranslationKey.MSG_STARTING_ONLINE_TOURNAMENT]: 'Iniciando Torneo en Línea',
  [TranslationKey.MSG_STARTING_SINGLEPLAYER]: 'Iniciando Juego de Un Jugador',
  [TranslationKey.MSG_STARTING_GAME_WITH_PLAYERS]: 'Iniciando {mode} con {count} jugadores',
  
  [TranslationKey.WS_CONNECTED]: 'WS conectado',
  [TranslationKey.WS_ERROR]: 'Error de WS',
  [TranslationKey.WS_MESSAGE]: 'Mensaje de WS',
  [TranslationKey.WS_ROLE]: 'rol:',
  
  [TranslationKey.TTT_TITLE]: 'Jugar Tres en Raya',
  [TranslationKey.TTT_PLAY_AS_X]: 'Jugar como X',
  [TranslationKey.TTT_PLAY_AS_O]: 'Jugar como O',
  [TranslationKey.TTT_GAME_OVER_TIE]: 'Fin del Juego: Empate.',
  [TranslationKey.TTT_GAME_OVER_WINS]: 'Fin del Juego: {winner} gana.',
  [TranslationKey.TTT_PLAY_AS]: 'Jugar como {player}',
  [TranslationKey.TTT_COMPUTER_THINKING]: 'Computadora pensando...',
  [TranslationKey.TTT_PLAY_AGAIN]: 'Jugar de Nuevo',
  
  [TranslationKey.MINE_TITLE]: 'Jugar Buscaminas',
  [TranslationKey.MINE_RULE_1]: 'Haz clic en una celda para revelarla.',
  [TranslationKey.MINE_RULE_2]: 'Haz clic derecho en una celda para marcarla como mina.',
  [TranslationKey.MINE_RULE_3]: '¡Marca todas las minas con éxito para ganar!',
  [TranslationKey.MINE_PLAY_GAME]: 'Jugar',
  [TranslationKey.MINE_AI_HELP]: 'Ayuda IA',
  [TranslationKey.MINE_RESTART]: 'Reiniciar',
  [TranslationKey.MINE_LOST]: 'Perdido',
  [TranslationKey.MINE_WON]: 'Ganado',
};
