/**
 * Photo de l'interlocuteur, avec des ondes qui s'élargissent tant que l'appel
 * n'est pas établi (ça sonne / connexion) — comme sur un vrai téléphone.
 */
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function PulseAvatar({ name, uri, size = 132, pulsing }: { name: string; uri?: string | null; size?: number; pulsing: boolean }) {
  const [waves] = useState(() => [new Animated.Value(0), new Animated.Value(0)]);

  useEffect(() => {
    if (!pulsing) { waves.forEach(w => w.setValue(0)); return; }
    const loops = waves.map((w, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 900),
        Animated.timing(w, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(w, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [pulsing, waves]);

  return (
    <View style={[styles.wrap, { width: size * 1.9, height: size * 1.9 }]}>
      {waves.map((w, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[styles.wave, {
            width: size, height: size, borderRadius: size / 2,
            opacity: w.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
            transform: [{ scale: w.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
          }]}
        />
      ))}
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
        {uri
          ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          : <ThemedText style={[styles.initials, { fontSize: size * 0.34, lineHeight: size * 0.42 }]}>{initials(name)}</ThemedText>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  wave: { position: 'absolute', backgroundColor: '#fff' },
  avatar: {
    overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.14)', borderWidth: 3, borderColor: 'rgba(255,255,255,.85)',
  },
  initials: { fontWeight: '800', color: '#fff' },
});
