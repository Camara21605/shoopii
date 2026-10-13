/**
 * Paramètres › Documents & vérification — comme SecDocuments du site :
 *   · statut du dossier (non vérifié, en cours d'examen, vérifié, refusé) ;
 *   · CNI et bail / attestation de local OBLIGATOIRES : le dossier passe « en
 *     cours d'examen » dès que les deux sont reçus (« x/2 ») ; assurance,
 *     casier judiciaire et registre de commerce / NIF facultatifs ;
 *   · chaque pièce : PDF ou photo (JPG / PNG / WebP), 10 MB max — fichier du
 *     téléphone ou photo prise sur le moment ; « Voir » ouvre un lien signé à
 *     usage immédiat (le fichier n'est jamais public) ; « Supprimer » après
 *     confirmation.
 * « Photos du point de dépôt » n'est pas proposé (comme sur le site : aucune
 * photo n'est affichée ni vérifiée par Shoneya pour l'instant). Les
 * informations fictives du site (« 24–72 h », « verification@shopi.africa »,
 * « renouvelable tous les 12 mois ») ne sont pas reprises.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { Badge, confirmAction, FormCard, Hint, pickDocument, Sheet, SettingsShell, takeDocumentPhoto, toast, toastError, TONE, type IconName, type Picked } from '@/features/settings-kit';
import { useTheme } from '@/hooks/use-theme';

import { deleteDocument, DOC_FIELD, documentUrl, REQUIRED_DOCS, uploadDocument, VERIFICATION, type CorrespondantSettings, type DocKey } from '../api';
import { useCorrespondantSettings, useMergeSettings } from '../hooks';

const DOCS: { type: DocKey; label: string; sub: string; icon: IconName }[] = [
  { type: 'cni', label: 'Carte nationale d’identité', sub: 'Recto-verso, en cours de validité', icon: 'id-card-outline' },
  { type: 'bail', label: 'Bail commercial / attestation de local', sub: 'Justificatif du point de dépôt', icon: 'business-outline' },
  { type: 'assurance', label: 'Attestation d’assurance responsabilité', sub: 'Utile pour les colis de valeur', icon: 'shield-checkmark-outline' },
  { type: 'casier', label: 'Casier judiciaire (B3)', sub: 'Extrait récent (moins de 3 mois)', icon: 'document-lock-outline' },
  { type: 'registre', label: 'Registre de commerce / NIF', sub: 'Pour la facturation de vos commissions', icon: 'receipt-outline' },
];

const STATUS_HELP: Record<string, string> = {
  unverified: 'Envoyez votre CNI et votre bail ({n}/2) : l’examen du dossier démarre dès que les deux sont reçus.',
  reviewing: 'Vos pièces sont en cours de vérification par l’équipe Shoneya.',
  verified: 'Dossier vérifié. Vous pouvez renouveler une pièce expirée à tout moment.',
  rejected: 'Dossier refusé : renvoyez une CNI et un bail lisibles et valides.',
};
const STATUS_ICON: Record<string, IconName> = { unverified: 'time-outline', reviewing: 'search-outline', verified: 'shield-checkmark', rejected: 'close-circle' };

export default function DocumentsScreen() {
  const q = useCorrespondantSettings();
  return (
    <SettingsShell<CorrespondantSettings> query={q} title="Documents" icon="document-lock-outline" subtitle="Les pièces qui permettent à Shoneya de vérifier votre point relais.">
      {(d) => <Content d={d} />}
    </SettingsShell>
  );
}

function Content({ d }: { d: CorrespondantSettings }) {
  const theme = useTheme();
  const merge = useMergeSettings();
  const [busy, setBusy] = useState<Partial<Record<DocKey, 'send' | 'view' | 'delete'>>>({});
  const [choose, setChoose] = useState<DocKey | null>(null);

  const status = d.verificationStatus in VERIFICATION ? d.verificationStatus : 'unverified';
  const verif = VERIFICATION[status];
  const present = (k: DocKey) => !!d[DOC_FIELD[k]];
  const nReq = REQUIRED_DOCS.filter(present).length;
  const labelOf = (t: DocKey) => DOCS.find((x) => x.type === t)?.label ?? 'Document';
  const setBusyFor = (t: DocKey, v?: 'send' | 'view' | 'delete') => setBusy((b) => ({ ...b, [t]: v }));

  const send = async (type: DocKey, getFile: () => Promise<Picked>) => {
    setChoose(null);
    /* iOS refuse d'ouvrir le sélecteur tant que la feuille se ferme encore */
    if (Platform.OS === 'ios') await new Promise((r) => setTimeout(r, 400));
    const picked = await getFile();
    if (!picked.ok) {
      if (picked.error) toast(picked.error, 'danger');
      return;
    }
    setBusyFor(type, 'send');
    toast(`Envoi « ${labelOf(type)} » en cours…`, 'info');
    try {
      const res = await uploadDocument(type, picked.file);
      if (res.present) merge({ [DOC_FIELD[type]]: '••••••', ...(res.verificationStatus ? { verificationStatus: res.verificationStatus } : {}) });
      toast('Document envoyé.');
    } catch (e) {
      toastError(e, 'Échec de l’envoi. Réessayez.');
    } finally {
      setBusyFor(type);
    }
  };

  const view = async (type: DocKey) => {
    setBusyFor(type, 'view');
    try {
      await WebBrowser.openBrowserAsync(await documentUrl(type));
    } catch (e) {
      toastError(e, 'Impossible d’ouvrir le document.');
    } finally {
      setBusyFor(type);
    }
  };

  const remove = async (type: DocKey) => {
    const required = REQUIRED_DOCS.includes(type);
    const ok = await confirmAction(
      `Supprimer « ${labelOf(type)} » ?`,
      required ? 'Cette pièce est obligatoire : vous devrez en renvoyer une pour que votre dossier puisse être vérifié.' : 'Le fichier sera définitivement supprimé.',
      'Supprimer',
      true,
    );
    if (!ok) return;
    setBusyFor(type, 'delete');
    try {
      await deleteDocument(type);
      merge({ [DOC_FIELD[type]]: null });
      toast('Document supprimé.');
    } catch (e) {
      toastError(e, 'Suppression impossible.');
    } finally {
      setBusyFor(type);
    }
  };

  return (
    <>
      <View style={[styles.status, { backgroundColor: TONE[verif.tone].bg }]}>
        <Ionicons name={STATUS_ICON[status] ?? 'time-outline'} size={22} color={TONE[verif.tone].fg} />
        <View style={styles.flex}>
          <ThemedText style={[styles.statusTitle, { color: TONE[verif.tone].fg }]}>{verif.label}</ThemedText>
          <ThemedText type="small" style={{ color: TONE[verif.tone].fg }}>
            {(STATUS_HELP[status] ?? '').replace('{n}', String(nReq))}
          </ThemedText>
        </View>
      </View>

      <FormCard
        title="Pièces justificatives"
        icon="shield-checkmark-outline"
        right={<Badge label={`${nReq}/${REQUIRED_DOCS.length} obligatoires`} tone={nReq === REQUIRED_DOCS.length ? 'success' : 'neutral'} />}>
        {DOCS.map((doc, i) => {
          const ok = present(doc.type);
          const required = REQUIRED_DOCS.includes(doc.type);
          const b = busy[doc.type];
          return (
            <View key={doc.type} style={[styles.doc, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
              <View style={[styles.docIco, { backgroundColor: ok ? TONE.success.bg : theme.backgroundElement }]}>
                <Ionicons name={doc.icon} size={19} color={ok ? TONE.success.fg : Brand.primary} />
              </View>
              <View style={styles.flex}>
                <ThemedText style={styles.docTitle}>
                  {doc.label} <ThemedText style={[styles.req, { color: required ? Brand.danger : theme.textSecondary }]}>· {required ? 'obligatoire' : 'facultatif'}</ThemedText>
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {ok ? 'Document soumis' : doc.sub}
                </ThemedText>
                <View style={styles.docFoot}>
                  <Badge label={ok ? '✓ Soumis' : '⚠ Manquant'} tone={ok ? 'success' : required ? 'danger' : 'neutral'} />
                  <View style={styles.actions}>
                    {ok ? <Act icon="eye-outline" label={`Voir — ${doc.label}`} text="Voir" busy={b === 'view'} disabled={!!b} onPress={() => void view(doc.type)} /> : null}
                    <Act
                      icon={ok ? 'refresh' : 'cloud-upload-outline'}
                      label={`${ok ? 'Renouveler' : 'Envoyer'} — ${doc.label}`}
                      text={b === 'send' ? 'Envoi…' : ok ? 'Renouveler' : 'Envoyer'}
                      busy={b === 'send'}
                      disabled={!!b}
                      onPress={() => setChoose(doc.type)}
                    />
                    {ok ? <Act icon="trash-outline" label={`Supprimer — ${doc.label}`} busy={b === 'delete'} disabled={!!b} danger onPress={() => void remove(doc.type)} /> : null}
                  </View>
                </View>
              </View>
            </View>
          );
        })}
        <Hint text="L’examen démarre dès que la CNI et le bail sont reçus. Les autres pièces renforcent votre dossier." />
      </FormCard>

      {choose ? (
        <Sheet title={labelOf(choose)} onClose={() => setChoose(null)}>
          <ThemedText type="small" themeColor="textSecondary">
            PDF, JPG, PNG ou WebP · 10 MB maximum. Assurez-vous que la pièce est lisible et en cours de validité.
          </ThemedText>
          <SourceBtn icon="camera-outline" label="Prendre une photo" onPress={() => void send(choose, takeDocumentPhoto)} />
          <SourceBtn icon="folder-open-outline" label="Choisir un fichier (PDF ou image)" onPress={() => void send(choose, pickDocument)} />
        </Sheet>
      ) : null}
    </>
  );
}

function Act({ icon, label, text, onPress, busy, disabled, danger }: { icon: IconName; label: string; text?: string; onPress: () => void; busy?: boolean; disabled?: boolean; danger?: boolean }) {
  const theme = useTheme();
  const color = danger ? Brand.danger : Brand.primary;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} style={[styles.docBtn, { borderColor: theme.border }, disabled && !busy && styles.dim]}>
      {busy ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={15} color={color} />}
      {text ? <ThemedText style={[styles.docBtnText, { color }]}>{text}</ThemedText> : null}
    </Pressable>
  );
}

function SourceBtn({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.source, { borderColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name={icon} size={21} color={Brand.primary} />
      <ThemedText style={styles.sourceText}>{label}</ThemedText>
      <Ionicons name="chevron-forward" size={17} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.5 },
  status: { flexDirection: 'row', gap: 12, alignItems: 'center', borderRadius: 16, padding: 14 },
  statusTitle: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  doc: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  docIco: { width: 42, height: 42, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  docTitle: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  req: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
  docFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: 6 },
  docBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, minHeight: 34 },
  docBtnText: { fontSize: 13, lineHeight: 17, fontWeight: '800' },
  source: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 56 },
  sourceText: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '700' },
});
