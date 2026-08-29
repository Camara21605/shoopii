/*
 * FICHIER : src/shared/messagerie/components/VirtualizedMessageList.tsx
 *
 * Virtualise la liste de bulles de message avec react-window
 * (VariableSizeList) — seules les bulles visibles (+ marge de rendu de
 * react-window, overscanCount par défaut) sont montées dans le DOM,
 * quel que soit le nombre de messages déjà chargés en mémoire pour la
 * conversation ouverte (but : ne pas rendre inutilement des centaines/
 * milliers de bulles après plusieurs "charger les messages plus anciens").
 *
 * Hauteur des bulles : imprévisible à l'avance (texte multi-lignes,
 * image, vidéo, vocal, carte commande/produit/position) → mesurée
 * réellement via ResizeObserver sur chaque ligne rendue (voir Row),
 * mise en cache PAR ID DE MESSAGE (pas par index — un id garde sa
 * hauteur mesurée même après une insertion de messages plus anciens
 * en tête de liste, qui décale tous les index existants).
 *
 * Pas d'AutoSizer externe (react-virtualized-auto-sizer) — un
 * ResizeObserver maison sur le conteneur (useAutoSize) suffit et évite
 * une dépendance de plus pour un besoin aussi simple.
 *
 * LIMITE CONNUE (documentée, pas un bug) : au chargement de messages
 * plus anciens, leurs hauteurs réelles ne sont pas encore mesurées au
 * moment où on repositionne le scroll (ResizeObserver est asynchrone,
 * après le layout) — la position est donc recalculée avec une
 * ESTIMATION (ROW_HEIGHT_ESTIMATE), puis légèrement corrigée au fil des
 * mesures réelles qui arrivent dans la frame suivante (quelques px de
 * réajustement visuel, pas un saut brutal). Une liste comme
 * react-virtuoso a un mode dédié ("firstItemIndex") pour éliminer même
 * ce léger réajustement, mais ajoute une dépendance et une API
 * entièrement différente — hors périmètre ici.
 *
 * NE VIRTUALISE PAS les groupes de livraison (conv.isGroup, voir
 * MessagesZone.tsx qui bascule sur le rendu natif dans ce cas) —
 * bannière profil éditable en tête de liste + volume de messages
 * typiquement faible et borné dans le temps (durée d'une livraison) :
 * le risque de toucher à cette UX pour un gain quasi nul n'en vaut pas
 * la peine.
 */
import { useRef, useCallback, useEffect, useLayoutEffect, useState, useImperativeHandle, forwardRef, memo } from 'react';
import type { ReactNode, Ref } from 'react';
import { VariableSizeList } from 'react-window';
import type { ListChildComponentProps } from 'react-window';
import type { ChatMessage, ChatUser } from '../data/messagerieTypes';
import MessageBubble from './MessageBubble';
import s from '../styles/ChatWindow.module.css';

const ROW_HEIGHT_ESTIMATE   = 76;
const LOAD_OLDER_THRESHOLD  = 300; // px depuis le haut avant de déclencher le chargement

interface Props {
  messages:    ChatMessage[];
  user:        ChatUser;
  lastReadIdx: number;
  onReply:     (r: { sender: string; text: string }) => void;
  onToast:     (msg: string, type?: string) => void;
  onDelete:    (msgId: string, mode: 'me' | 'everyone' | 'other') => void;
  onRetry?:    (msgId: string) => void;
  convId:      string;
  hasMoreMessages?: boolean;
  loadingOlder?:    boolean;
  onLoadOlderMessages?: (convId: string) => void;
  /** Rendu avant la liste (ex: message système "nouvelle conversation") — pas virtualisé, toujours en tête. */
  headerContent?: ReactNode;
}

/** Handle impératif — utilisé par MessagesZone pour les boutons "aller au début/à la fin". */
export interface VirtualizedMessageListHandle {
  scrollToStart: () => void;
  scrollToEnd:   () => void;
}

interface RowData {
  messages:    ChatMessage[];
  user:        ChatUser;
  lastReadIdx: number;
  onReply:     Props['onReply'];
  onToast:     Props['onToast'];
  onDelete:    Props['onDelete'];
  onRetry?:    Props['onRetry'];
  reportSize:  (id: string, index: number, height: number) => void;
}

/* ── Auto-sizing maison (évite la dépendance react-virtualized-auto-sizer) ── */
function useAutoSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const box = entries[0]?.contentRect;
      if (box) setSize({ width: box.width, height: box.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, size };
}

function Row({ index, style, data }: ListChildComponentProps<RowData>) {
  const { messages, user, lastReadIdx, onReply, onToast, onDelete, onRetry, reportSize } = data;
  const msg = messages[index];
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = rowRef.current;
    if (!el || !msg) return;
    const ro = new ResizeObserver(entries => {
      const h = entries[0]?.contentRect.height;
      if (h && h > 0) reportSize(msg.id, index, Math.ceil(h));
    });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg?.id, index]);

  if (!msg) return null;

  return (
    <div style={style}>
      <div ref={rowRef}>
        <MessageBubble
          msg={msg} idx={index} msgs={messages}
          user={user}
          isLastRead={index === lastReadIdx}
          onReply={onReply}
          onToast={onToast}
          onDelete={onDelete}
          onRetry={onRetry}
        />
      </div>
    </div>
  );
}

function VirtualizedMessageList({
  messages, user, lastReadIdx, onReply, onToast, onDelete, onRetry,
  convId, hasMoreMessages, loadingOlder, onLoadOlderMessages, headerContent,
}: Props, ref: Ref<VirtualizedMessageListHandle>) {
  const { ref: sizeRef, size } = useAutoSize<HTMLDivElement>();
  const listRef       = useRef<VariableSizeList>(null);
  const heightCache   = useRef<Map<string, number>>(new Map());
  const prevConvIdRef = useRef<string | null>(null);
  const prevFirstIdRef = useRef<string | null>(null);
  const prevLastIdRef  = useRef<string | null>(null);
  const prevLenRef     = useRef(0);
  const lastScrollOffsetRef = useRef(0);

  const getItemSize = useCallback((index: number) => {
    const id = messages[index]?.id;
    if (id === undefined) return ROW_HEIGHT_ESTIMATE;
    return heightCache.current.get(id) ?? ROW_HEIGHT_ESTIMATE;
  }, [messages]);

  const reportSize = useCallback((id: string, index: number, height: number) => {
    if (heightCache.current.get(id) === height) return;
    heightCache.current.set(id, height);
    listRef.current?.resetAfterIndex(index, true);
  }, []);

  /* ── 3 cas, comme la version native dans MessagesZone.tsx (voir son
   * commentaire équivalent) : switch de conv / prepend (plus anciens) /
   * append (nouveau message). ── */
  useLayoutEffect(() => {
    const firstId = messages[0]?.id ?? null;
    const lastId  = messages[messages.length - 1]?.id ?? null;
    const convChanged = prevConvIdRef.current !== convId;

    if (convChanged) {
      heightCache.current.clear();
      listRef.current?.resetAfterIndex(0, true);
      requestAnimationFrame(() => listRef.current?.scrollToItem(Math.max(0, messages.length - 1), 'end'));
    } else if (firstId !== prevFirstIdRef.current && prevFirstIdRef.current !== null) {
      const addedCount = Math.max(0, messages.length - prevLenRef.current);
      listRef.current?.resetAfterIndex(0, true);
      listRef.current?.scrollTo(lastScrollOffsetRef.current + addedCount * ROW_HEIGHT_ESTIMATE);
    } else if (lastId !== prevLastIdRef.current) {
      requestAnimationFrame(() => listRef.current?.scrollToItem(Math.max(0, messages.length - 1), 'end'));
    }

    prevConvIdRef.current  = convId;
    prevFirstIdRef.current = firstId;
    prevLastIdRef.current  = lastId;
    prevLenRef.current     = messages.length;
  }, [messages, convId]);

  const handleScroll = useCallback(({ scrollOffset, scrollDirection }: { scrollOffset: number; scrollDirection: 'forward' | 'backward' }) => {
    lastScrollOffsetRef.current = scrollOffset;
    if (scrollDirection === 'backward' && scrollOffset < LOAD_OLDER_THRESHOLD && hasMoreMessages && !loadingOlder) {
      onLoadOlderMessages?.(convId);
    }
  }, [convId, hasMoreMessages, loadingOlder, onLoadOlderMessages]);

  useImperativeHandle(ref, () => ({
    scrollToStart: () => listRef.current?.scrollTo(0),
    scrollToEnd:   () => listRef.current?.scrollToItem(Math.max(0, messages.length - 1), 'end'),
  }), [messages.length]);

  const itemData: RowData = { messages, user, lastReadIdx, onReply, onToast, onDelete, onRetry, reportSize };

  return (
    <div
      ref={sizeRef}
      className={s.msgsZone}
      style={{ display: 'block', position: 'relative', overflow: 'hidden', padding: '20px 22px 32px' }}
    >
      {loadingOlder && (
        <div className={s.sysMsg} style={{ position: 'absolute', top: 4, left: 0, right: 0, zIndex: 1 }}>
          <i className="fas fa-spinner fa-spin" />
        </div>
      )}
      {headerContent}
      {size.width > 0 && size.height > 0 && messages.length > 0 && (
        <VariableSizeList
          ref={listRef}
          width={size.width}
          height={size.height}
          itemCount={messages.length}
          itemSize={getItemSize}
          itemData={itemData}
          itemKey={index => messages[index]?.id ?? index}
          onScroll={handleScroll}
          overscanCount={6}
        >
          {Row}
        </VariableSizeList>
      )}
    </div>
  );
}

/* Comparaison shallow par défaut suffit — `messages` change de référence
 * uniquement quand le contenu affiché change réellement (voir useMessagerie). */
export default memo(forwardRef(VirtualizedMessageList));
