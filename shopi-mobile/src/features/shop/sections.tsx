/**
 * Onglets du profil public d'une entreprise (écran app/(app)/boutique/[id].tsx) :
 * Produits (recherche, catégories, filtres, tri) · Services · Promotions ·
 * Livreurs · Points relais · Avis · À propos — même contenu que le site.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { capitalize, initials } from '@/components/catalog';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { discountPercent, formatPrice, thumb } from '@/features/catalog/format';
import { openDriver, openProduct, openRelay, openSite } from '@/features/catalog/open';
import { useTheme } from '@/hooks/use-theme';

import type { Promo, Review, ShopDetail, ShopDriver, ShopProduct, ShopRelay, ShopService } from './api';
import { DAY_LABEL, sortedHours, todayKey } from './hours';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/* ── Petits éléments partagés ───────────────────────────────────────── */

export function Stars({ value, size = 13 }: { value: number; size?: number }) {
  return (
    <View style={s.row}>
      {[1, 2, 3, 4, 5].map((v) => (
        <Ionicons
          key={v}
          name={value >= v ? 'star' : value >= v - 0.5 ? 'star-half' : 'star-outline'}
          size={size}
          color={value >= v - 0.5 ? '#F59E0B' : '#CBD5E1'}
        />
      ))}
    </View>
  );
}

export function Empty({ icon, title, text }: { icon: IconName; title: string; text?: string }) {
  const theme = useTheme();
  return (
    <View style={s.empty}>
      <View style={[s.emptyIco, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name={icon} size={28} color={theme.textSecondary} />
      </View>
      <ThemedText style={s.emptyTitle}>{title}</ThemedText>
      {text ? (
        <ThemedText type="small" themeColor="textSecondary" style={s.center}>
          {text}
        </ThemedText>
      ) : null}
    </View>
  );
}

function Chip({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon?: IconName }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[s.chip, active ? { backgroundColor: Brand.primary, borderColor: Brand.primary } : { borderColor: theme.border }]}>
      {icon ? <Ionicons name={icon} size={14} color={active ? '#fff' : theme.text} /> : null}
      <ThemedText type="small" style={[s.chipText, active && { color: '#fff' }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function FollowPill({ followed, loading, onPress }: { followed: boolean; loading?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityState={{ selected: followed, busy: !!loading }}
      style={[s.followPill, followed ? { backgroundColor: Brand.primary, borderColor: Brand.primary } : { borderColor: theme.border }]}>
      {loading ? (
        <ActivityIndicator size="small" color={followed ? '#fff' : Brand.primary} />
      ) : (
        <ThemedText type="smallBold" style={followed ? { color: '#fff' } : undefined}>
          {followed ? 'Abonné' : 'S’abonner'}
        </ThemedText>
      )}
    </Pressable>
  );
}

const call = (phone?: string | null) => {
  if (!phone) return Alert.alert('Téléphone', 'Numéro non renseigné.');
  void Linking.openURL(`tel:${phone.replace(/\s/g, '')}`);
};

const place = (a: { localisation?: string | null; quartier?: string | null; commune?: string | null; ville?: string | null; zone?: string | null }) =>
  [a.quartier || a.localisation, a.commune, a.ville].filter((v): v is string => !!v).map(capitalize).filter((v, i, arr) => arr.indexOf(v) === i).join(', ') || a.zone || '';

const NEW_DAYS = 14;
const isNew = (p: ShopProduct) => !!p.createdAt && Date.now() - new Date(p.createdAt).getTime() < NEW_DAYS * 86_400_000;

/* ── Produits ───────────────────────────────────────────────────────── */

const SORTS = ['Pertinence', 'Prix croissant', 'Prix décroissant', 'Nouveautés'] as const;
type Sort = (typeof SORTS)[number];
const PAGE = 24;

export function ProductsTab({
  products,
  loading,
  width,
  favIds,
  cartIds,
  pendingCart,
  onToggleFav,
  onAddToCart,
}: {
  products: ShopProduct[];
  loading: boolean;
  width: number;
  favIds: Set<string>;
  cartIds: Set<string>;
  pendingCart?: string;
  onToggleFav: (id: string) => void;
  onAddToCart: (id: string) => void;
}) {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [inStock, setInStock] = useState(false);
  const [promo, setPromo] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [sort, setSort] = useState<Sort>('Pertinence');
  const [sortOpen, setSortOpen] = useState(false);
  const [shown, setShown] = useState(PAGE);

  /* Catégories RÉELLES de la boutique, les plus fournies d'abord. */
  const cats = useMemo(() => {
    const m = new Map<string, { icon: string; n: number }>();
    for (const p of products) {
      const nom = p.category?.nom;
      if (!nom) continue;
      const e = m.get(nom) ?? { icon: p.category?.icone || '📦', n: 0 };
      e.n++;
      m.set(nom, e);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [products]);

  const list = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('fr');
    const out = products.filter(
      (p) =>
        (!cat || p.category?.nom === cat) &&
        (!inStock || p.stock > 0) &&
        (!promo || !!discountPercent(p.prix, p.prixAncien)) &&
        (!fresh || isNew(p)) &&
        (!q || `${p.nom} ${p.marque ?? ''} ${p.category?.nom ?? ''}`.toLocaleLowerCase('fr').includes(q)),
    );
    if (sort === 'Prix croissant') out.sort((a, b) => a.prix - b.prix);
    if (sort === 'Prix décroissant') out.sort((a, b) => b.prix - a.prix);
    if (sort === 'Nouveautés') out.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    return out;
  }, [products, cat, inStock, promo, fresh, search, sort]);

  const filtered = !!(cat || inStock || promo || fresh || search.trim());
  const reset = () => {
    setCat(null);
    setInStock(false);
    setPromo(false);
    setFresh(false);
    setSearch('');
  };

  if (loading) return <ActivityIndicator style={s.loader} color={Brand.primary} />;
  if (products.length === 0) return <Empty icon="cube-outline" title="Aucun produit pour le moment" text="Cette boutique n’a encore publié aucun produit." />;

  const cardW = (width - 16 * 2 - 12) / 2;
  return (
    <View style={s.gap12}>
      <View style={[s.search, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search" size={18} color={theme.textSecondary} />
        <TextInput
          value={search}
          onChangeText={(t) => {
            setSearch(t);
            setShown(PAGE);
          }}
          placeholder={`Rechercher parmi ${products.length} produit${products.length > 1 ? 's' : ''}`}
          placeholderTextColor={theme.textSecondary}
          style={[s.searchInput, { color: theme.text }]}
          returnKeyType="search"
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel="Effacer la recherche">
            <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {cats.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          <Chip label={`Tout · ${products.length}`} active={!cat} onPress={() => setCat(null)} />
          {cats.map(([nom, v]) => (
            <Chip key={nom} label={`${v.icon} ${nom} · ${v.n}`} active={cat === nom} onPress={() => setCat(cat === nom ? null : nom)} />
          ))}
        </ScrollView>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
        <Chip icon="swap-vertical" label={sort} active={sort !== 'Pertinence'} onPress={() => setSortOpen(true)} />
        <Chip icon="checkmark-circle-outline" label="En stock" active={inStock} onPress={() => setInStock(!inStock)} />
        <Chip icon="pricetag-outline" label="En promotion" active={promo} onPress={() => setPromo(!promo)} />
        <Chip icon="sparkles-outline" label="Nouveautés" active={fresh} onPress={() => setFresh(!fresh)} />
      </ScrollView>

      <View style={s.between}>
        <ThemedText type="small" themeColor="textSecondary">
          {list.length} produit{list.length > 1 ? 's' : ''}
        </ThemedText>
        {filtered ? (
          <Pressable onPress={reset} hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: Brand.primary }}>
              Réinitialiser
            </ThemedText>
          </Pressable>
        ) : null}
      </View>

      {list.length === 0 ? (
        <Empty icon="funnel-outline" title="Aucun produit ne correspond" text="Essayez d’autres filtres." />
      ) : (
        <View style={s.grid}>
          {list.slice(0, shown).map((p) => (
            <ShopProductCard
              key={p.id}
              p={p}
              width={cardW}
              fav={favIds.has(p.id)}
              inCart={cartIds.has(p.id)}
              adding={pendingCart === p.id}
              onFav={() => onToggleFav(p.id)}
              onAdd={() => onAddToCart(p.id)}
            />
          ))}
        </View>
      )}
      {list.length > shown ? (
        <Pressable onPress={() => setShown(shown + PAGE)} style={[s.more, { borderColor: theme.border }]} accessibilityRole="button">
          <ThemedText type="smallBold">Afficher plus ({list.length - shown} restants)</ThemedText>
        </Pressable>
      ) : null}

      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setSortOpen(false)}>
          <View style={[s.sheet, { backgroundColor: theme.background }]}>
            <ThemedText style={s.sheetTitle}>Trier par</ThemedText>
            {SORTS.map((o) => (
              <Pressable
                key={o}
                onPress={() => {
                  setSort(o);
                  setSortOpen(false);
                }}
                style={[s.sheetRow, { borderTopColor: theme.border }]}
                accessibilityRole="button">
                <ThemedText style={{ flex: 1 }}>{o}</ThemedText>
                {sort === o ? <Ionicons name="checkmark" size={20} color={Brand.primary} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function ShopProductCard({
  p,
  width,
  fav,
  inCart,
  adding,
  onFav,
  onAdd,
}: {
  p: ShopProduct;
  width: number;
  fav: boolean;
  inCart: boolean;
  adding: boolean;
  onFav: () => void;
  onAdd: () => void;
}) {
  const theme = useTheme();
  const img = thumb([...p.images].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)).find((i) => (i.type ?? 'image') === 'image')?.url, 400);
  const pct = discountPercent(p.prix, p.prixAncien);
  const out = p.stock <= 0;
  const stock = out
    ? { label: 'Rupture de stock', color: Brand.danger }
    : p.stock < 5
      ? { label: `Plus que ${p.stock} en stock`, color: '#D97706' }
      : { label: 'En stock', color: Brand.success };
  return (
    <View style={[s.pCard, { width, borderColor: theme.border }]}>
      <Pressable onPress={() => openProduct(p.id)} accessibilityRole="button" accessibilityLabel={`${p.nom}, ${formatPrice(p.prix)}`}>
        <View style={[s.pImg, { backgroundColor: theme.backgroundElement }]}>
          {img ? <Image source={{ uri: img }} style={s.fill} contentFit="cover" transition={150} recyclingKey={p.id} /> : <ThemedText style={s.pEmoji}>{p.category?.icone || '📦'}</ThemedText>}
          {pct ? (
            <View style={[s.badge, { backgroundColor: Brand.danger }]}>
              <ThemedText style={s.badgeText}>−{pct}%</ThemedText>
            </View>
          ) : isNew(p) ? (
            <View style={[s.badge, { backgroundColor: Brand.success }]}>
              <ThemedText style={s.badgeText}>NOUVEAU</ThemedText>
            </View>
          ) : null}
          {out ? <View style={s.outVeil} /> : null}
        </View>
        <View style={s.pBody}>
          {p.category?.nom ? (
            <ThemedText numberOfLines={1} themeColor="textSecondary" style={s.pCat}>
              {p.category.nom}
            </ThemedText>
          ) : null}
          <ThemedText numberOfLines={2} style={s.pName}>
            {p.nom}
          </ThemedText>
          <ThemedText style={s.pPrice}>{formatPrice(p.prix)}</ThemedText>
          {pct && p.prixAncien ? (
            <ThemedText themeColor="textSecondary" style={s.pOld}>
              {formatPrice(p.prixAncien)}
            </ThemedText>
          ) : null}
          <ThemedText style={[s.pStock, { color: stock.color }]}>● {stock.label}</ThemedText>
        </View>
      </Pressable>
      <Pressable onPress={onFav} hitSlop={6} style={s.heart} accessibilityRole="button" accessibilityLabel={fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}>
        <Ionicons name={fav ? 'heart' : 'heart-outline'} size={18} color={fav ? Brand.danger : '#0B1F3A'} />
      </Pressable>
      <Pressable
        onPress={onAdd}
        disabled={out || adding}
        accessibilityRole="button"
        style={[s.addBtn, inCart ? { backgroundColor: theme.backgroundSelected } : { backgroundColor: Brand.primary }, out && { opacity: 0.45 }]}>
        {adding ? (
          <ActivityIndicator size="small" color={inCart ? Brand.primary : '#fff'} />
        ) : (
          <>
            <Ionicons name={inCart ? 'checkmark' : 'cart-outline'} size={16} color={inCart ? Brand.primary : '#fff'} />
            <ThemedText type="smallBold" style={{ color: inCart ? Brand.primary : '#fff' }}>
              {out ? 'Indisponible' : inCart ? 'Au panier · +1' : 'Ajouter'}
            </ThemedText>
          </>
        )}
      </Pressable>
    </View>
  );
}

/* ── Services ───────────────────────────────────────────────────────── */

const duration = (min?: number | null, max?: number | null) => {
  const f = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}` : `${m} min`);
  if (min && max && max !== min) return `${f(min)} – ${f(max)}`;
  return min ? f(min) : max ? f(max) : null;
};

export function ServicesTab({ services, loading }: { services: ShopService[]; loading: boolean }) {
  const theme = useTheme();
  if (loading) return <ActivityIndicator style={s.loader} color={Brand.primary} />;
  if (services.length === 0) return <Empty icon="construct-outline" title="Aucun service pour le moment" text="Cette entreprise n’a encore publié aucun service." />;
  return (
    <View style={s.gap12}>
      {services.map((sv) => {
        const img = thumb([...sv.media].sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0)).find((m) => (m.type ?? 'image') === 'image')?.url, 300);
        const price =
          sv.pricingType === 'sur_devis' ? 'Sur devis' : sv.prix != null ? `${formatPrice(sv.prix)}${sv.pricingType === 'horaire' ? ' / heure' : ''}` : '';
        const modes = [sv.surPlaceEntreprise && 'Sur place', sv.aDomicile && 'À domicile', sv.aDistance && 'À distance'].filter(Boolean) as string[];
        const d = duration(sv.dureeMinMinutes, sv.dureeMaxMinutes);
        return (
          <Pressable
            key={sv.id}
            onPress={() => openSite(`/service/${sv.id}`)}
            accessibilityRole="button"
            style={({ pressed }) => [s.svc, { borderColor: theme.border }, pressed && s.pressed]}>
            <View style={[s.svcImg, { backgroundColor: theme.backgroundElement }]}>
              {img ? <Image source={{ uri: img }} style={s.fill} contentFit="cover" /> : <ThemedText style={s.pEmoji}>{sv.category?.icone || '🛠️'}</ThemedText>}
            </View>
            <View style={s.flex}>
              {sv.category?.nom ? (
                <ThemedText numberOfLines={1} themeColor="textSecondary" style={s.pCat}>
                  {sv.category.nom}
                </ThemedText>
              ) : null}
              <ThemedText numberOfLines={2} style={s.pName}>
                {sv.nom}
              </ThemedText>
              {price ? <ThemedText style={s.pPrice}>{price}</ThemedText> : null}
              <View style={s.tags}>
                {modes.map((m) => (
                  <View key={m} style={[s.tag, { backgroundColor: theme.backgroundSelected }]}>
                    <ThemedText style={[s.tagText, { color: Brand.primary }]}>{m}</ThemedText>
                  </View>
                ))}
                {d ? (
                  <View style={[s.tag, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={s.tagText}>⏱ {d}</ThemedText>
                  </View>
                ) : null}
                {sv.reservationRequise ? (
                  <View style={[s.tag, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={s.tagText}>Sur réservation</ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ── Promotions ─────────────────────────────────────────────────────── */

const PROMO_TYPES: Record<string, { tag: string; color: string; icon: IconName }> = {
  discount: { tag: 'Réduction', color: '#1652F0', icon: 'pricetag' },
  'free-ship': { tag: 'Livraison offerte', color: '#059669', icon: 'bicycle' },
  bundle: { tag: 'Offre groupée', color: '#7C3AED', icon: 'gift' },
  flash: { tag: 'Vente flash', color: '#DC2626', icon: 'flash' },
};

const shortDate = (v: string) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
};

export function PromosTab({ promos, loading }: { promos: Promo[]; loading: boolean }) {
  if (loading) return <ActivityIndicator style={s.loader} color={Brand.primary} />;
  if (promos.length === 0) return <Empty icon="pricetags-outline" title="Aucune promotion en cours" text="Abonnez-vous pour être prévenu des prochaines offres." />;
  return (
    <View style={s.gap12}>
      <ThemedText type="small" themeColor="textSecondary">
        {promos.length} promotion{promos.length > 1 ? 's' : ''} active{promos.length > 1 ? 's' : ''} · touchez « Copier » puis collez le code au moment de commander.
      </ThemedText>
      {promos.map((p) => {
        const cfg = PROMO_TYPES[p.type] ?? PROMO_TYPES.discount;
        const value =
          p.type === 'free-ship'
            ? 'Offerte'
            : p.valueType === 'percent' && p.valeur
              ? `−${p.valeur}%`
              : p.valueType === 'fixed' && p.valeur
                ? `−${formatPrice(p.valeur)}`
                : cfg.tag;
        const left = p.maxUtilisations ? p.maxUtilisations - p.usesCount : null;
        const cond = [
          p.montantMinimum ? `Dès ${formatPrice(p.montantMinimum)} d’achat` : null,
          p.endDate ? `Jusqu’au ${shortDate(p.endDate)}` : null,
          p.flashStock ? `${p.flashStock} restants` : null,
          left && left > 0 ? `${left} utilisation${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''}` : null,
        ].filter(Boolean);
        return (
          <View key={p.id} style={[s.promo, { backgroundColor: cfg.color }]}>
            <Ionicons name={cfg.icon} size={90} color="rgba(255,255,255,0.12)" style={s.promoDeco} />
            <View style={s.promoTag}>
              <Ionicons name={cfg.icon} size={11} color={cfg.color} />
              <ThemedText style={[s.promoTagText, { color: cfg.color }]}>{cfg.tag.toUpperCase()}</ThemedText>
            </View>
            <ThemedText style={s.promoValue}>{value}</ThemedText>
            <ThemedText style={s.promoName}>{p.nom}</ThemedText>
            {cond.length ? <ThemedText style={s.promoCond}>{cond.join(' · ')}</ThemedText> : null}
            <View style={s.promoCodeRow}>
              <View style={s.promoCode}>
                <ThemedText style={s.promoCodeText}>{p.code}</ThemedText>
              </View>
              <Pressable
                onPress={async () => {
                  await Clipboard.setStringAsync(p.code);
                  Alert.alert('Code copié', `« ${p.code} » est copié. Collez-le au moment de commander.`);
                }}
                style={s.promoCopy}
                accessibilityRole="button">
                <Ionicons name="copy-outline" size={15} color={cfg.color} />
                <ThemedText type="smallBold" style={{ color: cfg.color }}>
                  Copier
                </ThemedText>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ── Livreurs et points relais ──────────────────────────────────────── */

const AVAIL: Record<string, { label: string; color: string }> = {
  available: { label: 'Disponible', color: Brand.success },
  on_delivery: { label: 'En course', color: '#D97706' },
};

export function DriversTab({
  drivers,
  loading,
  follows,
  pending,
  onFollow,
}: {
  drivers: ShopDriver[];
  loading: boolean;
  follows: Record<string, boolean>;
  pending?: string;
  onFollow: (id: string) => void;
}) {
  const theme = useTheme();
  if (loading) return <ActivityIndicator style={s.loader} color={Brand.primary} />;
  if (drivers.length === 0) return <Empty icon="bicycle-outline" title="Aucun livreur associé" text="Cette boutique n’a pas encore de livreur attitré." />;
  return (
    <View style={[s.card, { borderColor: theme.border }]}>
      {drivers.map((d, i) => {
        const av = AVAIL[d.availability] ?? { label: 'Hors ligne', color: '#94A3B8' };
        const where = place(d);
        return (
          <View key={d.id} style={[s.actor, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
            <Pressable onPress={() => openDriver(d.id)} style={s.actorTap} accessibilityRole="button" accessibilityLabel={d.fullName}>
              <View style={[s.actorAva, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText style={s.actorEmoji}>{d.emoji}</ThemedText>
                <View style={[s.dot, { backgroundColor: av.color, borderColor: theme.background }]} />
              </View>
              <View style={s.flex}>
                <ThemedText numberOfLines={1} style={s.actorName}>
                  {d.fullName}
                </ThemedText>
                <ThemedText type="small" style={{ color: av.color }}>
                  ● {av.label}
                </ThemedText>
                {where ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    📍 {where}
                  </ThemedText>
                ) : null}
                <View style={s.row6}>
                  <Stars value={d.note} size={11} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {d.note > 0 ? d.note.toFixed(1) : '—'} · {d.trips} livraison{d.trips > 1 ? 's' : ''}
                  </ThemedText>
                </View>
              </View>
            </Pressable>
            <FollowPill followed={!!follows[d.id]} loading={pending === d.id} onPress={() => onFollow(d.id)} />
          </View>
        );
      })}
    </View>
  );
}

export function RelaysTab({
  relays,
  loading,
  follows,
  pending,
  onFollow,
}: {
  relays: ShopRelay[];
  loading: boolean;
  follows: Record<string, boolean>;
  pending?: string;
  onFollow: (id: string) => void;
}) {
  const theme = useTheme();
  if (loading) return <ActivityIndicator style={s.loader} color={Brand.primary} />;
  if (relays.length === 0) return <Empty icon="location-outline" title="Aucun point relais associé" text="Cette boutique n’a pas encore de point relais partenaire." />;
  return (
    <View style={s.gap12}>
      {relays.map((c) => {
        const where = place(c);
        return (
          <View key={c.id} style={[s.relay, { borderColor: theme.border }]}>
            <Pressable onPress={() => openRelay(c.id)} style={s.actorTap} accessibilityRole="button" accessibilityLabel={c.fullName}>
              <View style={[s.actorAva, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText style={s.actorInit}>{initials(c.fullName)}</ThemedText>
              </View>
              <View style={s.flex}>
                <View style={s.row6}>
                  <ThemedText numberOfLines={1} style={[s.actorName, s.shrink]}>
                    {c.fullName}
                  </ThemedText>
                  {c.verified ? <Ionicons name="checkmark-circle" size={15} color={Brand.primary} /> : null}
                </View>
                {where ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    📍 {where}
                  </ThemedText>
                ) : null}
                <View style={s.row6}>
                  <Stars value={c.note} size={11} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {c.note > 0 ? c.note.toFixed(1) : '—'} · {c.missions} mission{c.missions > 1 ? 's' : ''}
                  </ThemedText>
                </View>
              </View>
            </Pressable>
            {c.bio ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={3}>
                {c.bio}
              </ThemedText>
            ) : null}
            <View style={s.tags}>
              <View style={[s.tag, { backgroundColor: c.horaireAujourdhui ? '#E7F6EE' : '#FDECEC' }]}>
                <ThemedText style={[s.tagText, { color: c.horaireAujourdhui ? Brand.success : Brand.danger }]}>
                  {c.horaireAujourdhui ? `Ouvert aujourd’hui · ${c.horaireAujourdhui}` : 'Fermé aujourd’hui'}
                </ThemedText>
              </View>
              {c.langues.map((l) => (
                <View key={l} style={[s.tag, { backgroundColor: theme.backgroundElement }]}>
                  <ThemedText style={s.tagText}>🗣 {l}</ThemedText>
                </View>
              ))}
            </View>
            <View style={s.row8}>
              <FollowPill followed={!!follows[c.id]} loading={pending === c.id} onPress={() => onFollow(c.id)} />
              <Pressable onPress={() => call(c.phone)} style={[s.outlineBtn, { borderColor: theme.border }]} accessibilityRole="button">
                <Ionicons name="call-outline" size={15} color={theme.text} />
                <ThemedText type="smallBold">Contacter</ThemedText>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ── Avis ───────────────────────────────────────────────────────────── */

export function ReviewsTab({ average, total, reviews, loading }: { average: number; total: number; reviews: Review[]; loading: boolean }) {
  const theme = useTheme();
  /* Répartition par étoiles calculée sur les avis reçus (le serveur ne l'envoie pas). */
  const dist = useMemo(() => {
    const d = [0, 0, 0, 0, 0];
    for (const r of reviews) {
      const n = Math.min(5, Math.max(1, Math.round(r.note)));
      d[n - 1]++;
    }
    return d;
  }, [reviews]);
  if (loading) return <ActivityIndicator style={s.loader} color={Brand.primary} />;
  return (
    <View style={s.gap12}>
      <View style={[s.card, s.reviewHead, { borderColor: theme.border }]}>
        <View style={s.reviewScore}>
          <ThemedText style={s.bigNote}>{average > 0 ? average.toFixed(1) : '—'}</ThemedText>
          <Stars value={average} size={15} />
          <ThemedText type="small" themeColor="textSecondary">
            {total} avis
          </ThemedText>
        </View>
        <View style={s.flex}>
          {[5, 4, 3, 2, 1].map((n) => {
            const c = dist[n - 1];
            const pct = reviews.length ? c / reviews.length : 0;
            return (
              <View key={n} style={s.distRow}>
                <ThemedText type="small" style={s.distN}>
                  {n}★
                </ThemedText>
                <View style={[s.distBar, { backgroundColor: theme.backgroundElement }]}>
                  <View style={[s.distFill, { width: `${pct * 100}%` }]} />
                </View>
                <ThemedText type="small" themeColor="textSecondary" style={s.distC}>
                  {c}
                </ThemedText>
              </View>
            );
          })}
        </View>
      </View>
      {reviews.length === 0 ? (
        <Empty icon="chatbubble-ellipses-outline" title="Aucun avis pour le moment" text="Les clients peuvent noter la boutique après une commande livrée." />
      ) : (
        reviews.map((r) => (
          <View key={r.id} style={[s.card, s.review, { borderColor: theme.border }]}>
            <View style={s.row8}>
              <View style={[s.reviewAva, { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText style={s.reviewInit}>{r.clientInitiales || initials(r.clientNom)}</ThemedText>
              </View>
              <View style={s.flex}>
                <ThemedText style={s.actorName}>{r.clientNom}</ThemedText>
                <View style={s.row6}>
                  <Stars value={r.note} size={12} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {r.date}
                  </ThemedText>
                </View>
              </View>
            </View>
            {r.commentaire ? <ThemedText style={s.reviewText}>{r.commentaire}</ThemedText> : null}
            {r.reponse ? (
              <View style={[s.reply, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="smallBold">Réponse de la boutique</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {r.reponse}
                </ThemedText>
              </View>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}

/* ── À propos ───────────────────────────────────────────────────────── */

const yearsSince = (d?: string | null) => {
  if (!d) return '—';
  const y = Math.floor((Date.now() - new Date(d).getTime()) / (365.25 * 86_400_000));
  return y > 0 ? `${y}+` : '< 1';
};

export function AboutTab({ shop, drivers }: { shop: ShopDetail; drivers: ShopDriver[] }) {
  const theme = useTheme();
  const hours = sortedHours(shop.horaires);
  const today = todayKey();
  const address = shop.adresse || place(shop);
  const wa = shop.whatsapp?.replace(/\D/g, '');
  const site = shop.website ? (/^https?:\/\//.test(shop.website) ? shop.website : `https://${shop.website}`) : null;

  const infos: { icon: IconName; title: string; value: string; onPress?: () => void }[] = [
    address ? { icon: 'location-outline' as IconName, title: 'Adresse', value: address } : null,
    shop.businessPhone ? { icon: 'call-outline' as IconName, title: 'Téléphone', value: shop.businessPhone, onPress: () => call(shop.businessPhone) } : null,
    wa ? { icon: 'logo-whatsapp' as IconName, title: 'WhatsApp', value: shop.whatsapp!, onPress: () => void Linking.openURL(`https://wa.me/${wa}`) } : null,
    shop.businessEmail ? { icon: 'mail-outline' as IconName, title: 'E-mail', value: shop.businessEmail, onPress: () => void Linking.openURL(`mailto:${shop.businessEmail}`) } : null,
    site ? { icon: 'globe-outline' as IconName, title: 'Site web', value: shop.website!, onPress: () => void Linking.openURL(site) } : null,
  ].filter((x): x is NonNullable<typeof x> => !!x);

  const lv = shop.livraison;
  const methods = lv
    ? ([
        lv.standard && { icon: 'cube-outline', label: 'Livraison standard par la boutique' },
        lv.livreursShopi && { icon: 'bicycle-outline', label: 'Livreurs Shoneya' },
        lv.correspondants && { icon: 'location-outline', label: 'Retrait en point relais' },
        lv.clickCollect && { icon: 'storefront-outline', label: 'Retrait en boutique (Click & Collect)' },
      ].filter(Boolean) as { icon: IconName; label: string }[])
    : [];

  return (
    <View style={s.gap12}>
      <View style={[s.card, s.pad, { borderColor: theme.border }]}>
        <ThemedText style={s.cardTitle}>À propos de la boutique</ThemedText>
        {shop.description ? <ThemedText style={s.desc}>{shop.description}</ThemedText> : (
          <ThemedText type="small" themeColor="textSecondary">
            La boutique n’a pas encore ajouté de présentation.
          </ThemedText>
        )}
        <View style={s.statGrid}>
          {[
            { v: yearsSince(shop.createdAt), l: 'Années sur Shoneya' },
            { v: shop.totalOrders > 0 ? `${shop.totalOrders}+` : '—', l: 'Commandes' },
            { v: shop.averageRating > 0 ? shop.averageRating.toFixed(1) : '—', l: 'Note moyenne' },
            { v: String(shop.totalAbonnes), l: 'Abonnés' },
          ].map((x) => (
            <View key={x.l} style={[s.statBox, { backgroundColor: theme.backgroundElement }]}>
              <ThemedText style={s.statV}>{x.v}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={s.center}>
                {x.l}
              </ThemedText>
            </View>
          ))}
        </View>
      </View>

      {infos.length ? (
        <View style={[s.card, { borderColor: theme.border }]}>
          <ThemedText style={[s.cardTitle, s.pad, s.noPadBottom]}>Infos pratiques</ThemedText>
          {infos.map((r, i) => (
            <Pressable
              key={r.title}
              onPress={r.onPress}
              disabled={!r.onPress}
              style={({ pressed }) => [s.infoRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, pressed && { backgroundColor: theme.backgroundElement }]}>
              <View style={[s.infoIco, { backgroundColor: theme.backgroundSelected }]}>
                <Ionicons name={r.icon} size={18} color={Brand.primary} />
              </View>
              <View style={s.flex}>
                <ThemedText type="small" themeColor="textSecondary">
                  {r.title}
                </ThemedText>
                <ThemedText style={r.onPress ? { color: Brand.primary } : undefined}>{r.value}</ThemedText>
              </View>
              {r.onPress ? <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={[s.card, s.pad, { borderColor: theme.border }]}>
        <ThemedText style={s.cardTitle}>Horaires d’ouverture</ThemedText>
        {hours.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Horaires non renseignés.
          </ThemedText>
        ) : (
          hours.map((h) => {
            const isToday = h.jour === today;
            return (
              <View key={h.jour} style={[s.hourRow, isToday && { backgroundColor: theme.backgroundSelected }]}>
                <ThemedText style={[s.flex, isToday && s.bold]}>
                  {DAY_LABEL[h.jour] ?? h.jour}
                  {isToday ? ' (aujourd’hui)' : ''}
                </ThemedText>
                {h.actif && h.ouverture && h.fermeture ? (
                  <ThemedText style={isToday ? s.bold : undefined}>
                    {h.ouverture} – {h.fermeture}
                  </ThemedText>
                ) : (
                  <ThemedText style={{ color: Brand.danger }}>Fermé</ThemedText>
                )}
              </View>
            );
          })
        )}
      </View>

      {lv ? (
        <View style={[s.card, s.pad, { borderColor: theme.border }]}>
          <ThemedText style={s.cardTitle}>Livraison</ThemedText>
          {methods.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Aucun mode de livraison renseigné.
            </ThemedText>
          ) : (
            methods.map((m) => (
              <View key={m.label} style={s.row8}>
                <Ionicons name="checkmark-circle" size={18} color={Brand.success} />
                <ThemedText style={s.flex}>{m.label}</ThemedText>
              </View>
            ))
          )}
          <ThemedText type="smallBold" style={s.zonesTitle}>
            Zones desservies
          </ThemedText>
          {lv.zones.length ? (
            <View style={s.tags}>
              {lv.zones.map((z) => (
                <View key={z} style={[s.tag, { backgroundColor: theme.backgroundSelected }]}>
                  <ThemedText style={[s.tagText, { color: Brand.primary }]}>{z}</ThemedText>
                </View>
              ))}
            </View>
          ) : (
            <ThemedText type="small" themeColor="textSecondary">
              Toutes les zones (aucune restriction).
            </ThemedText>
          )}
        </View>
      ) : null}

      {drivers.length ? (
        <View style={[s.card, s.pad, { borderColor: theme.border }]}>
          <ThemedText style={s.cardTitle}>Livreurs de la boutique</ThemedText>
          {drivers.slice(0, 4).map((d) => (
            <Pressable key={d.id} onPress={() => openDriver(d.id)} style={s.row8} accessibilityRole="button">
              <ThemedText style={s.actorEmoji}>{d.emoji}</ThemedText>
              <ThemedText numberOfLines={1} style={s.flex}>
                {d.fullName}
              </ThemedText>
              <Stars value={d.note} size={11} />
              <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                Voir
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  row: { flexDirection: 'row' },
  row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  row8: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  center: { textAlign: 'center' },
  bold: { fontWeight: '700' },
  gap12: { gap: 12 },
  pressed: { opacity: 0.7 },
  fill: { width: '100%', height: '100%' },
  loader: { marginVertical: 40 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 16 },
  emptyIco: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800', textAlign: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, minHeight: 44 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  chips: { gap: 8, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 34 },
  chipText: { fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  more: { borderWidth: 1, borderRadius: 999, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 },
  sheetTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800', marginBottom: 8 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', minHeight: 50, borderTopWidth: StyleSheet.hairlineWidth },
  pCard: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
  pImg: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  pEmoji: { fontSize: 38, lineHeight: 46 },
  outVeil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.55)' },
  badge: { position: 'absolute', top: 8, left: 8, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, lineHeight: 15, fontWeight: '800' },
  heart: { position: 'absolute', top: 8, right: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  pBody: { padding: 10, gap: 2 },
  pCat: { fontSize: 11, lineHeight: 14, textTransform: 'uppercase', letterSpacing: 0.5 },
  pName: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
  pPrice: { fontSize: 15, lineHeight: 20, fontWeight: '800', color: Brand.primary },
  pOld: { fontSize: 12, lineHeight: 16, textDecorationLine: 'line-through' },
  pStock: { fontSize: 11, lineHeight: 15, fontWeight: '600', marginTop: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 38, marginHorizontal: 10, marginBottom: 10, borderRadius: 999 },
  svc: { flexDirection: 'row', gap: 12, borderWidth: 1, borderRadius: 14, padding: 10 },
  svcImg: { width: 88, height: 88, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  tag: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  tagText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  promo: { borderRadius: 16, padding: 16, gap: 4, overflow: 'hidden' },
  promoDeco: { position: 'absolute', right: -10, top: -6 },
  promoTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  promoTagText: { fontSize: 10, lineHeight: 13, fontWeight: '800', letterSpacing: 0.6 },
  promoValue: { color: '#fff', fontSize: 30, lineHeight: 38, fontWeight: '900', marginTop: 4 },
  promoName: { color: '#fff', fontSize: 15, lineHeight: 20, fontWeight: '700' },
  promoCond: { color: 'rgba(255,255,255,0.85)', fontSize: 12, lineHeight: 17 },
  promoCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  promoCode: { flex: 1, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.7)', borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  promoCodeText: { color: '#fff', fontSize: 16, lineHeight: 21, fontWeight: '800', letterSpacing: 1.5, fontFamily: 'monospace' },
  promoCopy: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 12, minHeight: 40 },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  pad: { padding: 16, gap: 10 },
  noPadBottom: { paddingBottom: 6 },
  cardTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  actor: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  actorTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  actorAva: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  actorEmoji: { fontSize: 24, lineHeight: 30 },
  actorInit: { fontSize: 17, lineHeight: 22, fontWeight: '800', color: Brand.primary },
  dot: { position: 'absolute', right: 1, bottom: 1, width: 13, height: 13, borderRadius: 7, borderWidth: 2 },
  actorName: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  followPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 36, minWidth: 92, alignItems: 'center', justifyContent: 'center' },
  relay: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
  outlineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 36 },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16 },
  reviewScore: { alignItems: 'center', gap: 2, minWidth: 84 },
  bigNote: { fontSize: 38, lineHeight: 44, fontWeight: '900' },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 2 },
  distN: { width: 24 },
  distBar: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  distFill: { height: '100%', backgroundColor: '#F59E0B', borderRadius: 4 },
  distC: { width: 22, textAlign: 'right' },
  review: { padding: 14, gap: 8 },
  reviewAva: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  reviewInit: { fontWeight: '800', color: Brand.primary },
  reviewText: { fontSize: 15, lineHeight: 21 },
  reply: { borderRadius: 10, padding: 10, gap: 2 },
  desc: { fontSize: 15, lineHeight: 22 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox: { flexBasis: '47%', flexGrow: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center', gap: 2 },
  statV: { fontSize: 20, lineHeight: 26, fontWeight: '900', color: Brand.primary },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  infoIco: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  hourRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  zonesTitle: { marginTop: 6 },
});
