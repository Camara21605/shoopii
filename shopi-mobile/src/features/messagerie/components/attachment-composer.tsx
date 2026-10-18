/**
 * Aperçu AVANT l'envoi d'une pièce jointe, avec un commentaire facultatif
 * (comme WhatsApp) — partagé par la discussion privée et les groupes :
 *   photo  → affichée en grand · vidéo → repère + durée
 *   fichier → carte (nom, taille) · position → carte (adresse)
 *   en bas : « Ajouter un commentaire… » + bouton Envoyer.
 * Le commentaire part dans `content` du même message (le serveur le garde
 * avec le média, et il sert d'aperçu dans la liste des discussions).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ChatBubble } from '@/constants/theme';

import { fmtClock } from '../MediaBubbles';

export type PendingAttachment =
  | { kind: 'image'; uri: string; name: string }
  | { kind: 'video'; uri: string; name: string; durationSec?: number }
  | { kind: 'document'; uri: string; name: string; size?: number }
  | { kind: 'location'; label: string | null; latitude: number; longitude: number };

export const CAPTION_MAX = 1000;

function fmtSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

export function AttachmentComposer({ attachment, recipient, onCancel, onSend }: {
  attachment: PendingAttachment | null;
  /** « Envoyer à … » */
  recipient: string;
  onCancel: () => void;
  onSend: (caption: string) => void;
}) {
  const [caption, setCaption] = useState('');

  function close() { setCaption(''); onCancel(); }
  function send() {
    const text = caption.trim();
    setCaption('');
    onSend(text);
  }

  const a = attachment;
  return (
    <Modal visible={!!a} animationType="slide" onRequestClose={close} statusBarTranslucent>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Annuler l’envoi" hitSlop={10} style={styles.headBtn}>
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
          <ThemedText numberOfLines={1} style={styles.headTitle}>Envoyer à {recipient}</ThemedText>
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.preview}>
            {a?.kind === 'image' ? (
              <Image source={{ uri: a.uri }} style={styles.fill} contentFit="contain" />
            ) : a?.kind === 'video' ? (
              <View style={styles.card}>
                <View style={[styles.cardIco, styles.videoIco]}><Ionicons name="play" size={34} color="#fff" style={styles.playNudge} /></View>
                <ThemedText numberOfLines={2} style={styles.cardTitle}>{a.name}</ThemedText>
                <ThemedText style={styles.cardSub}>Vidéo{a.durationSec ? ` · ${fmtClock(a.durationSec)}` : ''}</ThemedText>
              </View>
            ) : a?.kind === 'document' ? (
              <View style={styles.card}>
                <View style={styles.cardIco}><Ionicons name="document-text" size={40} color={ChatBubble.mineAccent} /></View>
                <ThemedText numberOfLines={3} style={styles.cardTitle}>{a.name}</ThemedText>
                <ThemedText style={styles.cardSub}>{['Document', fmtSize(a.size)].filter(Boolean).join(' · ')}</ThemedText>
              </View>
            ) : a?.kind === 'location' ? (
              <View style={styles.card}>
                <View style={styles.cardIco}><Ionicons name="location" size={40} color="#DC2626" /></View>
                <ThemedText numberOfLines={3} style={styles.cardTitle}>{a.label || 'Ma position actuelle'}</ThemedText>
                <ThemedText style={styles.cardSub}>{a.latitude.toFixed(5)}, {a.longitude.toFixed(5)}</ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.bar}>
            <View style={styles.inputBox}>
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Ajouter un commentaire…"
                placeholderTextColor="rgba(255,255,255,.55)"
                style={styles.input}
                multiline
                maxLength={CAPTION_MAX}
                accessibilityLabel="Commentaire"
              />
            </View>
            <Pressable onPress={send} accessibilityRole="button" accessibilityLabel="Envoyer" style={({ pressed }) => [styles.sendBtn, pressed && styles.pressed]}>
              <Ionicons name="send" size={20} color="#fff" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E1016' },
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  pressed: { opacity: 0.8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  headBtn: { padding: 4 },
  headTitle: { flex: 1, color: '#fff', fontSize: 16, lineHeight: 21, fontWeight: '700' },
  preview: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 340, alignItems: 'center', gap: 10, padding: 24, borderRadius: 20, backgroundColor: 'rgba(255,255,255,.08)' },
  cardIco: { width: 84, height: 84, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.92)', alignItems: 'center', justifyContent: 'center' },
  videoIco: { backgroundColor: 'rgba(255,255,255,.18)', borderRadius: 42 },
  playNudge: { marginLeft: 4 },
  cardTitle: { color: '#fff', fontSize: 16, lineHeight: 22, fontWeight: '700', textAlign: 'center' },
  cardSub: { color: 'rgba(255,255,255,.7)', fontSize: 13, lineHeight: 18 },
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  inputBox: { flex: 1, borderRadius: 22, backgroundColor: 'rgba(255,255,255,.12)', paddingHorizontal: 14, paddingVertical: 9, maxHeight: 130 },
  input: { color: '#fff', fontSize: 15, lineHeight: 20, maxHeight: 110 },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: ChatBubble.mineAccent, alignItems: 'center', justifyContent: 'center' },
});
