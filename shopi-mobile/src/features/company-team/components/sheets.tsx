/**
 * Feuilles du bas de la gestion d'équipe (équivalents des panneaux et modales du site) :
 *   · MemberSheet       fiche + actions d'un membre (permissions, journal, MDP, suspendre/réactiver, supprimer)
 *   · PermissionsSheet  interrupteurs par groupe, chaque case enregistrée aussitôt (+ appliquer un modèle)
 *   · ActivitySheet     journal d'activité (30 dernières entrées)
 *   · AddMemberSheet    création directe (MDP temporaire) ou lien d'invitation
 *   · SecretSheet       MDP temporaire / lien d'invitation affiché UNE fois (copier, partager)
 *   · ConfirmSheet      confirmation (suspendre avec motif facultatif, supprimer, annuler une invitation)
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Chips, Field, PrimaryButton } from '@/components/form';
import { ThemedText } from '@/components/themed-text';
import { Brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toUserMessage } from '@/lib/api/errors';
import { qk } from '@/lib/query-keys';

import {
  activityLabel,
  applyTemplate,
  countGranted,
  createInvitation,
  createMember,
  fetchActivity,
  fetchMember,
  fetchTemplates,
  formatDate,
  fullName,
  isEmail,
  lastSeen,
  roleLabel,
  ROLES,
  setPermissions,
  type PermGroup,
  type Permissions,
  type TeamMember,
} from '../api';
import { Avatar, Sheet, StatusPill } from './ui';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/* ══════════════ Fiche + actions d'un membre ══════════════ */

export function MemberSheet({
  m,
  isOwner,
  groups,
  onClose,
  onPermissions,
  onActivity,
  onResetPassword,
  onSuspend,
  onReactivate,
  onDelete,
  busy,
}: {
  m: TeamMember;
  isOwner: boolean;
  groups: PermGroup[];
  onClose: () => void;
  onPermissions: () => void;
  onActivity: () => void;
  onResetPassword: () => void;
  onSuspend: () => void;
  onReactivate: () => void;
  onDelete: () => void;
  busy: string | null;
}) {
  const theme = useTheme();
  const g = countGranted(m.permissions, groups);
  const role = roleLabel(m.internalRole);
  return (
    <Sheet title={fullName(m)} subtitle={m.email} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.idCard, { backgroundColor: theme.backgroundElement }]}>
          <Avatar m={m} size={56} status={m.status} />
          <View style={styles.flex}>
            <StatusPill status={m.status} />
            <ThemedText style={styles.idJob} numberOfLines={1}>
              {m.jobTitle ?? 'Poste non renseigné'}
            </ThemedText>
            {role ? (
              <ThemedText type="small" style={{ color: Brand.primaryInk, fontWeight: '700' }}>
                {role}
              </ThemedText>
            ) : null}
          </View>
        </View>
        <Info icon="time-outline" label="Dernière connexion" value={lastSeen(m.lastLoginAt)} />
        <Info icon="calendar-outline" label="Membre depuis" value={formatDate(m.createdAt)} />
        {m.phone ? <Info icon="call-outline" label="Téléphone" value={m.phone} /> : null}
        <Info icon="shield-half-outline" label="Autorisations" value={`${g.on} sur ${g.total}`} />
        {m.mustChangePassword ? <Info icon="warning-outline" label="Mot de passe" value="Doit être changé à la prochaine connexion" warn /> : null}
        {m.status === 'suspended' && m.suspensionReason ? <Info icon="ban-outline" label="Motif de suspension" value={m.suspensionReason} warn /> : null}

        <View style={styles.actions}>
          {isOwner ? <Action icon="shield-half-outline" label="Modifier les permissions" onPress={onPermissions} accent /> : null}
          <Action icon="time-outline" label="Journal d’activité" onPress={onActivity} />
          {isOwner ? (
            <>
              <Action icon="key-outline" label="Réinitialiser le mot de passe" onPress={onResetPassword} loading={busy === 'reset'} />
              {m.status === 'active' ? (
                <Action icon="ban-outline" label="Suspendre" onPress={onSuspend} tone="warn" />
              ) : m.status === 'suspended' ? (
                <Action icon="checkmark-circle-outline" label="Réactiver" onPress={onReactivate} tone="ok" loading={busy === 'reactivate'} />
              ) : null}
              <Action icon="trash-outline" label="Supprimer l’accès" onPress={onDelete} tone="danger" />
            </>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
              Seul le propriétaire de la boutique peut modifier les accès des collaborateurs.
            </ThemedText>
          )}
        </View>
      </ScrollView>
    </Sheet>
  );
}

function Info({ icon, label, value, warn }: { icon: IconName; label: string; value: string; warn?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.info}>
      <Ionicons name={icon} size={17} color={warn ? '#B45309' : theme.textSecondary} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.infoLabel}>
        {label}
      </ThemedText>
      <ThemedText type="small" style={[styles.infoValue, warn && { color: '#B45309' }]}>
        {value}
      </ThemedText>
    </View>
  );
}

function Action({ icon, label, onPress, tone, accent, loading }: { icon: IconName; label: string; onPress: () => void; tone?: 'warn' | 'ok' | 'danger'; accent?: boolean; loading?: boolean }) {
  const theme = useTheme();
  const color = tone === 'danger' ? Brand.danger : tone === 'warn' ? '#B45309' : tone === 'ok' ? Brand.success : accent ? Brand.primaryInk : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.action,
        accent ? { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryLine } : { borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      {loading ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={20} color={color} />}
      <ThemedText style={[styles.actionText, { color }]}>{label}</ThemedText>
      <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
    </Pressable>
  );
}

/* ══════════════ Permissions ══════════════ */

export function PermissionsSheet({ m, groups, onClose, onError }: { m: TeamMember; groups: PermGroup[]; onClose: () => void; onError: (msg: string) => void }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const [perms, setPerms] = useState<Permissions>(() => JSON.parse(JSON.stringify(m.permissions ?? {})));
  const [pending, setPending] = useState(0);
  const [applying, setApplying] = useState<string | null>(null);
  const [confirmTpl, setConfirmTpl] = useState<{ id: string; name: string } | null>(null);
  /* Envois en file : deux appuis rapides sur la même case partent dans l'ordre. */
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const templates = useQuery({ queryKey: qk.company.teamTemplates, queryFn: fetchTemplates, staleTime: 10 * 60_000 });

  /* Optimiste : les cases basculent tout de suite, et reviennent en arrière si l'envoi échoue. */
  const save = (group: string, changes: Record<string, boolean>) => {
    const prev = Object.fromEntries(Object.keys(changes).map((k) => [k, perms[group]?.[k] ?? false]));
    setPerms((p) => ({ ...p, [group]: { ...(p[group] ?? {}), ...changes } }));
    setPending((n) => n + 1);
    chain.current = chain.current
      .then(() => setPermissions(m.id, group, changes))
      .catch((e: unknown) => {
        setPerms((p) => ({ ...p, [group]: { ...(p[group] ?? {}), ...prev } }));
        onError(toUserMessage(e));
      })
      .finally(() => setPending((n) => n - 1));
  };

  const toggle = (group: string, action: string, value: boolean) => save(group, { [action]: value });

  const setGroup = (g: PermGroup, value: boolean) => {
    const changes = Object.fromEntries(g.actions.filter((a) => (perms[g.key]?.[a.key] ?? false) !== value).map((a) => [a.key, value]));
    if (Object.keys(changes).length) save(g.key, changes);
  };

  const apply = async (id: string) => {
    setConfirmTpl(null);
    setApplying(id);
    try {
      await chain.current;
      await applyTemplate(id, m.id);
      const fresh = await fetchMember(m.id);
      setPerms(fresh.permissions ?? {});
    } catch (e) {
      onError(toUserMessage(e));
    } finally {
      setApplying(null);
    }
  };

  const close = () => {
    void chain.current.finally(() => void qc.invalidateQueries({ queryKey: qk.company.team }));
    onClose();
  };

  const total = countGranted(perms, groups);

  return (
    <Sheet title="Permissions" subtitle={`${fullName(m)} · ${total.on}/${total.total} autorisations`} icon="shield-half-outline" onClose={close} tall busy={pending > 0 || !!applying}>
      <ScrollView contentContainerStyle={styles.body}>
        <ThemedText type="small" themeColor="textSecondary">
          Chaque changement est enregistré immédiatement.
        </ThemedText>

        {templates.data?.length ? (
          <View style={styles.tplBox}>
            <ThemedText type="smallBold">Appliquer un modèle</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tplRow}>
              {templates.data.map((t) => (
                <Pressable
                  key={t.id}
                  onPress={() => setConfirmTpl({ id: t.id, name: t.name })}
                  disabled={!!applying}
                  accessibilityRole="button"
                  accessibilityLabel={`Appliquer le modèle ${t.name}`}
                  style={[styles.tpl, { borderColor: theme.border }]}>
                  {applying === t.id ? <ActivityIndicator size="small" color={Brand.primary} /> : <Ionicons name={t.isSystem ? 'star' : 'layers-outline'} size={14} color={Brand.primary} />}
                  <ThemedText style={styles.tplText}>{t.name}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
            {confirmTpl ? (
              <View style={[styles.tplConfirm, { backgroundColor: theme.backgroundElement }]}>
                <ThemedText type="small" style={styles.flex}>
                  Remplacer toutes les permissions de {m.firstName} par le modèle « {confirmTpl.name} » ?
                </ThemedText>
                <View style={styles.row}>
                  <Pressable onPress={() => setConfirmTpl(null)} accessibilityRole="button" style={styles.smallBtn}>
                    <ThemedText type="smallBold" themeColor="textSecondary">
                      Annuler
                    </ThemedText>
                  </Pressable>
                  <Pressable onPress={() => void apply(confirmTpl.id)} accessibilityRole="button" style={[styles.smallBtn, styles.softBtn]}>
                    <ThemedText type="smallBold" style={{ color: Brand.primaryInk }}>
                      Appliquer
                    </ThemedText>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {groups.map((g) => {
          const allOn = g.actions.every((a) => perms[g.key]?.[a.key]);
          return (
            <View key={g.key} style={[styles.group, { borderColor: theme.border }]}>
              <View style={styles.groupHead}>
                <View style={styles.groupIco}>
                  <Ionicons name={g.icon} size={16} color={Brand.primaryInk} />
                </View>
                <ThemedText style={styles.groupTitle}>{g.label}</ThemedText>
                <Pressable onPress={() => setGroup(g, !allOn)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${allOn ? 'Tout retirer' : 'Tout autoriser'} — ${g.label}`}>
                  <ThemedText type="smallBold" style={{ color: Brand.primary }}>
                    {allOn ? 'Tout retirer' : 'Tout autoriser'}
                  </ThemedText>
                </Pressable>
              </View>
              {g.actions.map((a) => {
                const on = perms[g.key]?.[a.key] ?? false;
                return (
                  <Pressable key={a.key} onPress={() => toggle(g.key, a.key, !on)} style={[styles.permRow, { borderTopColor: theme.border }]} accessibilityRole="switch" accessibilityState={{ checked: on }} accessibilityLabel={`${g.label} : ${a.label}`}>
                    <ThemedText style={styles.flex}>{a.label}</ThemedText>
                    <Switch
                      value={on}
                      onValueChange={(v) => toggle(g.key, a.key, v)}
                      trackColor={{ false: theme.border, true: Brand.primaryLine }}
                      thumbColor={on ? Brand.primary : '#fff'}
                      {...({ activeThumbColor: Brand.primary } as object)}
                    />
                  </Pressable>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <PrimaryButton title="Fermer" onPress={close} pill />
      </View>
    </Sheet>
  );
}

/* ══════════════ Journal d'activité ══════════════ */

export function ActivitySheet({ m, onClose }: { m: TeamMember; onClose: () => void }) {
  const theme = useTheme();
  const q = useQuery({ queryKey: qk.company.teamActivity(m.id), queryFn: () => fetchActivity(m.id) });
  return (
    <Sheet title="Activité récente" subtitle={fullName(m)} icon="time-outline" onClose={onClose} tall>
      {q.isPending ? (
        <ActivityIndicator color={Brand.primary} style={styles.loader} />
      ) : q.isError ? (
        <View style={styles.emptyBox}>
          <ThemedText themeColor="textSecondary" style={styles.center}>
            {toUserMessage(q.error)}
          </ThemedText>
          <Pressable onPress={() => void q.refetch()} accessibilityRole="button">
            <ThemedText type="smallBold" style={{ color: Brand.primary }}>
              Réessayer
            </ThemedText>
          </Pressable>
        </View>
      ) : !q.data.length ? (
        <View style={styles.emptyBox}>
          <Ionicons name="time-outline" size={32} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary">Aucune activité enregistrée.</ThemedText>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {q.data.map((a, i) => (
            <View key={a.id} style={styles.tl}>
              <View style={styles.tlRail}>
                <View style={styles.tlDot} />
                {i < q.data.length - 1 ? <View style={[styles.tlLine, { backgroundColor: theme.border }]} /> : null}
              </View>
              <View style={styles.tlBody}>
                <ThemedText style={styles.tlTitle}>{activityLabel(a.action)}</ThemedText>
                {a.description ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {a.description}
                  </ThemedText>
                ) : null}
                <ThemedText type="small" themeColor="textSecondary">
                  {formatDate(a.createdAt)} · {new Date(a.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </ThemedText>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </Sheet>
  );
}

/* ══════════════ Ajouter un collaborateur ══════════════ */

export type Created = { name: string; secret: string; kind: 'password' | 'inviteLink'; email: string; warning?: string };

export function AddMemberSheet({ site, initialMode = 'direct', onClose, onCreated }: { site: string; initialMode?: 'direct' | 'invite'; onClose: () => void; onCreated: (c: Created) => void }) {
  const theme = useTheme();
  const [mode, setMode] = useState<'direct' | 'invite'>(initialMode);
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', jobTitle: '', internalRole: '' });
  const [templateId, setTemplateId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const templates = useQuery({ queryKey: qk.company.teamTemplates, queryFn: fetchTemplates, staleTime: 10 * 60_000 });
  const set = (k: keyof typeof f) => (v: string) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!f.firstName.trim()) e.firstName = 'Prénom requis';
    if (!f.lastName.trim()) e.lastName = 'Nom requis';
    if (!f.email.trim() || !isEmail(f.email.trim())) e.email = 'Email invalide';
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setError(null);
    const base = {
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      email: f.email.trim().toLowerCase(),
      jobTitle: f.jobTitle.trim() || undefined,
      internalRole: f.internalRole || undefined,
    };
    const name = `${base.firstName} ${base.lastName}`;
    try {
      if (mode === 'invite') {
        const res = await createInvitation({ ...base, templateId: templateId || undefined });
        onCreated({ name, email: base.email, kind: 'inviteLink', secret: res.invitationLink.startsWith('http') ? res.invitationLink : `${site}${res.invitationLink}` });
      } else {
        const res = await createMember({ ...base, phone: f.phone.trim() || undefined }, templateId || undefined);
        onCreated({
          name,
          email: base.email,
          kind: 'password',
          secret: res.temporaryPassword,
          warning: res.templateError ? `Compte créé, mais le modèle n’a pas pu être appliqué (${toUserMessage(res.templateError)}). Réglez ses permissions à la main.` : undefined,
        });
      }
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet title="Ajouter un collaborateur" icon="person-add-outline" onClose={onClose} tall>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={[styles.seg, { backgroundColor: theme.backgroundElement }]} accessibilityRole="tablist">
          {(
            [
              ['direct', 'Création directe', 'person-add-outline'],
              ['invite', 'Lien d’invitation', 'link-outline'],
            ] as const
          ).map(([k, label, icon]) => {
            const on = mode === k;
            return (
              <Pressable key={k} onPress={() => setMode(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[styles.segBtn, on && [styles.segOn, { backgroundColor: theme.background }]]}>
                <Ionicons name={icon} size={16} color={on ? Brand.primaryInk : theme.textSecondary} />
                <ThemedText type="smallBold" style={{ color: on ? Brand.primaryInk : theme.textSecondary }}>
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.row2}>
          <View style={styles.flex}>
            <Field label="Prénom *" value={f.firstName} onChangeText={set('firstName')} placeholder="Marie" error={errors.firstName} autoCapitalize="words" textContentType="givenName" />
          </View>
          <View style={styles.flex}>
            <Field label="Nom *" value={f.lastName} onChangeText={set('lastName')} placeholder="Diallo" error={errors.lastName} autoCapitalize="words" textContentType="familyName" />
          </View>
        </View>
        <Field label="Email professionnel *" value={f.email} onChangeText={set('email')} placeholder="marie.diallo@boutique.com" error={errors.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" />
        {mode === 'direct' ? <Field label="Téléphone" value={f.phone} onChangeText={set('phone')} placeholder="+224 620 000 000" keyboardType="phone-pad" maxLength={20} /> : null}
        <Field label="Poste" value={f.jobTitle} onChangeText={set('jobTitle')} placeholder="Responsable des ventes" maxLength={100} />
        <Chips label="Rôle interne" options={[{ value: '', label: 'Aucun' }, ...ROLES.map((r) => ({ value: r.value as string, label: r.label }))]} value={f.internalRole} onChange={set('internalRole')} />
        {templates.data?.length ? (
          <Chips
            label="Modèle de permissions"
            options={[{ value: '', label: 'Aucun modèle' }, ...templates.data.map((t) => ({ value: t.id, label: `${t.isSystem ? '⭐ ' : ''}${t.name}` }))]}
            value={templateId}
            onChange={setTemplateId}
          />
        ) : null}

        <View style={[styles.noteBox, { backgroundColor: theme.backgroundElement }]}>
          <Ionicons name="information-circle-outline" size={18} color={theme.textSecondary} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
            {mode === 'invite'
              ? 'Un lien d’invitation sera généré — à transmettre vous-même au collaborateur (aucun email automatique pour l’instant). Il choisira son propre mot de passe.'
              : 'Un mot de passe temporaire sera généré et affiché une seule fois.'}
          </ThemedText>
        </View>
        {error ? (
          <ThemedText type="small" style={styles.err} accessibilityRole="alert">
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <PrimaryButton title={mode === 'invite' ? 'Créer le lien d’invitation' : 'Créer le compte'} onPress={() => void submit()} loading={saving} pill />
      </View>
    </Sheet>
  );
}

/* ══════════════ MDP temporaire / lien d'invitation (affiché une fois) ══════════════ */

export function SecretSheet({ c, onClose, onCopied }: { c: Created; onClose: () => void; onCopied: (msg: string) => void }) {
  const theme = useTheme();
  const link = c.kind === 'inviteLink';
  const copy = async () => {
    await Clipboard.setStringAsync(c.secret);
    onCopied(link ? 'Lien copié !' : 'Mot de passe copié !');
  };
  const share = () =>
    void Share.share({
      message: link
        ? `Bonjour ${c.name}, vous êtes invité(e) à rejoindre notre équipe sur Shoneya. Ouvrez ce lien pour créer votre accès : ${c.secret}`
        : `Bonjour ${c.name}, voici votre accès Shoneya.\nEmail : ${c.email}\nMot de passe temporaire : ${c.secret}\nVous devrez le changer à la première connexion.`,
    }).catch(() => undefined);

  return (
    <Sheet title={link ? 'Lien d’invitation créé' : 'Mot de passe temporaire'} icon={link ? 'link-outline' : 'key-outline'} onClose={onClose}>
      <View style={styles.body}>
        <ThemedText themeColor="textSecondary">
          {link ? 'Envoyez ce lien à ' : 'Transmettez ce mot de passe à '}
          <ThemedText style={styles.bold}>{c.name}</ThemedText>.{'\n'}
          {link
            ? 'Aucun email n’est envoyé automatiquement pour l’instant — copiez ce lien et transmettez-le vous-même (WhatsApp, SMS, email…).'
            : 'Il devra le changer à la prochaine connexion.'}
        </ThemedText>
        <View style={[styles.secret, { borderColor: Brand.primaryLine }]}>
          <ThemedText selectable style={[styles.secretText, link && styles.secretLink]}>
            {c.secret}
          </ThemedText>
          <Pressable onPress={() => void copy()} accessibilityRole="button" accessibilityLabel={link ? 'Copier le lien' : 'Copier le mot de passe'} style={styles.copy}>
            <Ionicons name="copy-outline" size={20} color={Brand.primaryInk} />
          </Pressable>
        </View>
        <View style={styles.warnRow}>
          <Ionicons name="warning-outline" size={16} color="#B45309" />
          <ThemedText type="small" style={styles.warnText}>
            {link ? 'Ce lien expire dans 48 heures.' : 'Ce mot de passe ne sera affiché qu’une seule fois.'}
          </ThemedText>
        </View>
        {c.warning ? (
          <ThemedText type="small" style={styles.err}>
            {c.warning}
          </ThemedText>
        ) : null}
        <Pressable onPress={share} accessibilityRole="button" style={[styles.shareBtn, { borderColor: theme.border }]}>
          <Ionicons name="share-social-outline" size={18} color={theme.text} />
          <ThemedText type="smallBold">Partager (WhatsApp, SMS…)</ThemedText>
        </Pressable>
        <PrimaryButton title={link ? 'J’ai copié le lien' : 'J’ai noté le mot de passe'} onPress={onClose} pill />
      </View>
    </Sheet>
  );
}

/* ══════════════ Confirmation ══════════════ */

export function ConfirmSheet({
  title,
  message,
  confirmLabel = 'Confirmer',
  withReason,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  withReason?: boolean;
  onCancel: () => void;
  onConfirm: (reason?: string) => Promise<void>;
}) {
  const theme = useTheme();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim() || undefined);
    } catch (e) {
      setError(toUserMessage(e));
      setBusy(false);
    }
  };
  return (
    <Sheet title={title} icon="warning-outline" onClose={onCancel}>
      <View style={styles.body}>
        <ThemedText themeColor="textSecondary">{message}</ThemedText>
        {withReason ? (
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Motif (facultatif) — visible dans la liste"
            placeholderTextColor={theme.textSecondary}
            maxLength={500}
            multiline
            style={[styles.reason, { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
            accessibilityLabel="Motif de la suspension"
          />
        ) : null}
        {error ? (
          <ThemedText type="small" style={styles.err} accessibilityRole="alert">
            {error}
          </ThemedText>
        ) : null}
        <View style={styles.row}>
          <Pressable onPress={onCancel} accessibilityRole="button" style={[styles.confirmBtn, { borderColor: theme.border }]}>
            <ThemedText type="smallBold">Annuler</ThemedText>
          </Pressable>
          <Pressable onPress={() => void go()} disabled={busy} accessibilityRole="button" style={[styles.confirmBtn, styles.dangerBtn]}>
            {busy ? <ActivityIndicator size="small" color={Brand.danger} /> : <ThemedText type="smallBold" style={{ color: Brand.danger }}>{confirmLabel}</ThemedText>}
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  center: { textAlign: 'center' },
  pressed: { opacity: 0.8 },
  loader: { marginVertical: 32 },
  body: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  row: { flexDirection: 'row', gap: 10, justifyContent: 'flex-end' },
  row2: { flexDirection: 'row', gap: 10 },
  note: { textAlign: 'center', paddingVertical: 8 },
  err: { color: Brand.danger },
  idCard: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 14 },
  idJob: { fontSize: 15, lineHeight: 20, fontWeight: '800', marginTop: 4 },
  info: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoLabel: { width: 130 },
  infoValue: { flex: 1, fontWeight: '700', textAlign: 'right' },
  actions: { gap: 8, marginTop: 6 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, minHeight: 52 },
  actionText: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  tplBox: { gap: 8 },
  tplRow: { gap: 8, paddingRight: 8 },
  tpl: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, minHeight: 36 },
  tplText: { fontSize: 13, lineHeight: 17, fontWeight: '700' },
  tplConfirm: { borderRadius: 14, padding: 12, gap: 10 },
  smallBtn: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  softBtn: { backgroundColor: Brand.primarySoft, borderWidth: 1, borderColor: Brand.primaryLine },
  group: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  groupIco: { width: 30, height: 30, borderRadius: 10, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center' },
  groupTitle: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, minHeight: 50 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  emptyBox: { alignItems: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 24 },
  tl: { flexDirection: 'row', gap: 12 },
  tlRail: { alignItems: 'center', width: 14 },
  tlDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Brand.primary, marginTop: 4 },
  tlLine: { flex: 1, width: 2, marginTop: 2 },
  tlBody: { flex: 1, paddingBottom: 16, gap: 2 },
  tlTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  seg: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, minHeight: 40 },
  segOn: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  noteBox: { flexDirection: 'row', gap: 8, borderRadius: 12, padding: 12 },
  secret: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, backgroundColor: Brand.primarySoft, paddingLeft: 14, paddingRight: 6, paddingVertical: 6 },
  secretText: { flex: 1, fontSize: 20, lineHeight: 28, fontWeight: '900', letterSpacing: 1.5, color: Brand.primaryInk },
  /* Long jeton sans espace : Android le coupe seul, le navigateur a besoin de word-break. */
  secretLink: { fontSize: 13, lineHeight: 18, letterSpacing: 0, fontWeight: '700', ...(Platform.OS === 'web' ? ({ wordBreak: 'break-all' } as object) : null) },
  copy: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  warnText: { color: '#B45309', fontWeight: '700' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 999, minHeight: 48 },
  reason: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 80, textAlignVertical: 'top', fontSize: 15 },
  confirmBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 999, minHeight: 48 },
  dangerBtn: { borderColor: '#F5C2C0', backgroundColor: '#FDECEC' },
});
