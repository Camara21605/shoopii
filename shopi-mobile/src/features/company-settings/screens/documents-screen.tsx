/**
 * Paramètres › Documents & Vérification — comme DocumentsSection du site :
 * 3 pièces obligatoires (CNI, RCCM, justificatif bancaire) + 2 facultatives
 * (photo de la boutique, attestation NIF) ; PDF, JPG, PNG ou WebP, 10 MB max.
 * Dès que les 3 obligatoires sont envoyées, le dossier passe en examen. Les
 * pièces restent privées (seule l'administration peut les consulter).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { uploadFile, type Settings } from '../api';
import { pickDocument } from '../components/pick';
import { Badge, FormCard, Hint, SettingsShell, toast, toastError, useEditable, type Tone } from '../components/ui';
import { useSettings } from '../hooks';

type DocKey = 'cni' | 'rccm' | 'bancaire' | 'photo' | 'nif';

const DOCS: { key: DocKey; field: keyof Settings; label: string; hint: string; required: boolean; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'cni', field: 'ownerIdDocument', label: 'CNI / Passeport', hint: 'PDF, JPG ou PNG (une photo nette suffit) · max 10 MB', required: true, icon: 'id-card-outline' },
  { key: 'rccm', field: 'documentRccm', label: 'Registre du Commerce (RCCM)', hint: 'PDF, JPG ou PNG (une photo nette suffit) · max 10 MB', required: true, icon: 'briefcase-outline' },
  { key: 'bancaire', field: 'documentBancaire', label: 'Justificatif bancaire', hint: 'Relevé ou attestation · PDF, JPG ou PNG · max 10 MB', required: true, icon: 'business-outline' },
  { key: 'photo', field: 'documentPhoto', label: 'Photo boutique physique', hint: 'JPG, PNG ou WebP · max 10 MB', required: false, icon: 'camera-outline' },
  { key: 'nif', field: 'documentNif', label: 'Attestation fiscale (NIF)', hint: 'PDF, JPG ou PNG (une photo nette suffit) · max 10 MB', required: false, icon: 'receipt-outline' },
];

const STATUS: Record<string, { label: string; tone: Tone; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  pending: { label: 'Non soumis', tone: 'neutral', icon: 'document-outline' },
  reviewing: { label: 'En cours d’examen', tone: 'warning', icon: 'hourglass-outline' },
  verified: { label: 'Vérifié', tone: 'success', icon: 'shield-checkmark' },
  rejected: { label: 'Refusé', tone: 'danger', icon: 'close-circle' },
};

export default function DocumentsScreen() {
  const q = useSettings();
  return (
    <SettingsShell title="Documents & Vérification" icon="document-text-outline" subtitle="Soumettez vos documents légaux pour obtenir le badge « Boutique vérifiée Shoneya ».">
      {q.data ? <Content d={q.data} /> : null}
    </SettingsShell>
  );
}

function Content({ d }: { d: Settings }) {
  const theme = useTheme();
  const editable = useEditable();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<DocKey | null>(null);
  const statut = STATUS[d.verificationStatus] ? d.verificationStatus : 'pending';
  const st = STATUS[statut];
  const fournis = DOCS.filter((x) => x.required && d[x.field]).length;

  const statusHint: Record<string, string> = {
    pending: `Envoyez les 3 documents obligatoires (${fournis} / 3 fournis) pour demander le badge « Boutique vérifiée ».`,
    reviewing: 'Dossier complet, en cours d’examen par l’administration Shoneya.',
    verified: 'Le badge « Boutique vérifiée » s’affiche sur votre boutique et vos produits.',
    rejected: 'Dossier refusé : remplacez les documents concernés pour relancer l’examen.',
  };

  const upload = async (doc: (typeof DOCS)[number]) => {
    const picked = await pickDocument();
    if (!picked.ok) return picked.error && toast(picked.error, 'danger');
    setBusy(doc.key);
    toast('Envoi en cours…', 'info');
    try {
      await uploadFile(`documents/${doc.key}`, picked.file);
      /* Le serveur peut faire passer le dossier en examen : on relit tout */
      await qc.invalidateQueries({ queryKey: qk.company.settings });
      toast(`Document « ${doc.label} » envoyé`);
    } catch (e) {
      toastError(e, 'Échec de l’envoi');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <View style={[styles.status, { borderColor: theme.border }]}>
        <View style={styles.statusTop}>
          <Ionicons name={st.icon} size={22} color={statut === 'verified' ? Brand.success : statut === 'rejected' ? Brand.danger : Brand.primary} />
          <ThemedText style={styles.statusTitle}>Statut de vérification</ThemedText>
          <Badge label={st.label} tone={st.tone} />
        </View>
        <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.bar, { width: `${(fournis / 3) * 100}%` }]} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {fournis} / 3 obligatoires · {statusHint[statut]}
        </ThemedText>
      </View>

      <FormCard title="Documents requis" icon="folder-open-outline" subtitle="Les 3 documents obligatoires : CNI + RCCM + Justificatif bancaire">
        {DOCS.map((doc, i) => {
          const done = !!d[doc.field];
          return (
            <View key={doc.key} style={[styles.doc, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
              <View style={[styles.docIco, { backgroundColor: done ? '#ECFDF5' : theme.backgroundElement }]}>
                <Ionicons name={done ? 'checkmark-circle' : doc.icon} size={20} color={done ? Brand.success : Brand.primary} />
              </View>
              <View style={styles.flex}>
                <ThemedText style={styles.docTitle}>{doc.label}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {done ? 'Document envoyé' : doc.hint}
                </ThemedText>
                <View style={styles.badges}>
                  <Badge label={doc.required ? 'Obligatoire' : 'Facultatif'} tone={doc.required ? 'info' : 'neutral'} />
                </View>
              </View>
              {editable ? (
                <Pressable
                  onPress={() => void upload(doc)}
                  disabled={!!busy}
                  accessibilityRole="button"
                  accessibilityLabel={`${done ? 'Remplacer' : 'Envoyer'} : ${doc.label}`}
                  style={({ pressed }) => [styles.btn, done ? styles.btnGhost : styles.btnFull, (pressed || (busy && busy !== doc.key)) && styles.dim]}>
                  {busy === doc.key ? (
                    <ActivityIndicator size="small" color={done ? Brand.primary : '#fff'} />
                  ) : (
                    <>
                      <Ionicons name={done ? 'refresh' : 'cloud-upload-outline'} size={15} color={done ? Brand.primary : '#fff'} />
                      <ThemedText style={[styles.btnText, { color: done ? Brand.primary : '#fff' }]}>{done ? 'Remplacer' : 'Envoyer'}</ThemedText>
                    </>
                  )}
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </FormCard>

      <Hint
        icon="lock-closed-outline"
        tone="neutral"
        text="Dès que les 3 documents obligatoires sont envoyés, votre dossier passe en examen auprès de l’administration Shoneya. Vos pièces restent privées : seule l’administration peut les consulter."
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.6 },
  status: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  statusTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusTitle: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  track: { height: 7, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4, backgroundColor: Brand.primary },
  doc: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  docIco: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  docTitle: { fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  badges: { flexDirection: 'row', marginTop: 4 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 12, minHeight: 36, minWidth: 96, justifyContent: 'center' },
  btnFull: { backgroundColor: Brand.primary },
  btnGhost: { borderWidth: 1.5, borderColor: Brand.primary },
  btnText: { fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
});
