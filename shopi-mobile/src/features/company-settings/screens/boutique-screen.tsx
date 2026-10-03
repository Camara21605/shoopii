/**
 * Paramètres › Boutique & Identité — comme BoutiqueSection du site :
 *   · complétion du profil (6 étapes) ;
 *   · logo (5 MB) et image de couverture (8 MB), suppression du logo ;
 *   · informations publiques : nom, description, type (verrouillé une fois
 *     choisi), visibilité (si le compte est validé), slogan, site, tags ;
 *   · catégories proposées ; contact (téléphone, e-mail, WhatsApp) ;
 *   · adresse (résumé — elle se modifie avec la position, sur la carte) ;
 *   · responsable (lecture seule).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { initials } from '@/components/catalog';
import { SecondaryButton } from '@/components/form';
import { SelectField } from '@/components/select-field';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { fetchCompanyTypesByNature } from '@/features/auth/api';
import { thumb } from '@/features/catalog/format';
import { openSite } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { completion, deleteLogo, fetchMyCategories, saveMyCategories, uploadFile, type Settings } from '../api';
import { pickImage } from '../components/pick';
import { Badge, confirmAction, FormCard, Hint, Input, SaveButton, SettingsShell, toast, toastError, ToggleRow, useEditable } from '../components/ui';
import { useMergeSettings, useSectionSave, useSettings } from '../hooks';

export default function BoutiqueScreen() {
  const q = useSettings();
  return (
    <SettingsShell title="Boutique & Identité" icon="storefront-outline" subtitle="Informations publiques de votre boutique, visibles par tous les clients sur Shoneya.">
      {q.data ? <Content key={q.data.id} d={q.data} /> : null}
    </SettingsShell>
  );
}

function Content({ d }: { d: Settings }) {
  return (
    <>
      <CompletionCard d={d} />
      <VisualsCard d={d} />
      <InfosCard d={d} />
      <CategoriesCard />
      <ContactCard d={d} />
      <AddressCard d={d} />
      <FormCard title="Responsable & Propriétaire" icon="person-outline" subtitle="Informations du gérant principal">
        <Input label="Prénom" value={d.ownerFirstName ?? ''} editable={false} />
        <Input label="Nom" value={d.ownerLastName ?? ''} editable={false} />
        <Hint icon="information-circle" tone="neutral" text="Prénom et nom affichés en lecture seule. La modification directe sera bientôt disponible." />
      </FormCard>
    </>
  );
}

/* ── Complétion ────────────────────────────────────────────────────── */

function CompletionCard({ d }: { d: Settings }) {
  const theme = useTheme();
  const c = completion(d);
  return (
    <View style={[styles.comp, { borderColor: theme.border }]}>
      <View style={styles.compHead}>
        <ThemedText style={styles.compPct}>{c.pct}%</ThemedText>
        <View style={styles.flex}>
          <ThemedText style={styles.compTitle}>Boutique complétée à {c.pct}%</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Un profil complet génère <ThemedText type="smallBold">3× plus</ThemedText> de ventes
          </ThemedText>
        </View>
      </View>
      <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
        <View style={[styles.bar, { width: `${c.pct}%`, backgroundColor: c.pct === 100 ? Brand.success : Brand.primary }]} />
      </View>
      <View style={styles.steps}>
        {c.steps.map((s) => (
          <View key={s.key} style={[styles.step, { backgroundColor: s.ok ? '#ECFDF5' : theme.backgroundElement }]}>
            <Ionicons name={s.ok ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={s.ok ? Brand.success : theme.textSecondary} />
            <ThemedText style={[styles.stepText, { color: s.ok ? '#047857' : theme.textSecondary }]}>{s.label}</ThemedText>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ── Logo & couverture ─────────────────────────────────────────────── */

function VisualsCard({ d }: { d: Settings }) {
  const theme = useTheme();
  const editable = useEditable();
  const merge = useMergeSettings();
  const [busy, setBusy] = useState<'logo' | 'cover' | 'del' | null>(null);
  const logo = thumb(d.logo, 240);
  const cover = thumb(d.coverImage, 900);

  const change = async (kind: 'logo' | 'cover') => {
    const picked = await pickImage(kind === 'logo' ? [1, 1] : [3, 1], kind === 'logo' ? 5 : 8);
    if (!picked.ok) return picked.error && toast(picked.error, 'danger');
    setBusy(kind);
    try {
      const res = await uploadFile(kind, picked.file);
      merge(kind === 'logo' ? { logo: (res.logo as string) ?? d.logo } : { coverImage: (res.coverImage as string) ?? d.coverImage });
      toast(kind === 'logo' ? 'Logo mis à jour' : 'Image de couverture mise à jour');
    } catch (e) {
      toastError(e, kind === 'logo' ? 'Échec de l’envoi du logo' : 'Échec de l’envoi de la couverture');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!(await confirmAction('Supprimer le logo ?', 'Vos initiales s’afficheront à la place.', 'Supprimer', true))) return;
    setBusy('del');
    try {
      await deleteLogo();
      merge({ logo: null });
      toast('Logo supprimé');
    } catch (e) {
      toastError(e, 'Impossible de supprimer le logo');
    } finally {
      setBusy(null);
    }
  };

  return (
    <FormCard title="Logo & Image de couverture" icon="image-outline" subtitle="Identité visuelle de votre boutique sur Shoneya">
      <Pressable
        onPress={() => editable && void change('cover')}
        disabled={!editable || !!busy}
        accessibilityRole="button"
        accessibilityLabel="Changer l’image de couverture"
        style={[styles.cover, { backgroundColor: theme.backgroundSelected }]}>
        {cover ? <Image source={{ uri: cover }} style={styles.fill} contentFit="cover" /> : null}
        {!cover ? (
          <View style={styles.coverEmpty}>
            <Ionicons name="image-outline" size={28} color={Brand.primary} />
            <ThemedText type="small" themeColor="textSecondary">
              1200×400 px · JPG, PNG · max 8 MB
            </ThemedText>
          </View>
        ) : null}
        {editable ? (
          <View style={styles.coverBtn}>
            {busy === 'cover' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={15} color="#fff" />}
            <ThemedText style={styles.coverBtnText}>Changer la couverture</ThemedText>
          </View>
        ) : null}
      </Pressable>

      <View style={styles.logoRow}>
        <View style={[styles.logo, { backgroundColor: theme.backgroundSelected }]}>
          {logo ? <Image source={{ uri: logo }} style={styles.fill} contentFit="cover" /> : <ThemedText style={styles.init}>{initials(d.companyName || 'B')}</ThemedText>}
          {busy === 'logo' || busy === 'del' ? (
            <View style={styles.logoBusy}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : null}
        </View>
        <View style={styles.flex}>
          <ThemedText style={styles.bold}>Logo boutique</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Carré · JPG, PNG, WebP · max 5 MB
          </ThemedText>
          {editable ? (
            <View style={styles.logoBtns}>
              <SmallBtn icon="camera-outline" label="Changer" onPress={() => void change('logo')} disabled={!!busy} />
              {d.logo ? <SmallBtn icon="trash-outline" label="Supprimer" danger onPress={() => void remove()} disabled={!!busy} /> : null}
            </View>
          ) : null}
        </View>
      </View>
    </FormCard>
  );
}

function SmallBtn({ icon, label, onPress, danger, disabled }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; danger?: boolean; disabled?: boolean }) {
  const color = danger ? Brand.danger : Brand.primary;
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" style={({ pressed }) => [styles.smallBtn, { borderColor: color }, (pressed || disabled) && styles.dim]}>
      <Ionicons name={icon} size={14} color={color} />
      <ThemedText style={[styles.smallBtnText, { color }]}>{label}</ThemedText>
    </Pressable>
  );
}

/* ── Informations publiques ────────────────────────────────────────── */

function InfosCard({ d }: { d: Settings }) {
  const editable = useEditable();
  const save = useSectionSave();
  const [name, setName] = useState(d.companyName);
  const [description, setDescription] = useState(d.description ?? '');
  const [slogan, setSlogan] = useState(d.slogan ?? '');
  const [website, setWebsite] = useState(d.website ?? '');
  const [tags, setTags] = useState(d.tags ?? '');
  const [typeId, setTypeId] = useState(d.companyTypeId ?? '');
  const [visible, setVisible] = useState(d.status === 'active');
  const [saving, setSaving] = useState(false);
  const typeLocked = !!d.companyTypeId;
  const canToggle = d.ownerStatus === 'active';
  const types = useQuery({
    queryKey: [...qk.companyTypes, d.businessModel],
    queryFn: () => fetchCompanyTypesByNature(d.businessModel === 'services' ? 'services' : 'products'),
    staleTime: 30 * 60_000,
  });
  const typeName = types.data?.find((t) => t.id === d.companyTypeId)?.nom;

  const submit = async () => {
    if (!name.trim()) return toast('Le nom de la boutique est obligatoire.', 'danger');
    const wantStatus = visible ? 'active' : 'suspended';
    setSaving(true);
    try {
      await save('boutique', {
        companyName: name.trim(),
        description: description.trim(),
        slogan: slogan.trim(),
        website: website.trim(),
        tags: tags.trim(),
        ...(canToggle && wantStatus !== d.status ? { status: wantStatus } : {}),
        ...(!typeLocked && typeId ? { companyTypeId: typeId } : {}),
      });
      toast('Boutique sauvegardée avec succès');
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormCard title="Informations de la boutique" icon="information-circle-outline" subtitle="Données affichées sur votre page boutique publique">
      <Input label="Nom de la boutique" value={name} onChangeText={setName} placeholder="Ex : TechStore Conakry" maxLength={255} hint="Ce nom apparaît dans la recherche et sur votre page publique." />
      <Input label="Description (visible publiquement)" value={description} onChangeText={setDescription} placeholder="Décrivez votre boutique en quelques lignes…" multiline maxLength={500} counter={500} style={styles.area} />

      {typeLocked ? (
        <View style={styles.gap4}>
          <ThemedText type="smallBold">Type d’entreprise</ThemedText>
          <View style={styles.locked}>
            <Ionicons name="lock-closed" size={14} color="#6B6B6B" />
            <ThemedText style={styles.flex}>{typeName ?? (types.isPending ? 'Chargement…' : 'Type défini')}</ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Choisi à l’inscription, le type d’entreprise ne peut plus être modifié. Contactez le support si c’est une erreur.
          </ThemedText>
        </View>
      ) : (
        <SelectField
          label="Type d’entreprise"
          placeholder="Sélectionner un type…"
          options={(types.data ?? []).map((t) => ({ value: t.id, label: t.nom, icon: t.icone ?? undefined }))}
          value={typeId}
          onChange={setTypeId}
          loading={types.isPending}
          disabled={!editable}
        />
      )}
      {!typeLocked ? <Hint icon="warning-outline" tone="warning" text="Choisissez avec soin : une fois enregistré, le type d’entreprise ne pourra plus être modifié." /> : null}

      {canToggle ? (
        <View>
          <ToggleRow
            first
            label="Visibilité de la boutique"
            sub={visible ? 'Visible — votre boutique et vos produits sont visibles par les clients.' : 'En pause — boutique masquée aux clients ; produits, commandes et données conservés.'}
            value={visible}
            onChange={setVisible}
          />
          {d.suspendedUntil && d.status !== 'active' ? (
            <Hint icon="time-outline" tone="info" text={`Réactivation automatique le ${new Date(d.suspendedUntil).toLocaleDateString('fr-FR')}.`} />
          ) : null}
        </View>
      ) : (
        <Hint
          icon={d.ownerStatus === 'pending' ? 'hourglass-outline' : 'ban-outline'}
          tone={d.ownerStatus === 'pending' ? 'warning' : 'danger'}
          text={
            d.ownerStatus === 'pending'
              ? 'En attente de validation — l’administration vérifie votre boutique. Elle sera visible dès sa validation.'
              : 'Suspendue par l’administration — votre boutique est masquée aux clients. Contactez le support pour en connaître la raison.'
          }
        />
      )}

      <Input label="Slogan (optionnel)" value={slogan} onChangeText={setSlogan} placeholder="Ex : Fraîcheur garantie depuis 2019" maxLength={255} />
      <Input label="Site web (optionnel)" value={website} onChangeText={setWebsite} placeholder="https://votre-site.com" autoCapitalize="none" keyboardType="url" maxLength={255} />
      <Input label="Tags & Mots-clés" value={tags} onChangeText={setTags} placeholder="restaurant, livraison rapide, Conakry…" hint="Séparés par des virgules" maxLength={2000} />
      <SaveButton label="Sauvegarder la boutique" onPress={() => void submit()} loading={saving} />
    </FormCard>
  );
}

/* ── Catégories proposées ──────────────────────────────────────────── */

function CategoriesCard() {
  const theme = useTheme();
  const editable = useEditable();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: qk.company.settingsCategories, queryFn: fetchMyCategories });
  const initial = q.data ? (q.data.usingFallback ? q.data.available.map((c) => c.id) : q.data.selectedIds) : [];
  const [picked, setPicked] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const selected = picked ?? initial;
  const dirty = picked !== null || q.data?.usingFallback === true;

  const toggle = (id: string) => editable && setPicked(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const submit = async () => {
    if (!selected.length) return toast('Choisissez au moins une catégorie.', 'danger');
    setSaving(true);
    try {
      const res = await saveMyCategories(selected);
      qc.setQueryData(qk.company.settingsCategories, res);
      setPicked(null);
      toast('Catégories enregistrées');
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormCard title="Catégories de la boutique" icon="grid-outline" subtitle="Les catégories dans lesquelles vos clients vous trouvent">
      {q.isPending ? <ActivityIndicator color={Brand.primary} /> : null}
      {q.data && !q.data.available.length ? <Hint tone="neutral" text="Aucune catégorie disponible pour votre type d’entreprise." /> : null}
      {q.data?.usingFallback ? <Hint tone="info" text="Toutes les catégories de votre type sont proposées par défaut. Décochez celles que vous ne vendez pas, puis enregistrez." /> : null}
      <View style={styles.chips}>
        {(q.data?.available ?? []).map((c) => {
          const on = selected.includes(c.id);
          return (
            <Pressable
              key={c.id}
              onPress={() => toggle(c.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: !editable }}
              style={[styles.chip, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? '#FDF0E6' : theme.background }]}>
              {on ? <Ionicons name="checkmark" size={13} color={Brand.primary} /> : null}
              <ThemedText style={[styles.chipText, on && { color: Brand.primary }]}>{c.nom}</ThemedText>
            </Pressable>
          );
        })}
      </View>
      {q.data?.available.length ? (
        <ThemedText type="small" themeColor="textSecondary">
          {selected.length} / {q.data.available.length} sélectionnée{selected.length > 1 ? 's' : ''}
        </ThemedText>
      ) : null}
      {dirty ? <SaveButton label="Enregistrer les catégories" onPress={() => void submit()} loading={saving} /> : null}
    </FormCard>
  );
}

/* ── Contact ───────────────────────────────────────────────────────── */

function ContactCard({ d }: { d: Settings }) {
  const save = useSectionSave();
  const [phone, setPhone] = useState(d.businessPhone ?? '');
  const [email, setEmail] = useState(d.businessEmail ?? '');
  const [whatsapp, setWhatsapp] = useState(d.whatsapp ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      await save('contact', { businessPhone: phone.trim(), businessEmail: email.trim(), whatsapp: whatsapp.trim() });
      toast('Contact sauvegardé avec succès');
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormCard title="Contact" icon="call-outline" subtitle="Coordonnées affichées sur votre page publique">
      <Input label="Téléphone principal" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="620 00 00 00" maxLength={20} />
      <Input label="E-mail boutique" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="contact@maboutique.gn" maxLength={255} />
      <Input label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" placeholder="620 00 00 00 (sans +224)" maxLength={20} />
      <SaveButton label="Sauvegarder le contact" onPress={() => void submit()} loading={saving} />
    </FormCard>
  );
}

/* ── Adresse (résumé ; modification sur la carte du site) ──────────── */

function AddressCard({ d }: { d: Settings }) {
  const theme = useTheme();
  const editable = useEditable();
  const parts = [d.adresse, d.quartier, d.commune, d.ville].filter(Boolean).join(', ');
  const hasPos = d.latitude != null && d.longitude != null;
  return (
    <FormCard title="Adresse de la boutique" icon="location-outline" right={<Badge label={hasPos ? 'Sur la carte' : 'Position manquante'} tone={hasPos ? 'success' : 'warning'} />}>
      <View style={[styles.addr, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText style={styles.bold}>{parts || 'Adresse non renseignée'}</ThemedText>
        {d.repere ? (
          <ThemedText type="small" themeColor="textSecondary">
            Repère : {d.repere}
          </ThemedText>
        ) : null}
      </View>
      <Hint
        icon={hasPos ? 'checkmark-circle' : 'warning-outline'}
        tone={hasPos ? 'success' : 'warning'}
        text={hasPos ? 'Position exacte enregistrée sur la carte' : 'Position sur la carte manquante — les distances affichées aux clients sont approximatives'}
      />
      <ThemedText type="small" themeColor="textSecondary">
        L’adresse et la position de la boutique se modifient ensemble sur la carte, pour que les clients et les livreurs vous trouvent au bon endroit.
      </ThemedText>
      {editable ? <SecondaryButton title="Modifier sur la carte" onPress={() => openSite('/dashboard/entreprise/boutique-preview?tab=localisation')} pill /> : null}
    </FormCard>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap4: { gap: 6 },
  bold: { fontSize: 14.5, lineHeight: 19, fontWeight: '700' },
  dim: { opacity: 0.6 },
  comp: { borderWidth: 1, borderRadius: 18, padding: 14, gap: 10 },
  compHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  compPct: { fontSize: 26, lineHeight: 32, fontWeight: '900', color: Brand.primary },
  compTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  track: { height: 7, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4 },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  stepText: { fontSize: 12, lineHeight: 16, fontWeight: '700' },
  cover: { height: 120, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  coverEmpty: { alignItems: 'center', gap: 6 },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  coverBtn: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  coverBtnText: { color: '#fff', fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logo: { width: 76, height: 76, borderRadius: 38, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  logoBusy: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  init: { fontWeight: '900', color: Brand.primary, fontSize: 24 },
  logoBtns: { flexDirection: 'row', gap: 8, marginTop: 8 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  smallBtnText: { fontSize: 12.5, lineHeight: 16, fontWeight: '800' },
  area: { minHeight: 96, textAlignVertical: 'top' },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F6F6F6', borderRadius: 12, paddingHorizontal: 14, minHeight: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  addr: { borderRadius: 12, padding: 12, gap: 2 },
});
