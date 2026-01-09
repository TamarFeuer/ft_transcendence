
import { TranslationKey } from '../keys';

export const tr = {
  [TranslationKey.PAGE_TITLE]: 'Pong',
  [TranslationKey.MAIN_TITLE]: 'Pong',
  
  [TranslationKey.BTN_TIC_TAC_TOE]: 'XOX Oyunu',
  [TranslationKey.BTN_MINESWEEPER]: 'Mayın Tarlası',
  [TranslationKey.BTN_PONG]: 'Pong',
  
  [TranslationKey.BTN_LOCAL]: 'YEREL',
  [TranslationKey.BTN_ONLINE]: 'ÇEVRİMİÇİ',
  [TranslationKey.BTN_SINGLEPLAYER]: 'TEK OYUNCU',
  [TranslationKey.BTN_MULTIPLAYER]: 'ÇOK OYUNCU',
  [TranslationKey.BTN_TOURNAMENT]: 'TURNUVA',
  
  [TranslationKey.LABEL_PLAYER_COUNT]: 'Oyuncu sayısını girin:',
  [TranslationKey.BTN_START_GAME]: 'OYUNU BAŞLAT',
  [TranslationKey.BTN_REGISTER_PLAYERS]: 'OYUNCULARI KAYDET',
  [TranslationKey.LABEL_PLAYER_ALIAS]: 'Takma adınızı girin:',
  [TranslationKey.BTN_SET_ALIAS]: 'TAKMA AD AYARLA',
  
  [TranslationKey.PLAYER_1]: 'Oyuncu 1',
  [TranslationKey.PLAYER_2]: 'Oyuncu 2',
  [TranslationKey.LABEL_LANGUAGE]: 'Dil:',
  
  [TranslationKey.MSG_PLAYER_WINS]: '{player} kazandı!',
  [TranslationKey.MSG_TIC_TAC_TOE_NOT_IMPLEMENTED]: 'XOX seçildi. (Henüz uygulanmadı)',
  [TranslationKey.MSG_MINESWEEPER_NOT_IMPLEMENTED]: 'Mayın Tarlası seçildi. (Henüz uygulanmadı)',
  [TranslationKey.MSG_PLAYERS_REGISTERED]: 'Turnuva için {count} oyuncu kaydedildi.',
  [TranslationKey.MSG_MIN_PLAYERS_ERROR]: 'Oyuncu sayısı 2 veya daha fazla olmalıdır.',
  [TranslationKey.MSG_ALIAS_SET]: '"{alias}" takma adı ayarlandı. Oyuncu {next} için takma ad girin.',
  [TranslationKey.MSG_ALL_PLAYERS_REGISTERED]: 'Tüm {count} oyuncu kaydedildi: {players}. Oyun başlatılıyor.',
  [TranslationKey.MSG_VALID_ALIAS_ERROR]: 'Lütfen geçerli bir takma ad girin.',
  [TranslationKey.MSG_STARTING_ONLINE_MULTIPLAYER]: 'Çevrimiçi Çok Oyuncu Oyunu Başlatılıyor',
  [TranslationKey.MSG_STARTING_ONLINE_TOURNAMENT]: 'Çevrimiçi Turnuva Başlatılıyor',
  [TranslationKey.MSG_STARTING_SINGLEPLAYER]: 'Tek Oyuncu Oyunu Başlatılıyor',
  [TranslationKey.MSG_STARTING_GAME_WITH_PLAYERS]: '{count} oyuncuyla {mode} başlatılıyor',
  
  [TranslationKey.WS_CONNECTED]: 'WS bağlandı',
  [TranslationKey.WS_ERROR]: 'WS hatası',
  [TranslationKey.WS_MESSAGE]: 'WS mesajı',
  [TranslationKey.WS_ROLE]: 'rol:',
  
  [TranslationKey.TTT_TITLE]: 'XOX Oyunu Oyna',
  [TranslationKey.TTT_PLAY_AS_X]: 'X olarak oyna',
  [TranslationKey.TTT_PLAY_AS_O]: 'O olarak oyna',
  [TranslationKey.TTT_GAME_OVER_TIE]: 'Oyun Bitti: Berabere.',
  [TranslationKey.TTT_GAME_OVER_WINS]: 'Oyun Bitti: {winner} kazandı.',
  [TranslationKey.TTT_PLAY_AS]: '{player} olarak oyna',
  [TranslationKey.TTT_COMPUTER_THINKING]: 'Bilgisayar düşünüyor...',
  [TranslationKey.TTT_PLAY_AGAIN]: 'Tekrar Oyna',
  [TranslationKey.MINE_TITLE]: 'Mayın Tarlası Oyna',
  [TranslationKey.MINE_RULE_1]: 'Bir hücreyi açmak için tıklayın.',
  [TranslationKey.MINE_RULE_2]: 'Bir hücreyi mayın olarak işaretlemek için sağ tıklayın.',
  [TranslationKey.MINE_RULE_3]: 'Kazanmak için tüm mayınları başarıyla işaretleyin!',
  [TranslationKey.MINE_PLAY_GAME]: 'Oyunu Başlat',
  [TranslationKey.MINE_AI_HELP]: 'YZ Yardım',
  [TranslationKey.MINE_RESTART]: 'Yeniden Başlat',
  [TranslationKey.MINE_LOST]: 'Kaybettiniz',
  [TranslationKey.MINE_WON]: 'Kazandınız',

  [TranslationKey.SOCIALS_OPEN]: 'İletişim',
  [TranslationKey.SOCIALS_SAY_HI]: 'Merhaba de!',
  [TranslationKey.SOCIALS_BROADCAST]: 'Oturum açmış tüm kullanıcılara yayınla',
  [TranslationKey.SOCIALS_USERS]: 'Kullanıcılar',
  [TranslationKey.SOCIALS_CHAT_WITH]: 'Oturum açmış kullanıcılarla sohbet et',
  [TranslationKey.SOCIALS_FRIENDS]: 'Arkadaşlar',
  [TranslationKey.SOCIALS_PLAY]: 'Arkadaşlarınla oyna',
  [TranslationKey.SOCIALS_CLOSE]: 'X',
  [TranslationKey.SOCIALS_SEND]: 'Gönder',
  [TranslationKey.SOCIALS_LIST]: 'Arkadaş listesi burada',
  [TranslationKey.SOCIALS_TYPE_HERE]: 'Bir mesaj yaz...',
  // Routes / Pages
  [TranslationKey.ONLINE_TITLE]: 'Çevrimiçi Oyun',
  [TranslationKey.ONLINE_CREATE_GAME]: 'Oyun Oluştur',
  [TranslationKey.ONLINE_BACK]: 'Geri',
  [TranslationKey.ONLINE_REFRESH_GAMES]: 'Oyunları Yenile',

  [TranslationKey.TOURNAMENT_TITLE]: 'Turnuva',
  [TranslationKey.TOURNAMENT_START]: 'Turnuvayı Başlat',
  [TranslationKey.TOURNAMENT_BACK]: 'Geri',
  [TranslationKey.TOURNAMENT_PLAYERS_PLACEHOLDER]: 'Oyuncular',
  [TranslationKey.TOURNAMENT_REFRESH]: 'Oyunları Yenile',

  [TranslationKey.PONG_LOCAL]: 'Yerel Oyun',
  [TranslationKey.PONG_AI]: 'YZ Rakibi Oyunu',
  [TranslationKey.PONG_TOURNAMENT]: 'Turnuva',
  [TranslationKey.PONG_ONLINE]: 'Çevrimiçi Oyun',

  // User Management
  [TranslationKey.UM_USER]: 'Kullanıcı',
  [TranslationKey.UM_LOGIN_TITLE]: 'Giriş Yap',
  [TranslationKey.UM_LOGIN_BTN]: 'Giriş Yap',
  [TranslationKey.UM_LOGGED_IN]: 'Giriş yapıldı',
  [TranslationKey.UM_REGISTER_TITLE]: 'Kayıt Ol',
  [TranslationKey.UM_REGISTER_BTN]: 'Kayıt Ol',
  [TranslationKey.UM_USERNAME_PLACEHOLDER]: 'kullanıcı adı',
  [TranslationKey.UM_PASSWORD_PLACEHOLDER]: 'şifre',
};


