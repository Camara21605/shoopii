/**
 * Paramètres › Documents & Vérification — comme SecDocuments du site :
 *   · statut du dossier (non soumis, en examen, vérifié, refusé) + ce qu'il faut faire ;
 *   · CNI et permis OBLIGATOIRES (ils déclenchent la vérification, « x/2 »),
 *     assurance et casier judiciaire facultatifs ;
 *   · chaque pièce : PDF ou photo (JPG / PNG / WebP), 10 MB max — fichier du
 *     téléphone ou photo prise sur le moment ; envoi pièce par pièce (les autres
 *     restent utilisables) ; statut à jour sans recharger.
 * Le serveur ne renvoie jamais le fichier (seulement « présent ») : rien n'est
 * affiché ni téléchargeable depuis l'application.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { docField, REQUIRED_DOCS, uploadDocument, VERIFICATION, type DocKey, type LivreurSettings } from '../api';
import { pickDocument, takeDocumentPhoto, type Picked } from '../components/pick';
import { Badge, FormCard, Hint, Sheet, SettingsShell, toast, toastError, TONE, type IconName } from '../components/ui';
import { useMergeSettings } from '../hooks';

const DOCS: { type: DocKey; label: string; sub: string; icon: IconName }[] = [
  {
    type: 'cni',
    label: 'CNI / Passeport',
    sub: 'Pièce d’identité officielle',
    icon: 'id-card-outline',
  },
  {
    type: 'permis',
    label: 'Permis de conduire',
    sub: 'Permis valide correspondant à votre véhicule',
    icon: 'car-outline',
  },
  {
    type: 'assurance',
    label: 'Attestation d’assurance',
    sub: 'Couverture en cours de validité',
    icon: 'shield-checkmark-outline',
  },
  {
    type: 'casier',
    label: 'Casier judiciaire',
    sub: 'Extrait de casier B3 récent (< 3 mois)',
    icon: 'document-lock-outline',
  },
];

const STATUS_ICON: Record<string, IconName> = {
  pending: 'time-outline',
  reviewing: 'search-outline',
  verified: 'shield-checkmark',
  rejected: 'close-circle',
};

export default function DocumentsScreen() {
  return (
    <SettingsShell<LivreurSettings> title="Documents" icon="document-lock-outline" subtitle="Documents obligatoires pour maintenir votre compte livreur actif sur Shoneya.">
      {(d) => <Content d={d} />}
    </SettingsShell>
  );
}

function Content({ d }: { d: LivreurSettings }) {
  const theme = useTheme();
  const merge = useMergeSettings();
  const [busy, setBusy] = useState<Partial<Record<DocKey, boolean>>>({});
  const [choose, setChoose] = useState<DocKey | null>(null);

  const status = d.verificationStatus in VERIFICATION ? d.verificationStatus : 'pending';
  const verif = VERIFICATION[status];
  const present = (k: DocKey) => !!d[docField[k]];
  const nReq = REQUIRED_DOCS.filter(present).length;

  const send = async (type: DocKey, getFile: () => Promise<Picked>) => {
    setChoose(null);
    /* iOS refuse d'ouvrir le sélecteur tant que la feuille se ferme encore */
    if (Platform.OS === 'ios') await new Promise((r) => setTimeout(r, 400));
    const picked = await getFile();
    if (!picked.ok) {
      if (picked.error) toast(picked.error, 'danger');
      return;
    }
    const label = DOCS.find((x) => x.type === type)?.label ?? 'Document';
    setBusy((b) => ({ ...b, [type]: true }));
    toast(`Envoi « ${label} » en cours…`, 'info');
    try {
      const res = await uploadDocument(type, picked.file);
      /* Marqueur de présence + dossier éventuellement passé « en cours d'examen » */
      if (res.present)
        merge({
          [docField[type]]: '••••••',
          ...(res.verificationStatus ? { verificationStatus: res.verificationStatus } : {}),
        });
      toast('Document envoyé.');
    } catch (e) {
      toastError(e, 'Échec de l’envoi. Réessayez.');
    } finally {
      setBusy((b) => ({ ...b, [type]: false }));
    }
  };

  return (
    <>
      <View style={[styles.status, { backgroundColor: TONE[verif.tone].bg }]}>
        <Ionicons name={STATUS_ICON[status] ?? 'time-outline'} size={22} color={TONE[verif.tone].fg} />
        <View style={styles.flex}>
          <ThemedText style={[styles.statusTitle, { color: TONE[verif.tone].fg }]}>{verif.label}</ThemedText>
          <ThemedText type="small" style={{ color: TONE[verif.tone].fg }}>
            {verif.help.replace('{n}', String(nReq))}
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
          const loading = !!busy[doc.type];
          return (
            <View
              key={doc.type}
              style={[
                styles.doc,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.border,
                },
              ]}>
              <View
                style={[
                  styles.docIco,
                  {
                    backgroundColor: ok ? TONE.success.bg : theme.backgroundElement,
                  },
                ]}>
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
                  <Pressable
                    onPress={() => setChoose(doc.type)}
                    disabled={loading}
                    accessibilityRole="button"
                    accessibilityLabel={`${ok ? 'Renouveler' : 'Envoyer'} — ${doc.label}`}
                    style={[styles.docBtn, { borderColor: theme.border }, loading && styles.dim]}>
                    {loading ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name={ok ? 'refresh' : 'cloud-upload-outline'} size={15} color={Brand.primary} />}
                    <ThemedText style={styles.docBtnText}>{loading ? 'Envoi…' : ok ? 'Renouveler' : 'Envoyer'}</ThemedText>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
        <Hint text="La vérification démarre dès que la CNI et le permis sont reçus. L’assurance et le casier judiciaire renforcent votre profil." />
      </FormCard>

      {choose ? (
        <Sheet title={DOCS.find((x) => x.type === choose)?.label ?? 'Document'} onClose={() => setChoose(null)}>
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
  dim: { opacity: 0.6 },
  status: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
  },
  statusTitle: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  doc: { flexDirection: 'row', gap: 12, paddingVertical: 12 },
  docIco: {
    width: 42,
    height: 42,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTitle: { fontSize: 14, lineHeight: 19, fontWeight: '800' },
  req: { fontSize: 11, lineHeight: 15, fontWeight: '800' },
  docFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  docBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    minHeight: 34,
  },
  docBtnText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '800',
    color: Brand.primary,
  },
  source: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  sourceText: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '700' },
});
