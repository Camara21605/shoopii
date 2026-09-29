/** Liste des règles du mot de passe, cochées en direct pendant la saisie. */
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Brand, Spacing } from '@/constants/theme';
import { PASSWORD_RULES } from '@/features/auth/password-rules';
import { useTheme } from '@/hooks/use-theme';

export function PasswordRulesList({ password }: { password: string }) {
  const theme = useTheme();
  if (!password) return null;
  return (
    <View style={styles.rules}>
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(password);
        return (
          <ThemedText key={r.label} type="small" style={{ color: ok ? Brand.success : theme.textSecondary }}>
            {ok ? '✓' : '•'} {r.label}
          </ThemedText>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rules: { gap: 2, marginTop: -Spacing.one },
});
