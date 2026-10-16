/**
 * Recharger mon portefeuille (client) — /portefeuille/recharger
 *   1. Montant : saisie libre (espaces automatiques) ou raccourcis ;
 *   2. Moyen de paiement : Orange Money, MTN Money, Kulu, PayCard, carte ;
 *   3. Numéro à débiter (Mobile Money), repris des moyens déjà enregistrés ;
 *   4. Récapitulatif : solde actuel → solde après recharge.
 *
 * Le bouton « Déposer » est GRISÉ : aucun prestataire de paiement réel n'est
 * encore branché à Shoneya, et le serveur refuse tout dépôt (POST
 * /wallet/deposit → 503) pour qu'aucun solde ne soit crédité sans argent reçu.
 * Le formulaire est prêt : il suffira d'activer le bouton le jour où le
 * paiement mobile sera connecté.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/form';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { Input } from '@/features/settings-kit';
import { useTheme } from '@/hooks/use-theme';
import { qk } from '@/lib/query-keys';

import { fetchWallet, fmt, METHODS, type MethodType } from '../api';

/** Rechargement : pas de virement bancaire ni d'espèces (ce sont des moyens de retrait). */
const RECHARGE_METHODS: MethodType[] = ['orange_money', 'mtn_money', 'kulu', 'paycard', 'card'];
const MOBILE: MethodType[] = ['orange_money', 'mtn_money', 'kulu'];
const CHIPS = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000];
const MIN = 1_000;
const MAX = 10_000_000;

/** Préfixes guinéens par opérateur (aide à repérer une erreur de numéro, sans bloquer). */
const PREFIX_HINT: Partial<Record<MethodType, RegExp>> = { orange_money: /^6(1|2)/, mtn_money: /^66/ };

const digits = (s: string) => s.replace(/\D/g, '');

export default function RechargeScreen() {
  const theme = useTheme();
  const summary = useQuery({ queryKey: qk.walletPage.summary, queryFn: fetchWallet });
  const [raw, setRaw] = useState('');
  const [method, setMethod] = useState<MethodType>('orange_money');
  const [phoneEdits, setPhoneEdits] = useState<Partial<Record<MethodType, string>>>({});

  const amount = Number(digits(raw) || 0);
  const balance = summary.data?.balance;

  /* Numéro déjà enregistré pour ce moyen (le défaut d'abord) : proposé tout de suite. */
  const savedPhone = useMemo(() => {
    const list = (summary.data?.paymentMethods ?? []).filter((m) => m.type === method);
    const m = list.find((x) => x.isDefault) ?? list[0];
    const d = digits(m?.number ?? '');
    return d.startsWith('224') ? d.slice(3, 12) : d.slice(0, 9);
  }, [summary.data, method]);
  const phone = phoneEdits[method] ?? savedPhone;
  const isMobile = MOBILE.includes(method);

  const amountError = raw && amount < MIN ? `Minimum ${fmt(MIN)} GNF.` : amount > MAX ? `Maximum ${fmt(MAX)} GNF par recharge.` : null;
  const phoneError = isMobile && phone && phone.length !== 9 ? 'Le numéro guinéen compte 9 chiffres.' : null;
  const phoneWarn = isMobile && phone.length === 9 && PREFIX_HINT[method] && !PREFIX_HINT[method]!.test(phone) ? `Vérifiez : ce numéro ne ressemble pas à un numéro ${METHODS[method].label}.` : null;
  const ready = amount >= MIN && amount <= MAX && (!isMobile || phone.length === 9);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
      <ScreenHeader title="Recharger mon portefeuille" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* ── Solde actuel ── */}
          <View style={styles.balance}>
            <Ionicons name="wallet" size={20} color="rgba(255,255,255,0.85)" />
            <View style={styles.flex}>
              <ThemedText style={styles.balLabel}>Solde actuel</ThemedText>
              <ThemedText style={styles.balValue}>{balance == null ? '…' : `${fmt(balance)} GNF`}</ThemedText>
            </View>
          </View>

          {/* ── 1. Montant ── */}
          <Step n={1} title="Montant à ajouter">
            <View style={[styles.amountBox, { borderColor: amountError ? Brand.danger : theme.border, backgroundColor: theme.backgroundElement }]}>
              <TextInput
                value={amount ? fmt(amount) : ''}
                onChangeText={(v) => setRaw(digits(v).slice(0, 9))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
                style={[styles.amountInput, { color: theme.text }]}
                accessibilityLabel="Montant en francs guinéens"
                maxLength={13}
              />
              <ThemedText style={styles.amountCur}>GNF</ThemedText>
            </View>
            {amountError ? (
              <ThemedText type="small" style={styles.err} accessibilityRole="alert">
                {amountError}
              </ThemedText>
            ) : null}
            <View style={styles.chips}>
              {CHIPS.map((c) => {
                const on = amount === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setRaw(String(c))}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.chip, { borderColor: on ? Brand.primary : theme.border, backgroundColor: on ? Brand.primarySoft : theme.background }]}>
                    <ThemedText style={[styles.chipText, on && { color: Brand.primary }]}>{fmt(c)}</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </Step>

          {/* ── 2. Moyen de paiement ── */}
          <Step n={2} title="Payer avec">
            <View style={[styles.methods, { borderColor: theme.border }]}>
              {RECHARGE_METHODS.map((m, i) => {
                const meta = METHODS[m];
                const on = method === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setMethod(m)}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    style={[styles.method, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }, on && { backgroundColor: theme.backgroundElement }]}>
                    <View style={[styles.logo, { backgroundColor: meta.color }]}>
                      {meta.badge ? <ThemedText style={styles.logoText}>{meta.badge}</ThemedText> : <Ionicons name={meta.icon ?? 'wallet-outline'} size={18} color="#fff" />}
                    </View>
                    <View style={styles.flex}>
                      <ThemedText style={styles.methodLabel}>{meta.label}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {MOBILE.includes(m) ? 'Validation sur votre téléphone' : 'Page de paiement sécurisée du prestataire'}
                      </ThemedText>
                    </View>
                    <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? Brand.primary : theme.textSecondary} />
                  </Pressable>
                );
              })}
            </View>
          </Step>

          {/* ── 3. Numéro / carte ── */}
          <Step n={3} title={isMobile ? `Numéro ${METHODS[method].label}` : 'Carte'}>
            {isMobile ? (
              <Input
                label="Numéro à débiter"
                value={phone}
                onChangeText={(v) => setPhoneEdits((p) => ({ ...p, [method]: digits(v).slice(0, 9) }))}
                keyboardType="phone-pad"
                placeholder="620 00 00 00"
                error={phoneError}
                hint={phoneWarn ?? 'Vous confirmerez le paiement avec votre code secret, sur votre téléphone.'}
                left={<ThemedText style={styles.dial}>🇬🇳 +224</ThemedText>}
              />
            ) : (
              <View style={[styles.info, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="lock-closed-outline" size={16} color={Brand.primary} />
                <ThemedText type="small" style={styles.flex}>
                  Les informations de la carte se saisissent sur la page sécurisée du prestataire de paiement : Shoneya ne les voit ni ne les garde.
                </ThemedText>
              </View>
            )}
          </Step>

          {/* ── Récapitulatif ── */}
          <View style={[styles.recap, { borderColor: theme.border }]}>
            <Line label="Montant ajouté" value={amount ? `+ ${fmt(amount)} GNF` : '—'} />
            <Line label="Moyen" value={METHODS[method].label} />
            {balance != null ? <Line label="Solde après recharge" value={`${fmt(balance + (ready ? amount : 0))} GNF`} strong /> : null}
          </View>

          <View style={styles.notice} accessibilityRole="alert">
            <Ionicons name="time-outline" size={18} color="#B45309" />
            <View style={styles.flex}>
              <ThemedText style={styles.noticeTitle}>Recharge bientôt disponible</ThemedText>
              <ThemedText type="small" style={styles.noticeText}>
                Le paiement mobile n’est pas encore connecté à Shoneya. Le dépôt reste désactivé tant qu’il ne l’est pas : vous ne pouvez pas être débité sans que votre solde soit crédité.
              </ThemedText>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}>
          <PrimaryButton title={amount ? `Déposer ${fmt(amount)} GNF` : 'Déposer'} onPress={() => undefined} disabled pill />
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            Dépôt indisponible pour le moment
          </ThemedText>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepHead}>
        <View style={styles.stepNum}>
          <ThemedText style={styles.stepNumText}>{n}</ThemedText>
        </View>
        <ThemedText style={styles.stepTitle}>{title}</ThemedText>
      </View>
      {children}
    </View>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.line}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
        {label}
      </ThemedText>
      <ThemedText style={[styles.lineV, strong && styles.lineStrong]}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  content: { padding: Spacing.three, gap: 18, paddingBottom: 140 },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#1F1F1F', borderRadius: 18, padding: 16 },
  balLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12.5, lineHeight: 17, fontWeight: '700' },
  balValue: { color: '#fff', fontSize: 22, lineHeight: 28, fontWeight: '900' },
  step: { gap: 10 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  stepTitle: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  amountBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 16, minHeight: 68 },
  amountInput: { flex: 1, fontSize: 30, fontWeight: '900', paddingVertical: 8 },
  amountCur: { fontSize: 16, lineHeight: 21, fontWeight: '800', opacity: 0.6 },
  err: { color: Brand.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, minHeight: 38, justifyContent: 'center' },
  chipText: { fontSize: 13.5, lineHeight: 18, fontWeight: '800' },
  methods: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  method: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 62, paddingVertical: 8 },
  logo: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#fff', fontSize: 13, lineHeight: 17, fontWeight: '900' },
  methodLabel: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  dial: { fontSize: 14, lineHeight: 19, fontWeight: '700', paddingLeft: 12 },
  info: { flexDirection: 'row', gap: 8, borderRadius: 12, padding: 12, alignItems: 'flex-start' },
  recap: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lineV: { fontSize: 14, lineHeight: 19, fontWeight: '700' },
  lineStrong: { fontSize: 15.5, fontWeight: '900' },
  notice: { flexDirection: 'row', gap: 10, borderRadius: 14, padding: 14, backgroundColor: '#B4530914', alignItems: 'flex-start' },
  noticeTitle: { color: '#B45309', fontSize: 14.5, lineHeight: 19, fontWeight: '800' },
  noticeText: { color: '#92400E' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.three, paddingTop: 10, paddingBottom: 12, gap: 4, borderTopWidth: StyleSheet.hairlineWidth },
});
