/**
 * Passage de commande (/commande), ouvert par « Commander » dans le panier :
 *   1. Articles (regroupés par boutique, une commande par boutique)
 *   2. Adresse de livraison (adresses enregistrées, ville / commune du référentiel)
 *   3. Livraison — seulement les modes acceptés par TOUTES les boutiques du panier :
 *        · Par la boutique (livraison ou retrait) — gratuit
 *        · Livreur Shoneya — choix du livreur (ceux des boutiques + ceux que le
 *          client suit), frais de la zone de destination × nombre de boutiques
 *        · Point relais — choix du correspondant (ceux des boutiques + suivis), gratuit
 *   4. Paiement : prélevé sur le portefeuille (solde réel, alerte si insuffisant)
 * Confirmation → POST /client/commandes ; règles et calculs : features/checkout/api.ts.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';

import { capitalize, ErrorState } from '@/components/catalog';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { fetchGeoItems, fetchVilles } from '@/features/auth/api';
import { useSession } from '@/features/auth/session-store';
import { cartCount, useCart } from '@/features/cart/api';
import { formatPrice } from '@/features/catalog/format';
import { openSite } from '@/features/catalog/open';
import { fetchDeliveryFee } from '@/features/product/api';
import { fetchWalletBalance } from '@/features/profile/api';
import { fetchShop, fetchShopDrivers, fetchShopRelays, type ShopDriver, type ShopRelay } from '@/features/shop/api';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import {
  createOrder,
  fetchContact,
  fetchFollowedTeam,
  fetchSavedAddresses,
  localPhone,
  normCommune,
  resolveModes,
  type DeliveryMode,
  type SavedAddress,
} from '../api';
import { ActorOption, type PickActor } from '../components/actor-option';
import { AddressFormView, type AddressForm } from '../components/address-form';
import { ModeOption } from '../components/mode-option';
import { Section } from '../components/section';

const AVAIL: Record<string, { label: string; color: string }> = {
  available: { label: 'Disponible', color: Brand.success },
  on_delivery: { label: 'En course', color: '#D97706' },
};

const placeOf = (a: { quartier?: string | null; localisation?: string | null; commune?: string | null; ville?: string | null; zone?: string | null }) =>
  [a.quartier || a.localisation, a.commune, a.ville].filter((v): v is string => !!v).map(capitalize).filter((v, i, arr) => arr.indexOf(v) === i).join(', ') || a.zone || null;

const addressText = (a: SavedAddress) => [a.rue, a.quartier].filter(Boolean).join(', ');

export default function CheckoutScreen() {
  const theme = useTheme();
  const qc = useQueryClient();
  const isClient = useSession((s) => s.user?.role) === 'client';
  const cart = useCart();
  const items = useMemo(() => cart.data ?? [], [cart.data]);

  /* ── Boutiques du panier : réglages de livraison + équipe ── */
  const shopIds = useMemo(() => [...new Set(items.map((i) => i.shopId).filter((x): x is string => !!x))], [items]);
  const shopQs = useQueries({ queries: shopIds.map((id) => ({ queryKey: qk.shop.detail(id), queryFn: () => fetchShop(id) })) });
  const driverQs = useQueries({ queries: shopIds.map((id) => ({ queryKey: qk.shop.drivers(id), queryFn: () => fetchShopDrivers(id).catch(() => [] as ShopDriver[]) })) });
  const relayQs = useQueries({ queries: shopIds.map((id) => ({ queryKey: qk.shop.relays(id), queryFn: () => fetchShopRelays(id).catch(() => [] as ShopRelay[]) })) });
  const shops = shopQs.map((q) => q.data).filter((s): s is NonNullable<typeof s> => !!s);
  const shopsLoading = shopQs.some((q) => q.isPending);

  /* ── Client : adresses, coordonnées, abonnements, portefeuille ── */
  const savedQ = useQuery({ queryKey: qk.checkout.addresses, queryFn: fetchSavedAddresses, enabled: isClient });
  const contactQ = useQuery({ queryKey: qk.checkout.contact, queryFn: fetchContact, enabled: isClient });
  const followedQ = useQuery({ queryKey: qk.checkout.followedTeam, queryFn: fetchFollowedTeam, enabled: isClient });
  const walletQ = useQuery({ queryKey: qk.wallet, queryFn: fetchWalletBalance, enabled: isClient });
  const villesQ = useQuery({ queryKey: qk.villes('+224'), queryFn: () => fetchVilles('+224'), staleTime: 60 * 60_000 });
  const cities = useMemo(() => (villesQ.data ?? []).map((v) => ({ value: v.id, label: v.nom })), [villesQ.data]);
  const cityIdOf = (name?: string | null) => (name ? (cities.find((c) => normCommune(c.label) === normCommune(name))?.value ?? null) : null);

  /* ── Formulaire : valeurs par défaut tirées des données + modifications du client ── */
  const [edits, setEdits] = useState<Partial<AddressForm>>({});
  const defaultAddress = savedQ.data?.find((a) => a.estDefaut) ?? savedQ.data?.[0];
  const defaults: AddressForm = {
    firstName: contactQ.data?.firstName ?? '',
    lastName: contactQ.data?.lastName ?? '',
    phone: localPhone(defaultAddress?.telephone ?? contactQ.data?.phone),
    cityId: cityIdOf(defaultAddress?.ville),
    city: defaultAddress?.ville ?? '',
    commune: defaultAddress?.commune ?? '',
    address: defaultAddress ? addressText(defaultAddress) : '',
    instructions: '',
    savedId: defaultAddress?.id ?? null,
  };
  const form: AddressForm = { ...defaults, ...edits };
  const patch = (p: Partial<AddressForm>) => setEdits((e) => ({ ...e, ...p, ...(p.savedId === undefined && !('savedId' in p) ? { savedId: null } : {}) }));
  const pickSaved = (a: SavedAddress) =>
    setEdits((e) => ({
      ...e,
      savedId: a.id,
      city: a.ville,
      cityId: cityIdOf(a.ville),
      commune: a.commune ?? '',
      address: addressText(a),
      ...(a.telephone ? { phone: localPhone(a.telephone) } : {}),
    }));

  const communesQ = useQuery({
    queryKey: qk.communes(form.cityId),
    queryFn: () => fetchGeoItems('commune', form.cityId!),
    enabled: !!form.cityId,
    staleTime: 60 * 60_000,
  });
  const communes = useMemo(() => (communesQ.data ?? []).map((c) => ({ value: c.id, label: c.nom })), [communesQ.data]);

  /* ── Modes de livraison (mêmes règles que le serveur) ── */
  const modes = resolveModes(shops, form.commune || null);
  const [chosenMode, setChosenMode] = useState<DeliveryMode | null>(null);
  const mode: DeliveryMode | null = chosenMode && modes[chosenMode].ok ? chosenMode : (['std', 'lvr', 'relay'] as const).find((m) => modes[m].ok) ?? null;
  const destination = form.commune || form.city;
  const feeQ = useQuery({ queryKey: qk.deliveryFee(destination), queryFn: () => fetchDeliveryFee(destination), enabled: modes.lvr.ok && !!destination });
  const shopCount = Math.max(1, shopIds.length);
  const zoneFee = feeQ.data?.fraisLivraison ?? null;
  const deliveryFee = mode === 'lvr' ? (zoneFee ?? 0) * shopCount : 0;

  /* ── Livreurs et points relais proposés : équipe des boutiques + abonnements ── */
  const drivers: PickActor[] = (() => {
    const m = new Map<string, PickActor>();
    driverQs.forEach((q, i) => {
      const shop = shopQs[i]?.data?.companyName ?? 'la boutique';
      for (const d of q.data ?? []) {
        const cur = m.get(d.id);
        const src = `Livreur de ${shop}`;
        if (cur) cur.sources.push(src);
        else
          m.set(d.id, {
            id: d.id,
            name: d.fullName,
            emoji: d.emoji,
            place: placeOf(d),
            note: d.note,
            activity: `${d.trips} livraison${d.trips > 1 ? 's' : ''}`,
            status: AVAIL[d.availability] ?? { label: 'Hors ligne', color: '#A3A3A3' },
            sources: [src],
          });
      }
    });
    for (const f of followedQ.data?.livreurs ?? []) {
      const cur = m.get(f.id);
      if (cur) cur.sources.push('Vous le suivez');
      else m.set(f.id, { id: f.id, name: f.nom, emoji: f.emoji || '🛵', place: f.categorie || null, note: f.note, sources: ['Vous le suivez'] });
    }
    return [...m.values()];
  })();

  const relays: PickActor[] = (() => {
    const m = new Map<string, PickActor & { city?: string | null }>();
    relayQs.forEach((q, i) => {
      const shop = shopQs[i]?.data?.companyName ?? 'la boutique';
      for (const c of q.data ?? []) {
        const cur = m.get(c.id);
        const src = `Partenaire de ${shop}`;
        if (cur) cur.sources.push(src);
        else
          m.set(c.id, {
            id: c.id,
            name: c.fullName,
            place: placeOf(c),
            city: c.ville,
            note: c.note,
            verified: c.verified,
            activity: `${c.missions} mission${c.missions > 1 ? 's' : ''}`,
            status: c.horaireAujourdhui ? { label: `Ouvert aujourd’hui · ${c.horaireAujourdhui}`, color: Brand.success } : { label: 'Fermé aujourd’hui', color: Brand.danger },
            sources: [src],
          });
      }
    });
    for (const f of followedQ.data?.correspondants ?? []) {
      const cur = m.get(f.id);
      if (cur) cur.sources.push('Vous le suivez');
      else m.set(f.id, { id: f.id, name: f.nom, place: f.categorie || null, note: f.note, sources: ['Vous le suivez'] });
    }
    /* Ceux de la ville de livraison d'abord. */
    const city = form.city ? normCommune(form.city) : null;
    return [...m.values()].sort((a, b) => Number(!!city && normCommune(b.city ?? '') === city) - Number(!!city && normCommune(a.city ?? '') === city));
  })();

  const [driverId, setDriverId] = useState<string | null>(null);
  const [relayId, setRelayId] = useState<string | null>(null);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof AddressForm, string>>>({});

  /* ── Totaux ── */
  const subtotal = items.reduce((s, i) => s + i.prix * i.qty, 0);
  const total = subtotal + deliveryFee;
  const balance = walletQ.data;
  const short = balance != null && balance < total;

  const order = useMutation({
    mutationFn: () =>
      createOrder({
        mode: mode!,
        driverId: driverId ?? undefined,
        relayId: relayId ?? undefined,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        city: form.city,
        commune: form.commune,
        address: form.address,
        instructions: form.instructions,
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: qk.cart });
      void qc.invalidateQueries({ queryKey: qk.profile.orders });
      void qc.invalidateQueries({ queryKey: qk.wallet });
      void qc.invalidateQueries({ queryKey: qk.notifications.all });
      router.replace('/profil');
      Alert.alert(
        'Commande confirmée 🎉',
        shopCount > 1 ? `${shopCount} commandes ont été créées (une par boutique). Le montant a été prélevé sur votre portefeuille.` : 'Votre commande a été créée et le montant prélevé sur votre portefeuille.',
        [{ text: 'Suivre ma commande', onPress: () => openSite(`/commande/${res.id}/suivi`) }, { text: 'OK' }],
      );
    },
    onError: (e) => Alert.alert('Commande impossible', toUserMessage(e)),
  });

  const submit = () => {
    const errs: typeof errors = {};
    if (!form.firstName.trim()) errs.firstName = 'Prénom requis';
    if (!form.lastName.trim()) errs.lastName = 'Nom requis';
    if (form.phone.length !== 9) errs.phone = 'Numéro à 9 chiffres';
    if (!form.city) errs.city = 'Ville requise';
    if (!form.address.trim()) errs.address = 'Indiquez l’adresse précise';
    setErrors(errs);
    const problem = Object.keys(errs).length
      ? 'Complétez l’adresse de livraison.'
      : !mode
        ? 'Aucun mode de livraison n’est accepté par toutes les boutiques du panier.'
        : mode === 'lvr' && !driverId
          ? 'Choisissez un livreur.'
          : mode === 'relay' && !relayId
            ? 'Choisissez un point relais.'
            : walletQ.isPending
              ? 'Vérification du solde en cours…'
              : short
                ? 'Solde du portefeuille insuffisant : rechargez-le pour commander.'
                : !terms
                  ? 'Acceptez les conditions de vente pour continuer.'
                  : null;
    if (problem) return Alert.alert('Commande', problem);
    const message = `${formatPrice(total)} seront prélevés sur votre portefeuille.`;
    /* Sur le web (aperçu), Alert n'affiche rien : boîte de confirmation du navigateur. */
    if (Platform.OS === 'web') {
      if ((globalThis as { confirm?: (m: string) => boolean }).confirm?.(`Confirmer la commande ?\n\n${message}`)) order.mutate();
      return;
    }
    Alert.alert('Confirmer la commande ?', message, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Confirmer', onPress: () => order.mutate() },
    ]);
  };

  /* ── Rendu ── */
  if (!isClient) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <ScreenHeader title="Commande" />
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          La commande est réservée aux comptes clients.
        </ThemedText>
      </SafeAreaView>
    );
  }

  if (cart.isPending || shopsLoading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <ScreenHeader title="Commande" />
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      </SafeAreaView>
    );
  }

  if (cart.error) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <ScreenHeader title="Commande" />
        <ErrorState error={cart.error} onRetry={() => void cart.refetch()} />
      </SafeAreaView>
    );
  }

  if (!items.length) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        <ScreenHeader title="Commande" />
        <View style={styles.empty}>
          <Ionicons name="bag-handle-outline" size={44} color={Brand.primary} />
          <ThemedText style={styles.emptyTitle}>Votre panier est vide</ThemedText>
          <Pressable onPress={() => router.replace('/explorer')} style={styles.primary} accessibilityRole="button">
            <ThemedText style={styles.primaryText}>Explorer les produits</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const stdTitle = modes.stdKind === 'retrait' ? 'Retrait en boutique' : modes.stdKind === 'livraison' ? 'Livraison par la boutique' : 'Par la boutique';
  const stdDesc =
    modes.stdKind === 'retrait'
      ? 'Vous récupérez la commande sur place.'
      : modes.stdKind === 'livraison'
        ? 'La boutique livre elle-même à votre adresse.'
        : 'La boutique livre ou vous récupérez sur place.';
  const blocked = (m: DeliveryMode, verb: string) =>
    modes[m].ok ? null : `${modes[m].blockedBy.join(', ')} ${modes[m].blockedBy.length > 1 ? 'ne proposent' : 'ne propose'} pas ${verb}.`;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Commande" />
      <KeyboardAwareScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        {/* 1. Articles */}
        <Section
          step={1}
          title="Articles"
          subtitle={`${cartCount(items)} article${cartCount(items) > 1 ? 's' : ''} · ${shopIds.length} boutique${shopIds.length > 1 ? 's' : ''}`}
          right={
            <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
              <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                Modifier
              </ThemedText>
            </Pressable>
          }>
          {shopIds.length > 1 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Une commande sera créée pour chaque boutique, livrée séparément.
            </ThemedText>
          ) : null}
          {shopIds.map((id) => {
            const list = items.filter((i) => i.shopId === id);
            return (
              <View key={id} style={styles.shopLine}>
                <Ionicons name="storefront-outline" size={16} color={Brand.primary} />
                <ThemedText numberOfLines={1} style={[styles.flex, styles.bold]}>
                  {list[0]?.shopNom ?? 'Boutique'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {cartCount(list)} art. · {formatPrice(list.reduce((s, i) => s + i.prix * i.qty, 0))}
                </ThemedText>
              </View>
            );
          })}
        </Section>

        {/* 2. Adresse */}
        <Section step={2} title="Adresse de livraison" subtitle="Où et à qui livrer">
          <AddressFormView
            value={form}
            onChange={patch}
            saved={savedQ.data ?? []}
            onPickSaved={pickSaved}
            cities={cities}
            communes={communes}
            loadingCommunes={communesQ.isFetching}
            errors={errors}
          />
        </Section>

        {/* 3. Livraison */}
        <Section step={3} title="Mode de livraison" subtitle="Proposé selon les réglages de chaque boutique">
          <ModeOption
            icon="storefront-outline"
            title={stdTitle}
            description={stdDesc}
            price="Gratuit"
            selected={mode === 'std'}
            disabledReason={blocked('std', 'la livraison ni le retrait pour cette adresse')}
            onPress={() => setChosenMode('std')}
          />
          {modes.std.ok && modes.outOfZone.length && form.commune ? (
            <ThemedText type="small" style={styles.warn}>
              {modes.outOfZone.join(', ')} ne livre pas à {form.commune} : retrait en boutique uniquement.
            </ThemedText>
          ) : null}
          <ModeOption
            icon="bicycle-outline"
            title="Livreur Shoneya"
            description="Choisissez votre livreur : il récupère le colis et vous le remet."
            price={!destination ? 'Selon la zone' : zoneFee == null ? '…' : zoneFee === 0 ? 'Gratuit' : formatPrice(zoneFee * shopCount)}
            selected={mode === 'lvr'}
            disabledReason={blocked('lvr', 'les livreurs Shoneya')}
            onPress={() => setChosenMode('lvr')}
          />
          {mode === 'lvr' ? (
            <View style={styles.picker}>
              <ThemedText style={styles.pickTitle}>Choisissez votre livreur</ThemedText>
              {drivers.length ? (
                drivers.map((d) => <ActorOption key={d.id} actor={d} selected={driverId === d.id} onPress={() => setDriverId(d.id)} />)
              ) : (
                <PickerEmpty
                  text="Aucun livreur disponible : ces boutiques n’en ont pas encore et vous n’en suivez aucun."
                  action="Voir les livreurs"
                  onPress={() => router.push('/livreurs')}
                />
              )}
            </View>
          ) : null}
          <ModeOption
            icon="location-outline"
            title="Point relais (correspondant)"
            description="Un correspondant réceptionne le colis, vérifie son état et le garde pour vous."
            price="Gratuit"
            selected={mode === 'relay'}
            disabledReason={blocked('relay', 'les points relais')}
            onPress={() => setChosenMode('relay')}
          />
          {mode === 'relay' ? (
            <View style={styles.picker}>
              <ThemedText style={styles.pickTitle}>Choisissez votre point relais</ThemedText>
              {relays.length ? (
                relays.map((r) => <ActorOption key={r.id} actor={r} selected={relayId === r.id} onPress={() => setRelayId(r.id)} />)
              ) : (
                <PickerEmpty
                  text="Aucun point relais disponible : ces boutiques n’en ont pas encore et vous n’en suivez aucun."
                  action="Voir les points relais"
                  onPress={() => router.push('/correspondants')}
                />
              )}
            </View>
          ) : null}
        </Section>

        {/* 4. Paiement */}
        <Section step={4} title="Paiement" subtitle="Prélevé sur votre portefeuille Shoneya">
          <View style={[styles.wallet, { backgroundColor: short ? '#FDECEC' : theme.backgroundElement }]}>
            <Ionicons name="wallet-outline" size={20} color={short ? Brand.danger : Brand.success} />
            <View style={styles.flex}>
              <ThemedText type="small" themeColor="textSecondary">
                Solde disponible
              </ThemedText>
              <ThemedText style={[styles.bold, { color: short ? Brand.danger : Brand.success }]}>{walletQ.isPending ? 'Chargement…' : balance != null ? formatPrice(balance) : '—'}</ThemedText>
              {short ? (
                <ThemedText type="small" style={{ color: Brand.danger }}>
                  Il manque {formatPrice(total - (balance ?? 0))}.
                </ThemedText>
              ) : null}
            </View>
            {short ? (
              <Pressable onPress={() => openSite('/dashboard/client')} hitSlop={6} accessibilityRole="button">
                <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                  Recharger
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
          <Line label={`Articles (${cartCount(items)})`} value={formatPrice(subtotal)} />
          <Line
            label={mode === 'lvr' && shopCount > 1 ? `Livraison (${shopCount} boutiques)` : 'Livraison'}
            value={mode === 'lvr' ? (zoneFee == null ? (destination ? '…' : 'Selon la zone') : deliveryFee === 0 ? 'Gratuit' : formatPrice(deliveryFee)) : 'Gratuit'}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.rowBetween}>
            <ThemedText style={styles.totalLabel}>Total</ThemedText>
            <ThemedText style={styles.totalValue}>{formatPrice(total)}</ThemedText>
          </View>
          <Pressable onPress={() => setTerms(!terms)} style={styles.terms} accessibilityRole="checkbox" accessibilityState={{ checked: terms }}>
            <Ionicons name={terms ? 'checkbox' : 'square-outline'} size={22} color={terms ? Brand.primary : theme.textSecondary} />
            <ThemedText type="small" style={styles.flex}>
              J’accepte les conditions de vente et la{' '}
              <ThemedText type="smallBold" style={{ color: Brand.primary }} onPress={() => openSite('/politique-retour')}>
                politique de retour
              </ThemedText>
              . Le montant total sera débité de mon portefeuille.
            </ThemedText>
          </Pressable>
        </Section>
      </KeyboardAwareScrollView>

      <View style={[styles.bar, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
        <View style={styles.flex}>
          <ThemedText type="small" themeColor="textSecondary">
            Total à payer
          </ThemedText>
          <ThemedText style={styles.barTotal}>{formatPrice(total)}</ThemedText>
        </View>
        <Pressable onPress={submit} disabled={order.isPending} style={[styles.primary, order.isPending && styles.dim]} accessibilityRole="button" accessibilityLabel={`Confirmer la commande, ${formatPrice(total)}`}>
          {order.isPending ? <ActivityIndicator color={Brand.primaryInk} /> : <Ionicons name="lock-closed" size={16} color={Brand.primaryInk} />}
          <ThemedText style={styles.primaryText}>Confirmer</ThemedText>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rowBetween}>
      <ThemedText themeColor="textSecondary">{label}</ThemedText>
      <ThemedText style={[styles.bold, value === 'Gratuit' && { color: Brand.success }]}>{value}</ThemedText>
    </View>
  );
}

function PickerEmpty({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.pickEmpty, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {text}
      </ThemedText>
      <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button">
        <ThemedText type="smallBold" style={{ color: Brand.primary }}>
          {action} →
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  dim: { opacity: 0.6 },
  loader: { marginTop: 60 },
  centerText: { textAlign: 'center', padding: 24 },
  scroll: { padding: 16, gap: 14, paddingBottom: 28 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  shopLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  warn: { color: '#D97706', marginTop: -4 },
  picker: { gap: 8, marginLeft: 8, paddingLeft: 10, borderLeftWidth: 2, borderLeftColor: Brand.primary },
  pickTitle: { fontSize: 13, lineHeight: 17, fontWeight: '800' },
  pickEmpty: { borderRadius: 12, padding: 12, gap: 6 },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12 },
  divider: { height: StyleSheet.hairlineWidth },
  totalLabel: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  totalValue: { fontSize: 20, lineHeight: 26, fontWeight: '900', color: Brand.primary },
  terms: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 4 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth },
  barTotal: { fontSize: 19, lineHeight: 24, fontWeight: '900' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine, borderRadius: 999, paddingHorizontal: 22, minHeight: 50 },
  primaryText: { color: Brand.primaryInk, fontSize: 16, lineHeight: 21, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 12, paddingTop: 60, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, lineHeight: 24, fontWeight: '900' },
});
