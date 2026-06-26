/**
 * src/shared/messagerie/components/MessageInput.tsx
 * Zone de saisie complète : texte, emojis, pièces jointes,
 * prévisualisation média, enregistrement vocal.
 *
 * Gère son propre état local — le parent (ChatWindow) n'a besoin
 * que des callbacks onSend, onTyping et onToast.
 */
import React, { useState, useRef, useCallback } from 'react';
import type { MediaAttachment } from '../hooks/useMessagerie';
import type { WsTyping }        from '../hooks/useSocket';
import { EMOJIS }               from '../data/messagerieTypes';
import { fmtDuration, uploadToServer } from '../utils/chatUtils';
import s from '../styles/ChatWindow.module.css';

interface Props {
  convId:       string;
  replyTo:      { sender: string; text: string } | null;
  onSend:       (convId: string, text: string, media?: MediaAttachment) => void;
  onTyping?:    (convId: string, activity: WsTyping['activity']) => void;
  onToast:      (msg: string, type?: string) => void;
  onClearReply: () => void;
}

type VoiceState = 'idle' | 'recording';

export default function MessageInput({
  convId, replyTo, onSend, onTyping, onToast, onClearReply,
}: Props) {
  /* ── Texte & Emoji ── */
  const [text,      setText]      = useState('');
  const [attOpen,   setAttOpen]   = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiCat,  setEmojiCat]  = useState(Object.keys(EMOJIS)[0]);
  const [uploading, setUploading] = useState(false);

  /* ── Prévisualisation média ── */
  const [mediaPreview, setMediaPreview] = useState<{
    file: File;
    previewUrl: string;
    mediaType: MediaAttachment['type'];
  } | null>(null);
  const [captionText, setCaptionText] = useState('');

  /* ── Enregistrement vocal ── */
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [recSeconds, setRecSeconds] = useState(0);
  const [recWave,    setRecWave]    = useState<number[]>(Array(28).fill(4));
  const mediaRecRef  = useRef<MediaRecorder | null>(null);
  const audioChunks  = useRef<Blob[]>([]);
  const streamRef    = useRef<MediaStream | null>(null);
  const recTimerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Refs DOM ── */
  const inputRef      = useRef<HTMLTextAreaElement>(null);
  const captionRef    = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef   = useRef<HTMLInputElement>(null);

  /* ── Throttle typing ── */
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Texte ─────────────────────────────────────────────────────

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  function emitTyping(active: boolean) {
    onTyping?.(convId, active ? 'typing' : 'stopped');
  }

  function handleTextChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    autoResize(e.target);
    emitTyping(true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => emitTyping(false), 2000);
  }

  function send() {
    if (!text.trim()) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    emitTyping(false);
    onSend(convId, text.trim());
    setText('');
    onClearReply();
    if (inputRef.current) inputRef.current.style.height = 'auto';
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  // ── Médias (image / vidéo / document) ─────────────────────────

  const handleFileSelected = useCallback((file: File) => {
    const mediaType: MediaAttachment['type'] = file.type.startsWith('image/')
      ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
    setMediaPreview({ file, previewUrl: URL.createObjectURL(file), mediaType });
    setCaptionText('');
    setAttOpen(false);
    setTimeout(() => captionRef.current?.focus(), 80);
  }, []);

  const cancelMedia = useCallback(() => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview.previewUrl);
    setMediaPreview(null);
    setCaptionText('');
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (docInputRef.current)   docInputRef.current.value   = '';
  }, [mediaPreview]);

  const confirmSendMedia = useCallback(async () => {
    if (!mediaPreview || uploading) return;
    const { file, mediaType } = mediaPreview;
    const caption = captionText.trim();

    URL.revokeObjectURL(mediaPreview.previewUrl);
    setMediaPreview(null);
    setCaptionText('');
    setUploading(true);

    try {
      const endpointMap: Record<string, string> = {
        image: '/upload/image',
        video: '/upload/video',
        file:  '/upload/document',
      };
      const url = await uploadToServer(file, endpointMap[mediaType] ?? '/upload/document');
      onSend(convId, caption, { url, name: file.name, size: file.size, mime: file.type, type: mediaType });
    } catch (err: any) {
      onToast(`❌ ${err.message ?? 'Upload échoué'}`, 'e');
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
      if (docInputRef.current)   docInputRef.current.value   = '';
    }
  }, [mediaPreview, captionText, uploading, convId, onSend, onToast]);

  // ── Enregistrement vocal ───────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current   = stream;
      audioChunks.current = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecRef.current = recorder;
      recorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.current.push(e.data); };
      recorder.start(100);

      setVoiceState('recording');
      setRecSeconds(0);
      recTimerRef.current  = setInterval(() => setRecSeconds(prev => prev + 1), 1000);
      waveTimerRef.current = setInterval(() => {
        setRecWave(Array.from({ length: 28 }, () => Math.floor(Math.random() * 22) + 3));
      }, 120);

      onTyping?.(convId, 'recording');
    } catch {
      onToast('🎙️ Accès au microphone refusé', 'e');
    }
  }, [convId, onTyping, onToast]);

  const cancelRecording = useCallback(() => {
    mediaRecRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    clearInterval(recTimerRef.current!);
    clearInterval(waveTimerRef.current!);
    mediaRecRef.current = null;
    streamRef.current   = null;
    audioChunks.current = [];
    setVoiceState('idle');
    setRecSeconds(0);
    setRecWave(Array(28).fill(4));
    onTyping?.(convId, 'stopped');
  }, [convId, onTyping]);

  const sendRecording = useCallback(() => {
    if (!mediaRecRef.current) return;
    const durationSec = recSeconds;

    mediaRecRef.current.onstop = async () => {
      const mimeType = audioChunks.current[0]?.type ?? 'audio/webm';
      const blob     = new Blob(audioChunks.current, { type: mimeType });
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      onTyping?.(convId, 'stopped');

      try {
        setUploading(true);
        const url = await uploadToServer(blob, '/upload/audio', 'voice.webm');
        onSend(convId, '', {
          url, name: 'Message vocal', size: blob.size, mime: mimeType,
          type: 'audio' as any, duration: fmtDuration(durationSec),
        } as any);
      } catch {
        onToast('❌ Impossible d\'envoyer le message vocal', 'e');
      } finally {
        setUploading(false);
      }
    };

    mediaRecRef.current.stop();
    clearInterval(recTimerRef.current!);
    clearInterval(waveTimerRef.current!);
    mediaRecRef.current = null;
    setVoiceState('idle');
    setRecSeconds(0);
    setRecWave(Array(28).fill(4));
  }, [convId, recSeconds, onSend, onTyping, onToast]);

  // ── Items du menu pièces jointes ──────────────────────────────

  const ATT_ITEMS = [
    { ico: '📷', label: 'Photo / Vidéo',        bg: 'rgba(190,24,93,.08)',   action: () => imageInputRef.current?.click() },
    { ico: '📄', label: 'Document (PDF)',        bg: 'var(--sky-2,#E2EAFB)',  action: () => docInputRef.current?.click()   },
    { ico: '📦', label: 'Partager un produit',   bg: 'rgba(4,120,87,.09)',    action: () => onToast('📦 Bientôt disponible', 'i') },
    { ico: '🛒', label: 'Partager une commande', bg: 'rgba(180,83,9,.09)',    action: () => onToast('🛒 Bientôt disponible', 'i') },
    { ico: '📍', label: 'Ma localisation',       bg: 'rgba(109,40,217,.09)',  action: () => onToast('📍 Bientôt disponible', 'i') },
  ];

  // ── Rendu ──────────────────────────────────────────────────────

  return (
    <div className={s.inputArea}>

      {/* ── Prévisualisation média ── */}
      {mediaPreview && (
        <div className={s.mediaPrev}>
          <div className={s.mpBar}>
            <button className={s.mpCloseBtn} onClick={cancelMedia} title="Annuler">
              <i className="fas fa-xmark" />
            </button>
            <span className={s.mpBarTitle}>
              {mediaPreview.mediaType === 'image' ? '📷 Photo'
                : mediaPreview.mediaType === 'video' ? '🎥 Vidéo' : '📄 Document'}
            </span>
          </div>
          <div className={s.mpContent}>
            {mediaPreview.mediaType === 'image' && <img src={mediaPreview.previewUrl} alt="Aperçu" className={s.mpImgEl} />}
            {mediaPreview.mediaType === 'video' && <video src={mediaPreview.previewUrl} controls className={s.mpVideoEl} />}
            {mediaPreview.mediaType === 'file'  && (
              <div className={s.mpDocBox}>
                <div className={s.mpDocIco}><i className="fas fa-file-pdf" /></div>
                <div className={s.mpDocName}>{mediaPreview.file.name}</div>
                <div className={s.mpDocMeta}>{(mediaPreview.file.size / 1024).toFixed(0)} Ko</div>
              </div>
            )}
          </div>
          <div className={s.mpCaptionRow}>
            <textarea
              ref={captionRef} className={s.mpCaptionInp} rows={1}
              placeholder="Ajouter un message… (facultatif)"
              value={captionText}
              onChange={e => setCaptionText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmSendMedia(); } }}
            />
            <button className={`${s.sendBtn} ${s.active}`} onClick={confirmSendMedia} disabled={uploading} title="Envoyer">
              {uploading ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-paper-plane" />}
            </button>
          </div>
        </div>
      )}

      {/* ── Réponse citée ── */}
      {!mediaPreview && replyTo && (
        <div className={`${s.replyPreview} ${s.show}`}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={s.rpSender}>{replyTo.sender}</div>
            <div className={s.rpMsg}>{replyTo.text}</div>
          </div>
          <button className={s.rpClose} onClick={onClearReply}><i className="fas fa-xmark" /></button>
        </div>
      )}

      {/* Inputs fichiers cachés */}
      <input ref={imageInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); }} />
      <input ref={docInputRef} type="file" accept="application/pdf,.pdf,.doc,.docx" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); }} />

      {/* ── Barre d'enregistrement vocal ── */}
      {voiceState === 'recording' && (
        <div className={s.voiceBar}>
          <button className={s.voiceCancelBtn} onClick={cancelRecording} title="Annuler">
            <i className="fas fa-xmark" />
          </button>
          <div className={s.voiceWave}>
            <span className={s.voiceRec} />
            {recWave.map((h, i) => <div key={i} className={s.voiceWaveTick} style={{ height: h }} />)}
          </div>
          <span className={s.voiceTimer}>{fmtDuration(recSeconds)}</span>
          <button className={`${s.sendBtn} ${s.active}`} onClick={sendRecording} disabled={uploading} title="Envoyer">
            {uploading ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-paper-plane" />}
          </button>
        </div>
      )}

      {/* ── Ligne de saisie principale ── */}
      {!mediaPreview && voiceState === 'idle' && (
        <div className={s.inputRow}>
          {/* Menu pièces jointes */}
          <div className={s.inputAttach} data-att>
            <button className={s.attBtn} onClick={() => setAttOpen(p => !p)}
              title="Joindre" disabled={uploading} style={{ opacity: uploading ? 0.55 : 1 }}>
              <i className={`fas ${uploading ? 'fa-circle-notch fa-spin' : 'fa-paperclip'}`} />
            </button>
            <div className={`${s.attMenu} ${attOpen ? s.open : ''}`}>
              {ATT_ITEMS.map(item => (
                <div key={item.label} className={s.amItem}
                  onClick={() => { item.action(); setAttOpen(false); }}>
                  <div className={s.amIco} style={{ background: item.bg }}>{item.ico}</div>
                  {item.label}
                </div>
              ))}
            </div>
          </div>

          {/* Textarea + emoji */}
          <div className={s.msgInpWrap}>
            <textarea ref={inputRef} className={s.msgInp} placeholder="Écrire un message…" rows={1}
              value={text}
              onChange={handleTextChange}
              onKeyDown={handleKey}
            />
            <button className={s.emojiBtn} onClick={() => setEmojiOpen(p => !p)} title="Émojis" data-emoji>
              <i className="fas fa-face-smile" />
            </button>
          </div>

          {/* Envoyer ou Micro */}
          {text.trim() ? (
            <button className={`${s.sendBtn} ${s.active}`} onClick={send} title="Envoyer">
              <i className="fas fa-paper-plane" />
            </button>
          ) : (
            <button className={`${s.sendBtn} ${s.micBtn}`} onClick={startRecording} title="Message vocal">
              <i className="fas fa-microphone" />
            </button>
          )}
        </div>
      )}

      {/* Picker emoji */}
      {emojiOpen && (
        <div className={`${s.emojiPicker} ${s.open}`} data-emoji>
          <div className={s.epCats}>
            {Object.keys(EMOJIS).map(cat => (
              <button key={cat} className={`${s.epCat} ${emojiCat === cat ? s.active : ''}`}
                onClick={() => setEmojiCat(cat)}>
                {EMOJIS[cat][0]}
              </button>
            ))}
          </div>
          <div className={s.epGrid}>
            {EMOJIS[emojiCat]?.map(em => (
              <button key={em} className={s.epEm}
                onClick={() => { setText(p => p + em); setEmojiOpen(false); inputRef.current?.focus(); }}>
                {em}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
