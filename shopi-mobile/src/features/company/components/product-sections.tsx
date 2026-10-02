/**
 * Contenu de chaque section du formulaire « Ajouter un produit ».
 * Chaque section reçoit l'état, un setter typé et les erreurs à afficher ;
 * aucune logique de contrôle ici (voir product-form.ts).
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { ProductCategory } from '../product-api';
import {
  CONDITIONS, DELAIS, GARANTIES, JOURS, LANGUES, LIMITS, PAYS, RETOURS, VARIANTE_TYPES, VISIBILITES,
  formatThousands, gnf, normalizeSlug, parseDecimalInput, parseIntInput,
  type Mode, type ProductForm, type Tier,
} from '../product-form';
import { Col, ErrorLine, Row, SelectField, SwitchRow, TagsField, TextField } from './product-form-ui';

export type SetField = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => void;
type Props = { form: ProductForm; set: SetField; err: (key: string) => string | undefined };

const opts = (list: readonly string[]) => list.map((v) => ({ value: v, label: v }));

/* ── Informations ─────────────────────────────────────────────────────── */

export function InfosFields({ form, set, err, mode }: Props & { mode: Mode }) {
  const full = mode !== 'rapide';
  const prix = parseIntInput(form.prix);
  const ancien = parseIntInput(form.prixAncien);
  const reduction = prix && ancien && !Number.isNaN(prix) && !Number.isNaN(ancien) && ancien > prix ? Math.round((1 - prix / ancien) * 100) : null;
  return (
    <>
      <TextField label="Nom du produit" required value={form.nom} onChangeText={(v) => set('nom', v)} max={LIMITS.nomMax}
        placeholder="ex. Robe wax coton, taille M" error={err('nom')} autoCapitalize="sentences" returnKeyType="next" />
      {full ? (
        <>
          <TextField label="Description" value={form.description} onChangeText={(v) => set('description', v)} multiline max={LIMITS.description}
            placeholder="Matière, usage, points forts, entretien…" error={err('description')}
            hint={form.description.trim().length < 100 ? '100 caractères ou plus recommandés' : 'Bonne description ✓'} />
          <TextField label="Contenu de la boîte" value={form.contenuBoite} onChangeText={(v) => set('contenuBoite', v)} multiline max={LIMITS.contenuBoite}
            placeholder="ex. 1 téléphone, 1 câble USB-C, notice" error={err('contenuBoite')} />
        </>
      ) : null}
      <Row>
        <Col>
          <TextField label="Prix de vente" required value={formatThousands(form.prix)} onChangeText={(v) => set('prix', v.replace(/\D/g, ''))}
            keyboardType="number-pad" suffix="GNF" placeholder="0" error={err('prix')} />
        </Col>
        {full ? (
          <Col>
            <TextField label="Prix barré" value={formatThousands(form.prixAncien)} onChangeText={(v) => set('prixAncien', v.replace(/\D/g, ''))}
              keyboardType="number-pad" suffix="GNF" placeholder="Facultatif" error={err('prixAncien')}
              hint={reduction ? `Réduction affichée : -${reduction} %` : 'Ancien prix, si promotion'} />
          </Col>
        ) : null}
      </Row>
      <Row>
        <Col>
          <TextField label="Stock" required value={form.stock} onChangeText={(v) => set('stock', v.replace(/\D/g, ''))}
            keyboardType="number-pad" placeholder="ex. 25" suffix="unités" error={err('stock')} />
        </Col>
        {full ? (
          <Col>
            <TextField label="Alerte stock bas" value={form.seuil} onChangeText={(v) => set('seuil', v.replace(/\D/g, ''))}
              keyboardType="number-pad" placeholder="ex. 5" error={err('seuil')} hint="Prévenu sous ce seuil" />
          </Col>
        ) : null}
      </Row>
      {full ? (
        <TextField label="Référence (SKU)" value={form.reference} onChangeText={(v) => set('reference', v)} max={LIMITS.reference}
          placeholder="ex. ROBE-WAX-M-01" autoCapitalize="characters" autoCorrect={false} error={err('reference')} />
      ) : null}
    </>
  );
}

/* ── Organisation ─────────────────────────────────────────────────────── */

export function OrganisationFields({ form, set, err, mode, categories, catState, onRetryCats, autoPublishOff }: Props & {
  mode: Mode; categories: ProductCategory[]; catState: 'loading' | 'error' | 'ok'; onRetryCats: () => void; autoPublishOff: boolean;
}) {
  const cat = categories.find((c) => c.id === form.categoryId);
  return (
    <>
      {catState === 'error' ? (
        <View style={styles.inlineBox}>
          <ErrorLine text="Impossible de charger vos catégories." />
          <Pressable onPress={onRetryCats} accessibilityRole="button" style={styles.retry}><ThemedText type="smallBold" style={{ color: Brand.primary }}>Réessayer</ThemedText></Pressable>
        </View>
      ) : catState === 'ok' && !categories.length ? (
        <ErrorLine text="Aucune catégorie n’est activée pour votre boutique : choisissez vos catégories dans Paramètres › Catalogue." />
      ) : (
        <SelectField label="Catégorie" required value={form.categoryId} disabled={catState === 'loading'}
          placeholder={catState === 'loading' ? 'Chargement…' : 'Choisir une catégorie'}
          options={categories.map((c) => ({ value: c.id, label: c.nom }))}
          onChange={(v) => { set('categoryId', v); set('subCategoryId', ''); }} error={err('categoryId')} />
      )}
      {cat && cat.subCategories.length ? (
        <SelectField label="Sous-catégorie" value={form.subCategoryId} allowEmpty="Aucune"
          options={cat.subCategories.map((s) => ({ value: s.id, label: s.nom }))} onChange={(v) => set('subCategoryId', v)} error={err('subCategoryId')} />
      ) : null}
      {mode !== 'rapide' ? (
        <>
          <TextField label="Marque" value={form.marque} onChangeText={(v) => set('marque', v)} max={LIMITS.marque} placeholder="ex. Samsung, Vlisco…" error={err('marque')} />
          <TagsField label="Mots-clés" tags={form.tags} onChange={(t) => set('tags', t)} max={LIMITS.tagsCount} maxLen={LIMITS.tagMax} error={err('tags')} />
          <Row>
            <Col><SelectField label="Langue de la fiche" value={form.langue} options={LANGUES} onChange={(v) => set('langue', v)} /></Col>
            <Col>
              <SelectField label="Visibilité" value={form.visibilite} options={VISIBILITES}
                onChange={(v) => set('visibilite', v as ProductForm['visibilite'])} disabled={autoPublishOff} />
            </Col>
          </Row>
          {autoPublishOff ? (
            <ThemedText type="small" themeColor="textSecondary">
              La publication automatique est désactivée pour votre boutique : le produit sera enregistré en brouillon, à publier ensuite.
            </ThemedText>
          ) : null}
        </>
      ) : null}
    </>
  );
}

/* ── Informations complémentaires ─────────────────────────────────────── */

export function ComplementairesFields({ form, set, err }: Props) {
  const theme = useTheme();
  const dims = [form.longueur, form.largeur, form.hauteur].map(parseDecimalInput);
  const volume = dims.every((d) => d !== null && !Number.isNaN(d)) ? ((dims[0]! * dims[1]! * dims[2]!) / 1000).toFixed(2) : null;
  return (
    <>
      <Row>
        <Col><SelectField label="État" value={form.condition} options={CONDITIONS} onChange={(v) => set('condition', v)} /></Col>
        <Col><SelectField label="Garantie" value={form.garantie} options={opts(GARANTIES)} onChange={(v) => set('garantie', v)} /></Col>
      </Row>
      <SelectField label="Politique de retour" value={form.politiqueRetour} options={RETOURS} onChange={(v) => set('politiqueRetour', v)} />
      <SelectField label="Pays d’origine" value={form.paysOrigine} options={PAYS} onChange={(v) => set('paysOrigine', v)} />
      {form.paysOrigine !== 'GN' ? (
        <View style={[styles.note, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText style={styles.noteIco}>🌍</ThemedText>
          <ThemedText type="small" style={styles.flex}>Produit importé : pensez à activer la livraison « via un correspondant » et à indiquer un délai réaliste.</ThemedText>
        </View>
      ) : null}
      <TextField label="Poids" value={form.poids} onChangeText={(v) => set('poids', v)} keyboardType="decimal-pad" suffix="kg" placeholder="ex. 0,5" error={err('poids')} />
      <Row>
        <Col><TextField label="Longueur" value={form.longueur} onChangeText={(v) => set('longueur', v)} keyboardType="decimal-pad" suffix="cm" error={err('longueur')} /></Col>
        <Col><TextField label="Largeur" value={form.largeur} onChangeText={(v) => set('largeur', v)} keyboardType="decimal-pad" suffix="cm" error={err('largeur')} /></Col>
        <Col><TextField label="Hauteur" value={form.hauteur} onChangeText={(v) => set('hauteur', v)} keyboardType="decimal-pad" suffix="cm" error={err('hauteur')} /></Col>
      </Row>
      {volume ? <ThemedText type="small" themeColor="textSecondary">Volume : {volume} litres</ThemedText> : null}
    </>
  );
}

/* ── Livraison ────────────────────────────────────────────────────────── */

export function LivraisonFields({ form, set, err }: Props) {
  return (
    <>
      <View>
        <SwitchRow icon="storefront-outline" label="Livraison par la boutique" sub="Vous livrez vous-même" value={form.livraisonStandard} onChange={(v) => set('livraisonStandard', v)} />
        <SwitchRow icon="bicycle-outline" label="Le client choisit un livreur" sub="Livreurs Shoneya" value={form.livraisonLivreur} onChange={(v) => set('livraisonLivreur', v)} />
        <SwitchRow icon="people-outline" label="Via un correspondant" sub="Surtout pour les produits venant de l’étranger" value={form.livraisonCorrespondant} onChange={(v) => set('livraisonCorrespondant', v)} last />
      </View>
      {err('livraison') ? <ErrorLine text={err('livraison')!} /> : null}
      <Row>
        <Col>
          <TextField label="Frais de livraison locale" value={formatThousands(form.fraisLivraisonLocal)} onChangeText={(v) => set('fraisLivraisonLocal', v.replace(/\D/g, ''))}
            keyboardType="number-pad" suffix="GNF" placeholder="0 = gratuit" error={err('fraisLivraisonLocal')} />
        </Col>
        <Col><SelectField label="Délai estimé" value={form.delaiLivraison} options={opts(DELAIS)} onChange={(v) => set('delaiLivraison', v)} /></Col>
      </Row>
    </>
  );
}

/* ── Garanties affichées ──────────────────────────────────────────────── */

export function GarantiesFields({ form, set }: Omit<Props, 'err'>) {
  return (
    <View>
      <SwitchRow icon="lock-closed-outline" label="Paiement sécurisé" sub="Orange Money, portefeuille Shoneya" value={form.garantiePaiement} onChange={(v) => set('garantiePaiement', v)} />
      <SwitchRow icon="return-down-back-outline" label="Retour garanti" sub="Remboursement ou échange" value={form.garantieRetour} onChange={(v) => set('garantieRetour', v)} />
      <SwitchRow icon="shield-checkmark-outline" label="Produit authentique" sub="Pas de contrefaçon" value={form.garantieAuthentic} onChange={(v) => set('garantieAuthentic', v)} />
      <SwitchRow icon="headset-outline" label="Service client" sub="Réponse rapide par message ou téléphone" value={form.garantieSupport} onChange={(v) => set('garantieSupport', v)} last />
    </View>
  );
}

/* ── Caractéristiques ─────────────────────────────────────────────────── */

export function SpecsFields({ form, set, err }: Props) {
  const theme = useTheme();
  const update = (i: number, k: 'cle' | 'valeur', v: string) => set('specs', form.specs.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  return (
    <>
      {form.specs.map((s, i) => (
        <View key={i} style={[styles.lineBox, { borderColor: theme.border }]}>
          <Row>
            <Col><TextField label={i === 0 ? 'Critère' : undefined} value={s.cle} onChangeText={(v) => update(i, 'cle', v)} placeholder="ex. Matière" error={err(`specs.${i}.cle`)} /></Col>
            <Col><TextField label={i === 0 ? 'Valeur' : undefined} value={s.valeur} onChangeText={(v) => update(i, 'valeur', v)} placeholder="ex. 100 % coton" error={err(`specs.${i}.valeur`)} /></Col>
          </Row>
          {form.specs.length > 1 ? <RemoveBtn label="Retirer ce critère" onPress={() => set('specs', form.specs.filter((_, j) => j !== i))} /> : null}
        </View>
      ))}
      {err('specs') ? <ErrorLine text={err('specs')!} /> : null}
      {form.specs.length < LIMITS.specsCount ? <AddLine label="Ajouter une caractéristique" onPress={() => set('specs', [...form.specs, { cle: '', valeur: '' }])} /> : null}
    </>
  );
}

/* ── Variantes ────────────────────────────────────────────────────────── */

export function VariantesFields({ form, set, err }: Props) {
  const theme = useTheme();
  const update = (i: number, k: 'type' | 'vals', v: string) => set('variantes', form.variantes.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  if (!form.variantesOn) {
    return <ThemedText type="small" themeColor="textSecondary">Couleurs, tailles, pointures… Activez si le client doit choisir une option à la commande.</ThemedText>;
  }
  return (
    <>
      {form.variantes.map((v, i) => {
        const values = v.vals.split(',').map((x) => x.trim()).filter(Boolean);
        return (
          <View key={i} style={[styles.lineBox, { borderColor: theme.border }]}>
            <SelectField label="Type" value={v.type} options={opts(VARIANTE_TYPES)} onChange={(t) => update(i, 'type', t)} error={err(`variantes.${i}.type`)} />
            <TextField label="Valeurs (séparées par une virgule)" value={v.vals} onChangeText={(t) => update(i, 'vals', t)} max={LIMITS.varianteVals}
              placeholder="ex. Noir, Blanc, Bleu" error={err(`variantes.${i}.vals`)} />
            {values.length ? (
              <View style={styles.chips}>
                {values.map((x, k) => <View key={`${x}-${k}`} style={styles.chip}><ThemedText style={styles.chipText}>{x}</ThemedText></View>)}
              </View>
            ) : null}
            {form.variantes.length > 1 ? <RemoveBtn label="Retirer cette variante" onPress={() => set('variantes', form.variantes.filter((_, j) => j !== i))} /> : null}
          </View>
        );
      })}
      {err('variantes') ? <ErrorLine text={err('variantes')!} /> : null}
      {form.variantes.length < LIMITS.variantesCount ? (
        <AddLine label="Ajouter un type de variante" onPress={() => {
          const used = new Set(form.variantes.map((x) => x.type));
          set('variantes', [...form.variantes, { type: VARIANTE_TYPES.find((t) => !used.has(t)) ?? 'Modèle', vals: '' }]);
        }} />
      ) : null}
    </>
  );
}

/* ── Vente en gros ────────────────────────────────────────────────────── */

export function GrosFields({ form, set, err, forced }: Props & { forced: boolean }) {
  const theme = useTheme();
  if (!forced && !form.venteEnGros) {
    return <ThemedText type="small" themeColor="textSecondary">Prix dégressifs par quantité, pour les revendeurs et commandes en volume.</ThemedText>;
  }
  const detail = parseIntInput(form.prix);
  const update = (i: number, k: keyof Tier, v: string) => set('tiers', form.tiers.map((t, j) => (j === i ? { ...t, [k]: v.replace(/\D/g, '') } : t)));
  const addTier = () => {
    const last = form.tiers[form.tiers.length - 1];
    const lastMax = last ? parseIntInput(last.max) : null;
    const next = lastMax && !Number.isNaN(lastMax) ? String(lastMax + 1) : '';
    set('tiers', [...form.tiers, { min: next, max: '', prix: '' }]);
  };
  return (
    <>
      <Row>
        <Col><TextField label="Commande minimum" required value={form.moq} onChangeText={(v) => set('moq', v.replace(/\D/g, ''))} keyboardType="number-pad" suffix="unités" placeholder="ex. 10" error={err('moq')} /></Col>
        <Col><TextField label="Unités par carton" value={form.conditionnement} onChangeText={(v) => set('conditionnement', v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="ex. 24" error={err('conditionnement')} /></Col>
      </Row>
      <TextField label="Délai de préparation" value={form.delaiPreparationGros} onChangeText={(v) => set('delaiPreparationGros', v)} max={LIMITS.delaiGros} placeholder="ex. 3-5 jours" error={err('delaiPreparationGros')} />

      <ThemedText type="smallBold">Paliers de prix</ThemedText>
      {form.tiers.map((t, i) => {
        const pu = parseIntInput(t.prix);
        const pct = detail && pu && !Number.isNaN(detail) && !Number.isNaN(pu) && pu < detail ? Math.round((1 - pu / detail) * 100) : null;
        return (
          <View key={i} style={[styles.lineBox, { borderColor: theme.border }]}>
            <Row>
              <Col><TextField label="De" value={t.min} onChangeText={(v) => update(i, 'min', v)} keyboardType="number-pad" placeholder="10" error={err(`tiers.${i}.min`)} /></Col>
              <Col><TextField label="À" value={t.max} onChangeText={(v) => update(i, 'max', v)} keyboardType="number-pad" placeholder="et plus" error={err(`tiers.${i}.max`)} /></Col>
            </Row>
            <TextField label="Prix unitaire" value={formatThousands(t.prix)} onChangeText={(v) => update(i, 'prix', v)} keyboardType="number-pad" suffix="GNF"
              error={err(`tiers.${i}.prix`)} hint={pct ? `-${pct} % par rapport au prix de détail` : undefined} />
            {form.tiers.length > 1 ? <RemoveBtn label="Retirer ce palier" onPress={() => set('tiers', form.tiers.filter((_, j) => j !== i))} /> : null}
          </View>
        );
      })}
      {err('tiers') ? <ErrorLine text={err('tiers')!} /> : null}
      {form.tiers.length < LIMITS.tiersCount ? <AddLine label="Ajouter un palier" onPress={addTier} /> : null}
    </>
  );
}

/* ── Référencement ────────────────────────────────────────────────────── */

export function SeoFields({ form, set, err, slugState, score }: Props & {
  slugState: 'idle' | 'checking' | 'free' | 'taken'; score: { score: number; items: { label: string; ok: boolean }[] };
}) {
  const theme = useTheme();
  const slug = normalizeSlug(form.urlSlug || form.nom);
  const color = score.score >= 70 ? Brand.success : score.score >= 40 ? '#D97706' : Brand.danger;
  return (
    <>
      <View style={styles.scoreRow}>
        <ThemedText type="smallBold">Qualité de la fiche</ThemedText>
        <ThemedText type="smallBold" style={{ color }}>{score.score} %</ThemedText>
      </View>
      <View style={[styles.bar, { backgroundColor: theme.backgroundElement }]}><View style={[styles.barFill, { width: `${score.score}%`, backgroundColor: color }]} /></View>
      <View style={styles.chips}>
        {score.items.filter((i) => !i.ok).slice(0, 4).map((i) => (
          <View key={i.label} style={[styles.chip, styles.chipTodo]}><ThemedText style={styles.chipTodoText}>+ {i.label}</ThemedText></View>
        ))}
      </View>
      <TextField label="Titre pour Google" value={form.titreSeo} onChangeText={(v) => set('titreSeo', v)} max={LIMITS.titreSeo} placeholder={form.nom || 'Titre affiché dans les résultats'} error={err('titreSeo')} />
      <TextField label="Description pour Google" value={form.descriptionSeo} onChangeText={(v) => set('descriptionSeo', v)} multiline max={LIMITS.descriptionSeo}
        placeholder="Phrase courte qui donne envie de cliquer" error={err('descriptionSeo')} />
      <TextField label="Adresse de la page" value={form.urlSlug} onChangeText={(v) => set('urlSlug', v)} autoCapitalize="none" autoCorrect={false}
        placeholder={normalizeSlug(form.nom) || 'robe-wax-coton'} error={err('urlSlug')}
        hint={form.urlSlug.trim()
          ? slugState === 'checking' ? 'Vérification…' : slugState === 'free' ? `✓ Disponible : …/produit/${slug}` : undefined
          : 'Vide = créée automatiquement à partir du nom'} />
      {slugState === 'checking' ? <ActivityIndicator size="small" color={Brand.primary} style={styles.left} /> : null}
      <View style={[styles.serp, { borderColor: theme.border }]}>
        <ThemedText numberOfLines={1} style={styles.serpUrl}>shoneya.com › produit › {slug || '…'}</ThemedText>
        <ThemedText numberOfLines={1} style={styles.serpTitle}>{form.titreSeo || form.nom || 'Titre du produit'}</ThemedText>
        <ThemedText numberOfLines={2} type="small" themeColor="textSecondary">{form.descriptionSeo || form.description || 'Description affichée par Google.'}</ThemedText>
      </View>
    </>
  );
}

/* ── Stories ──────────────────────────────────────────────────────────── */

export function StoriesFields({ form, set, err, imageCount }: Props & { imageCount: number }) {
  const theme = useTheme();
  if (!form.storiesOn) {
    return <ThemedText type="small" themeColor="textSecondary">Mettez ce produit en avant 24 h dans les stories de votre boutique.</ThemedText>;
  }
  const toggleDay = (d: string) => set('storyJours', form.storyJours.includes(d) ? form.storyJours.filter((x) => x !== d) : [...form.storyJours, d]);
  return (
    <>
      <ThemedText type="small" themeColor="textSecondary">
        {imageCount ? `${imageCount} photo(s) publiée(s) en story, pendant 24 h.` : 'Ajoutez des photos : elles seront publiées en story.'}
      </ThemedText>
      <Row>
        <Col><TextField label="De" value={form.storyDebut} onChangeText={(v) => set('storyDebut', v)} placeholder="08:00" keyboardType="numbers-and-punctuation" maxLength={5} /></Col>
        <Col><TextField label="À" value={form.storyFin} onChangeText={(v) => set('storyFin', v)} placeholder="22:00" keyboardType="numbers-and-punctuation" maxLength={5} /></Col>
      </Row>
      <View style={styles.days}>
        {JOURS.map((d) => {
          const on = form.storyJours.includes(d.value);
          return (
            <Pressable key={d.value} onPress={() => toggleDay(d.value)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              style={[styles.day, on ? styles.dayOn : { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={[styles.dayText, on && styles.dayTextOn]}>{d.label}</ThemedText>
            </Pressable>
          );
        })}
      </View>
      {err('stories') ? <ErrorLine text={err('stories')!} /> : null}
    </>
  );
}

/* ── Aperçu des revenus ───────────────────────────────────────────────── */

export function RevenusFields({ prix, pct, commission, loading }: { prix: number; pct: number | null; commission: number | null; loading: boolean }) {
  const theme = useTheme();
  const com = commission ?? (pct != null ? (prix * pct) / 100 : null);
  return (
    <View style={styles.rev}>
      <RevLine label="Prix de vente" value={prix ? gnf(prix) : '—'} />
      <RevLine label={`Commission Shoneya${pct != null ? ` (${pct.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %)` : ''}`} value={loading ? '…' : prix && com != null ? `- ${gnf(com)}` : '—'} muted />
      <View style={[styles.revSep, { backgroundColor: theme.border }]} />
      <RevLine label="Vous recevez" value={prix && com != null ? gnf(prix - com) : '—'} strong />
    </View>
  );
}
function RevLine({ label, value, muted, strong }: { label: string; value: string; muted?: boolean; strong?: boolean }) {
  return (
    <View style={styles.revLine}>
      <ThemedText type={strong ? 'smallBold' : 'small'} themeColor={muted ? 'textSecondary' : undefined} style={styles.flex}>{label}</ThemedText>
      <ThemedText style={[styles.revValue, strong && { color: Brand.success, fontSize: 17 }]}>{value}</ThemedText>
    </View>
  );
}

/* ── Petits boutons ───────────────────────────────────────────────────── */

function AddLine({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={styles.addLine}>
      <Ionicons name="add-circle-outline" size={19} color={Brand.primary} />
      <ThemedText type="smallBold" style={{ color: Brand.primary }}>{label}</ThemedText>
    </Pressable>
  );
}
function RemoveBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={styles.remove}>
      <Ionicons name="trash-outline" size={15} color={Brand.danger} />
      <ThemedText type="small" style={{ color: Brand.danger }}>Retirer</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  left: { alignSelf: 'flex-start' },
  inlineBox: { gap: 6 },
  retry: { alignSelf: 'flex-start', paddingVertical: 4 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: 12, padding: 10 },
  noteIco: { fontSize: 18 },
  lineBox: { borderWidth: 1, borderRadius: 14, padding: 10, gap: 8 },
  remove: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  addLine: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: `${Brand.primary}14`, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { color: Brand.primary, fontSize: 12.5, lineHeight: 16, fontWeight: '700' },
  chipTodo: { backgroundColor: '#FFF4E5' },
  chipTodoText: { color: '#B45309', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between' },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  serp: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 2 },
  serpUrl: { fontSize: 12, color: '#0F9D58' },
  serpTitle: { fontSize: 15.5, lineHeight: 20, color: '#1A0DAB', fontWeight: '600' },
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  day: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  dayOn: { backgroundColor: Brand.primary },
  dayText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  dayTextOn: { color: '#fff' },
  rev: { gap: 8 },
  revLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  revValue: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  revSep: { height: StyleSheet.hairlineWidth },
});
