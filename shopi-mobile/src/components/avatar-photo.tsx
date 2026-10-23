/**
 * Photo de profil posée DANS une pastille d'avatar existante (initiales ou
 * emoji en dessous) : elle la recouvre entièrement, et les petits points
 * d'état (en ligne, disponible…) déclarés après restent visibles par-dessus.
 * Usage : {uri ? <AvatarPhoto uri={uri} size={46} /> : <Initiales />}
 */
import { Image } from 'expo-image';

import { thumb } from '@/features/catalog/format';

export function AvatarPhoto({ uri, size, radius }: { uri: string; size: number; radius?: number }) {
  return (
    <Image
      source={{ uri: thumb(uri, Math.round(size * 3)) }}
      style={{ position: 'absolute', top: 0, left: 0, width: size, height: size, borderRadius: radius ?? size / 2 }}
      contentFit="cover"
      transition={120}
      accessibilityIgnoresInvertColors
    />
  );
}
