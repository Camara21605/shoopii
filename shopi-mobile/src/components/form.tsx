/**
 * Éléments de formulaire communs (connexion, inscription…) — thème clair :
 * champ avec libellé et message d'erreur, champ mot de passe avec icône
 * œil (afficher / masquer), bouton principal avec état de chargement.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type FieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
  /** Élément collé à gauche du champ (ex. indicatif « +224 »). */
  left?: ReactNode;
  /** Élément collé à droite du champ (ex. bouton « Afficher »). */
  right?: ReactNode;
};

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, error, left, right, style, onFocus, onBlur, ...props },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? Brand.danger : focused ? Brand.primary : theme.border;

  return (
    <View style={styles.group}>
      {label ? (
        <ThemedText type="smallBold" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
      <View style={[styles.box, { borderColor, backgroundColor: theme.backgroundElement }]}>
        {left}
        <TextInput
          ref={ref}
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text }, style]}
          accessibilityLabel={label ?? props.placeholder}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />
        {right}
      </View>
      {error ? (
        <ThemedText type="small" style={styles.error} accessibilityRole="alert">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
});

/** Mot de passe avec bouton « Afficher / Masquer » — évite les fautes invisibles. */
export const PasswordField = forwardRef<TextInput, Omit<FieldProps, 'secureTextEntry' | 'right'>>(
  function PasswordField(props, ref) {
    const theme = useTheme();
    const [visible, setVisible] = useState(false);
    return (
      <Field
        ref={ref}
        {...props}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        right={
          <Pressable
            onPress={() => setVisible((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            hitSlop={10}
            style={styles.toggle}>
            {/* Œil ouvert = afficher ; œil barré = masquer (convention des applications) */}
            <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={theme.textSecondary} />
          </Pressable>
        }
      />
    );
  },
);

export function PrimaryButton({
  title,
  onPress,
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [styles.button, off && styles.buttonDisabled, pressed && !off && styles.buttonPressed]}>
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <ThemedText type="smallBold" style={styles.buttonText}>
          {title}
        </ThemedText>
      )}
    </Pressable>
  );
}

/** Bouton secondaire (contour bleu) — ex. « Créer un compte » sous « Se connecter ». */
export function SecondaryButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.secondary, disabled && styles.buttonDisabled, pressed && styles.secondaryPressed]}>
      <ThemedText type="smallBold" style={[styles.buttonText, { color: Brand.primary }]}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

/** Choix parmi quelques options (ex. genre) — pastilles sélectionnables. */
export function Chips<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label?: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  error?: string | null;
}) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      {label ? (
        <ThemedText type="smallBold" style={styles.label}>
          {label}
        </ThemedText>
      ) : null}
      <View style={styles.chips} accessibilityRole="radiogroup">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[
                styles.chip,
                { borderColor: on ? Brand.primary : error ? Brand.danger : theme.border },
                on && { backgroundColor: theme.backgroundSelected },
              ]}>
              <ThemedText type="small" style={on ? { color: Brand.primary, fontWeight: '700' } : undefined}>
                {o.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <ThemedText type="small" style={styles.error} accessibilityRole="alert">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  label: { fontSize: 13 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 12,
    minHeight: 50,
    paddingHorizontal: Spacing.three,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  toggle: { paddingLeft: Spacing.two, paddingVertical: 6 },
  error: { color: Brand.danger },
  button: {
    backgroundColor: Brand.primary,
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: '#fff', fontSize: 16 },
  secondary: {
    borderWidth: 1.5,
    borderColor: Brand.primary,
    borderRadius: 12,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  secondaryPressed: { backgroundColor: '#EEF3FE' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
});
