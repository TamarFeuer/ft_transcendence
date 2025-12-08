import { TranslationKey } from '../keys';

export const fr: Record<TranslationKey, string> = {
  [TranslationKey.PAGE_TITLE]: 'Pong',
  [TranslationKey.MAIN_TITLE]: 'Pong',
  
  [TranslationKey.BTN_TIC_TAC_TOE]: 'Morpion',
  [TranslationKey.BTN_MINESWEEPER]: 'Démineur',
  [TranslationKey.BTN_PONG]: 'Pong',
  
  [TranslationKey.BTN_LOCAL]: 'LOCAL',
  [TranslationKey.BTN_ONLINE]: 'EN LIGNE',
  [TranslationKey.BTN_SINGLEPLAYER]: 'SOLO',
  [TranslationKey.BTN_MULTIPLAYER]: 'MULTIJOUEUR',
  [TranslationKey.BTN_TOURNAMENT]: 'TOURNOI',
  
  [TranslationKey.LABEL_PLAYER_COUNT]: 'Entrez le nombre de joueurs:',
  [TranslationKey.BTN_START_GAME]: 'COMMENCER',
  [TranslationKey.BTN_REGISTER_PLAYERS]: 'INSCRIRE JOUEURS',
  [TranslationKey.LABEL_PLAYER_ALIAS]: 'Entrez votre alias:',
  [TranslationKey.BTN_SET_ALIAS]: 'DÉFINIR ALIAS',
  
  [TranslationKey.PLAYER_1]: 'Joueur 1',
  [TranslationKey.PLAYER_2]: 'Joueur 2',
  [TranslationKey.LABEL_LANGUAGE]: 'Langue:',
  
  [TranslationKey.MSG_PLAYER_WINS]: '{player} gagne!',
  [TranslationKey.MSG_TIC_TAC_TOE_NOT_IMPLEMENTED]: 'Morpion sélectionné. (Pas encore implémenté)',
  [TranslationKey.MSG_MINESWEEPER_NOT_IMPLEMENTED]: 'Démineur sélectionné. (Pas encore implémenté)',
  [TranslationKey.MSG_PLAYERS_REGISTERED]: '{count} joueurs inscrits pour le tournoi.',
  [TranslationKey.MSG_MIN_PLAYERS_ERROR]: 'Le nombre de joueurs doit être 2 ou plus.',
  [TranslationKey.MSG_ALIAS_SET]: 'Alias "{alias}" défini. Entrez l\'alias du joueur {next}.',
  [TranslationKey.MSG_ALL_PLAYERS_REGISTERED]: 'Tous les {count} joueurs inscrits: {players}. Début du jeu.',
  [TranslationKey.MSG_VALID_ALIAS_ERROR]: 'Veuillez entrer un alias valide.',
  [TranslationKey.MSG_STARTING_ONLINE_MULTIPLAYER]: 'Démarrage du jeu multijoueur en ligne',
  [TranslationKey.MSG_STARTING_ONLINE_TOURNAMENT]: 'Démarrage du tournoi en ligne',
  [TranslationKey.MSG_STARTING_SINGLEPLAYER]: 'Démarrage du jeu solo',
  [TranslationKey.MSG_STARTING_GAME_WITH_PLAYERS]: 'Démarrage de {mode} avec {count} joueurs',
  
  [TranslationKey.WS_CONNECTED]: 'WS connecté',
  [TranslationKey.WS_ERROR]: 'Erreur WS',
  [TranslationKey.WS_MESSAGE]: 'Message WS',
  [TranslationKey.WS_ROLE]: 'rôle:',
  
  [TranslationKey.TTT_TITLE]: 'Jouer au Morpion',
  [TranslationKey.TTT_PLAY_AS_X]: 'Jouer en tant que X',
  [TranslationKey.TTT_PLAY_AS_O]: 'Jouer en tant que O',
  [TranslationKey.TTT_GAME_OVER_TIE]: 'Fin du jeu: Égalité.',
  [TranslationKey.TTT_GAME_OVER_WINS]: 'Fin du jeu: {winner} gagne.',
  [TranslationKey.TTT_PLAY_AS]: 'Jouer en tant que {player}',
  [TranslationKey.TTT_COMPUTER_THINKING]: 'Ordinateur réfléchit...',
  [TranslationKey.TTT_PLAY_AGAIN]: 'Rejouer',
  
  [TranslationKey.MINE_TITLE]: 'Jouer au Démineur',
  [TranslationKey.MINE_RULE_1]: 'Cliquez sur une cellule pour la révéler.',
  [TranslationKey.MINE_RULE_2]: 'Clic droit sur une cellule pour la marquer comme mine.',
  [TranslationKey.MINE_RULE_3]: 'Marquez toutes les mines avec succès pour gagner!',
  [TranslationKey.MINE_PLAY_GAME]: 'Jouer',
  [TranslationKey.MINE_AI_HELP]: 'Aide IA',
  [TranslationKey.MINE_RESTART]: 'Recommencer',
  [TranslationKey.MINE_LOST]: 'Perdu',
  [TranslationKey.MINE_WON]: 'Gagné',
};
