/**
 * Fenêtres de la bascule de compte :
 *   AccountsSheet — « Vos comptes » (chevron) : compte actuel ✓, compte lié
 *                   (Basculer) ou proposition de créer / lier l'espace client,
 *                   notifications non lues ;
 *   SetupSheet    — compte pro sans compte client lié : créer l'espace client
 *                   (nouveau mot de passe, mêmes règles que le serveur) ou lier
 *                   le compte client existant (son mot de passe — 5 essais
 *                   avant verrouillage, comme /auth/login) ;
 *   CodeSheet     — code de double authentification du compte cible.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { initials } from '@/components/catalog';
import { Field, PasswordField, PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { isStrongPassword, PASSWORD_RULES } from '@/features/auth/password-rules';
import { useSession } from '@/features/auth/session-store';
import { toUserMessage } from '@/lib/api/errors';

import { createLinkedClient, linkExistingClient, SPACE_ICON, SPACE_LABEL, type LinkStatus } from './api';
import type { useAccountSwitch } from './use-account-switch';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type Switcher = ReturnType<typeof useAccountSwitch>;

/** Prénom / nom de personne : lettres (accents et arabe compris), espaces, tirets, apostrophes. */
const NAME_OK = /^[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F\u1E00-\u1EFF\u0600-\u06FF][A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F\u1E00-\u1EFF\u0600-\u06FF '’.-]{1,49}$/;
const cleanName = (v: string) => v.trim().replace(/\s+/g, ' ');

function SpaceAvatar({ role, size = 44 }: { role: string; size?: number }) {
  return (
    <View style={[styles.spaceAv, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name={(SPACE_ICON[role] ?? 'person') as IconName} size={size * 0.45} color="#fff" />
    </View>
  );
}

export function AccountsSheet({
  fullName,
  avatarUri,
  role,
  isPro,
  status,
  unread,
  busy,
  error,
  onClose,
  onSwitch,
  onSetup,
  onNotifications,
}: {
  fullName: string;
  avatarUri?: string | null;
  role: string;
  isPro: boolean;
  status?: LinkStatus;
  unread: number;
  busy: boolean;
  error: unknown;
  onClose: () => void;
  onSwitch: () => void;
  onSetup: () => void;
  onNotifications?: () => void;
}) {
  const linked = !!status?.linked;
  const otherRole = status?.otherRole ?? (isPro ? 'client' : 'company');
  return (
    <BottomSheet title="Vos comptes" onClose={onClose}>
      <View style={styles.body}>
        {/* Compte actuel */}
        <View style={[styles.acc, styles.accOn]}>
          <View style={styles.av}>
            {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.img} contentFit="cover" /> : <ThemedText style={styles.init}>{initials(fullName)}</ThemedText>}
          </View>
          <View style={styles.flex}>
            <ThemedText style={styles.accName} numberOfLines={1}>
              {fullName}
            </ThemedText>
            <ThemedText style={styles.accSub}>{SPACE_LABEL[role] ?? role} · connecté</ThemedText>
          </View>
          <Ionicons name="checkmark-circle" size={24} color="#1F1F1F" />
        </View>

        {/* Compte lié — ou proposition */}
        {linked ? (
          <Pressable onPress={onSwitch} disabled={busy} accessibilityRole="button" style={({ pressed }) => [styles.acc, pressed && styles.pressed]}>
            <SpaceAvatar role={otherRole} />
            <View style={styles.flex}>
              <ThemedText style={styles.accName}>{SPACE_LABEL[otherRole] ?? otherRole}</ThemedText>
              <ThemedText style={styles.accSub}>Compte lié · même identité</ThemedText>
            </View>
            <View style={styles.switchBtn}>
              {busy ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="sync" size={15} color="#fff" />}
              <ThemedText style={styles.switchT}>Basculer</ThemedText>
            </View>
          </Pressable>
        ) : isPro && status ? (
          <Pressable onPress={onSetup} accessibilityRole="button" style={({ pressed }) => [styles.acc, styles.accDashed, pressed && styles.pressed]}>
            <View style={styles.addAv}>
              <Ionicons name="add" size={22} color="#1F1F1F" />
            </View>
            <View style={styles.flex}>
              <ThemedText style={styles.accName}>{status.existingClientFound ? 'Lier mon compte client' : 'Créer mon espace client'}</ThemedText>
              <ThemedText style={styles.accSub}>
                {status.existingClientFound ? 'Un compte client utilise déjà vos coordonnées' : 'Acheter sur Shoneya sans quitter votre compte'}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8A8A8A" />
          </Pressable>
        ) : null}

        {error ? <ThemedText style={styles.err}>{toUserMessage(error)}</ThemedText> : null}

        {onNotifications ? (
          <Pressable onPress={onNotifications} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <View style={styles.rowIc}>
              <Ionicons name="notifications-outline" size={19} color="#1F1F1F" />
            </View>
            <ThemedText style={[styles.flex, styles.rowT]}>Notifications</ThemedText>
            {unread > 0 ? (
              <View style={styles.count}>
                <ThemedText style={styles.countT}>{unread > 99 ? '99+' : unread}</ThemedText>
              </View>
            ) : (
              <ThemedText style={styles.accSub}>À jour</ThemedText>
            )}
            <Ionicons name="chevron-forward" size={16} color="#8A8A8A" />
          </Pressable>
        ) : null}

        {linked || isPro ? (
          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={16} color="#6B6B6B" />
            <ThemedText style={[styles.flex, styles.noteT]}>
              Deux comptes distincts : commandes, portefeuille et mot de passe restent séparés. Touchez les flèches pour passer de l’un à l’autre.
            </ThemedText>
          </View>
        ) : null}
      </View>
    </BottomSheet>
  );
}

export function SetupSheet({ existing, matchedBy, sw, onClose }: { existing: boolean; matchedBy?: 'email' | 'phone'; sw: Switcher; onClose: () => void }) {
  const user = useSession((s) => s.user);
  /* Entreprise : le compte pro porte le nom de la boutique (pas de nom de
   * famille) → champs vides, la personne saisit son vrai prénom et nom. */
  const prefill = !!user && (user.role !== 'company' || !!user.lastName);
  const [firstName, setFirstName] = useState(prefill ? user?.firstName ?? '' : '');
  const [lastName, setLastName] = useState(prefill ? user?.lastName ?? '' : '');
  const [pwd, setPwd] = useState('');
  const [confirm, setConfirm] = useState('');
  const [tried, setTried] = useState(false);

  if (existing) {
    const submit = () => {
      setTried(true);
      if (pwd) void sw.run(() => linkExistingClient(pwd));
    };
    return (
      <BottomSheet title="Lier mon compte client" onClose={onClose}>
        <View style={styles.body}>
          <View style={styles.hero}>
            <SpaceAvatar role="client" size={52} />
            <ThemedText style={styles.heroT}>
              Un compte client utilise déjà votre {matchedBy === 'phone' ? 'numéro de téléphone' : 'adresse e-mail'}. Saisissez son mot de passe pour prouver qu’il vous appartient.
            </ThemedText>
          </View>
          <PasswordField
            label="Mot de passe du compte client"
            value={pwd}
            onChangeText={(v) => {
              setPwd(v);
              sw.clearError();
            }}
            placeholder="Mot de passe"
            onSubmitEditing={submit}
            error={tried && !pwd ? 'Saisissez le mot de passe.' : null}
          />
          {sw.error ? <ThemedText style={styles.err}>{toUserMessage(sw.error)}</ThemedText> : null}
          <PrimaryButton title="Lier et ouvrir mon espace client" onPress={submit} loading={sw.busy} pill />
          <ThemedText style={styles.fine}>Après 5 essais incorrects, le compte client est verrouillé quelques minutes. La liaison n’est jamais automatique.</ThemedText>
        </View>
      </BottomSheet>
    );
  }

  const strong = isStrongPassword(pwd);
  const same = pwd === confirm;
  const fn = cleanName(firstName);
  const ln = cleanName(lastName);
  const fnOk = NAME_OK.test(fn);
  const lnOk = NAME_OK.test(ln);
  const submit = () => {
    setTried(true);
    if (strong && same && fnOk && lnOk) void sw.run(() => createLinkedClient(pwd, { firstName: fn, lastName: ln }));
  };
  return (
    <BottomSheet title="Créer mon espace client" onClose={onClose} height={0.88}>
      <ScrollView style={styles.flex} contentContainerStyle={[styles.body, styles.scrollPad]} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <SpaceAvatar role="client" size={52} />
          <ThemedText style={styles.heroT}>Achetez sur Shoneya avec votre identité, sans mélanger vos achats et votre activité professionnelle.</ThemedText>
        </View>
        {[
          ['person-outline', 'Votre prénom et votre nom (pas celui de la boutique), même e-mail et téléphone'],
          ['wallet-outline', 'Commandes, favoris et portefeuille propres au compte client'],
          ['sync-outline', 'Passage d’un espace à l’autre en un geste, sans se reconnecter'],
        ].map(([ic, t]) => (
          <View key={t} style={styles.benefit}>
            <Ionicons name={ic as IconName} size={17} color="#1F1F1F" />
            <ThemedText style={[styles.flex, styles.benefitT]}>{t}</ThemedText>
          </View>
        ))}
        <Field
          label="Prénom"
          value={firstName}
          onChangeText={(v) => {
            setFirstName(v);
            sw.clearError();
          }}
          placeholder="Ex. : Mamadou"
          autoCapitalize="words"
          autoComplete="given-name"
          maxLength={50}
          error={tried && !fnOk ? 'Saisissez votre prénom (au moins 2 lettres, sans chiffres).' : null}
        />
        <Field
          label="Nom"
          value={lastName}
          onChangeText={(v) => {
            setLastName(v);
            sw.clearError();
          }}
          placeholder="Ex. : Camara"
          autoCapitalize="words"
          autoComplete="family-name"
          maxLength={50}
          error={tried && !lnOk ? 'Saisissez votre nom (au moins 2 lettres, sans chiffres).' : null}
        />
        <PasswordField
          label="Mot de passe du compte client"
          value={pwd}
          onChangeText={(v) => {
            setPwd(v);
            sw.clearError();
          }}
          placeholder="Nouveau mot de passe"
          error={tried && !strong ? 'Le mot de passe ne respecte pas toutes les règles.' : null}
        />
        <View style={styles.rules}>
          {PASSWORD_RULES.map((r) => {
            const ok = r.test(pwd);
            return (
              <View key={r.label} style={styles.rule}>
                <Ionicons name={ok ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={ok ? Brand.success : '#A3A3A3'} />
                <ThemedText style={[styles.ruleT, ok && styles.ruleOk]}>{r.label}</ThemedText>
              </View>
            );
          })}
        </View>
        <PasswordField
          label="Confirmer le mot de passe"
          value={confirm}
          onChangeText={setConfirm}
          placeholder="Confirmer"
          onSubmitEditing={submit}
          error={tried && !same ? 'Les deux mots de passe sont différents.' : null}
        />
        <ThemedText style={styles.fine}>Ce mot de passe est indépendant de celui de votre compte professionnel.</ThemedText>
        {sw.error ? <ThemedText style={styles.err}>{toUserMessage(sw.error)}</ThemedText> : null}
        <PrimaryButton title="Créer et ouvrir mon espace client" onPress={submit} loading={sw.busy} pill />
      </ScrollView>
    </BottomSheet>
  );
}

export function CodeSheet({ sw }: { sw: Switcher }) {
  const [code, setCode] = useState('');
  const ok = /^\d{6}$/.test(code.trim()) || code.trim().length >= 8;
  return (
    <BottomSheet title="Vérification en deux étapes" onClose={sw.cancelCode}>
      <View style={styles.body}>
        <View style={styles.hero}>
          <View style={styles.lock}>
            <Ionicons name="shield-checkmark" size={26} color="#1F1F1F" />
          </View>
          <ThemedText style={styles.heroT}>Ce compte est protégé. Saisissez le code à 6 chiffres de votre application d’authentification (ou un code de secours).</ThemedText>
        </View>
        <Field
          value={code}
          onChangeText={(v) => {
            setCode(v.replace(/\s/g, '').slice(0, 12));
            sw.clearError();
          }}
          placeholder="123456"
          keyboardType="number-pad"
          autoFocus
          maxLength={12}
          style={styles.code}
          accessibilityLabel="Code de vérification"
          onSubmitEditing={() => ok && void sw.submitCode(code)}
        />
        {sw.error ? <ThemedText style={styles.err}>{toUserMessage(sw.error)}</ThemedText> : null}
        <PrimaryButton title="Vérifier et basculer" onPress={() => void sw.submitCode(code)} loading={sw.busy} disabled={!ok} pill />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: { padding: 16, paddingTop: 4, gap: 12 },
  scrollPad: { paddingBottom: 28 },
  pressed: { opacity: 0.65 },
  acc: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: '#E8E8E8', backgroundColor: '#FFFFFF' },
  accOn: { backgroundColor: 'rgba(0,0,0,0.04)', borderColor: 'rgba(0,0,0,0.12)' },
  accDashed: { borderStyle: 'dashed', borderColor: '#BDBDBD' },
  av: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E5E5' },
  img: { width: '100%', height: '100%' },
  init: { fontSize: 16, lineHeight: 21, fontWeight: '900', color: '#1F1F1F' },
  spaceAv: { backgroundColor: '#1F1F1F', alignItems: 'center', justifyContent: 'center' },
  addAv: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F1F1', alignItems: 'center', justifyContent: 'center' },
  accName: { fontSize: 15.5, lineHeight: 20, fontWeight: '900', color: '#1F1F1F' },
  accSub: { fontSize: 12.5, lineHeight: 17, fontWeight: '600', color: '#6B6B6B' },
  switchBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#1F1F1F', borderRadius: 999, paddingHorizontal: 12, height: 34 },
  switchT: { color: '#fff', fontSize: 13, lineHeight: 17, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  rowIc: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#F6F6F6', alignItems: 'center', justifyContent: 'center' },
  rowT: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  count: { minWidth: 24, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: Brand.danger, alignItems: 'center', justifyContent: 'center' },
  countT: { color: '#fff', fontSize: 11.5, lineHeight: 14, fontWeight: '900' },
  note: { flexDirection: 'row', gap: 8, backgroundColor: '#F6F6F6', borderRadius: 14, padding: 12 },
  noteT: { fontSize: 12.5, lineHeight: 18, color: '#6B6B6B' },
  err: { color: Brand.danger, fontSize: 13.5, lineHeight: 18, fontWeight: '600', textAlign: 'center' },
  hero: { alignItems: 'center', gap: 10, paddingVertical: 4 },
  heroT: { textAlign: 'center', fontSize: 14, lineHeight: 20, color: '#525252' },
  lock: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitT: { fontSize: 13.5, lineHeight: 19, color: '#1F1F1F' },
  rules: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -4 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ruleT: { fontSize: 12, lineHeight: 16, color: '#8A8A8A' },
  ruleOk: { color: Brand.success },
  fine: { fontSize: 12, lineHeight: 17, color: '#8A8A8A', textAlign: 'center' },
  code: { fontSize: 22, letterSpacing: 6, textAlign: 'center', fontWeight: '800' },
});
