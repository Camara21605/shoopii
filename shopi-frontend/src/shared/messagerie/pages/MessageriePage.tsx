/**
 * src/shared/messagerie/pages/MessageriePage.tsx
 *
 * Page wrapper de la messagerie pour le site public (/messagerie).
 *
 * ✅ Le Header principal du site (logo, recherche, notifications, avatar…)
 *    est volontairement MASQUÉ ici, sur le même principe que le dashboard
 *    entreprise : quand on est dans la messagerie, un seul "topbar" doit
 *    rester visible — celui de la messagerie elle-même (ChatHeader dans
 *    MessagerieCore), pas les menus de la page principale en plus.
 *    Ça évite d'avoir deux barres de navigation superposées et ça laisse
 *    toute la hauteur d'écran à la conversation.
 *
 * Utilisée par tous les rôles (client, livreur, vendeur…)
 * qui accèdent à /messagerie depuis le site home.
 */
import { useSearchParams } from 'react-router-dom';
import MessagerieCore from '../MessagerieCore';
import { useForceDarkTheme } from '../../context/ThemeContext';
import s from '../styles/MessagerieLayout.module.css';

export default function MessageriePage() {
  // ✅ Cette page n'a plus de mode clair — voir useForceDarkTheme.
  useForceDarkTheme();

  /* ?conv={conversationId} — lien profond posé par une notification
   * message.received / call.* (voir notificationUtils.resolveNavTarget
   * et NotificationEventService.notifyMessageReceived). */
  const [searchParams] = useSearchParams();
  const initialConversationId = searchParams.get('conv') ?? undefined;

  return (
    // MessagerieCore occupe maintenant toute la hauteur de l'écran,
    // puisqu'il n'y a plus de Header au-dessus dont il faudrait décaler
    // le contenu (d'où la suppression du paddingTop: 66 qui réservait
    // sa place).
    //
    // ⚠️ '--hdr': 0px est INDISPENSABLE ici : MessagerieCore calcule sa
    // hauteur en `calc(100vh - var(--hdr, 66px))` en supposant qu'un
    // header de 66px reste affiché au-dessus de lui. Comme ce n'est plus
    // le cas sur cette page (Header masqué juste au-dessus), il faut
    // annuler cette variable — sinon il reste un espace vide de 66px en
    // bas de l'écran et la zone de saisie du message remonte d'autant
    // (même correctif que le dashboard entreprise, voir EntrepriseApp.css
    // → .main.main-fullscreen).
    //
    // ⚠️ '--msg-bnav': 0px — MÊME PROBLÈME, mais pour la barre de
    // navigation mobile (62px) : en dessous de 768px de large,
    // MessagerieLayout.module.css réserve aussi 62px en bas pour une
    // bottom-nav fixe — qui existe sur les dashboards mais PAS sur cette
    // page publique. Sans cette annulation, il reste un 2e espace vide
    // (62px) sous la zone de saisie sur mobile, en plus du 1er.
    <div
      className={s.pageWrap}
      style={{
        ['--hdr' as any]:      '0px',
        ['--msg-bnav' as any]: '0px',
      }}
    >
      <MessagerieCore initialConversationId={initialConversationId} />
    </div>
  );
}
