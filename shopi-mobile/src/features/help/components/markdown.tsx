/**
 * Affichage du contenu d'un article d'aide (Markdown simple, comme le
 * MarkdownRenderer du site) : titres #, ##, ###, paragraphes, listes à puces
 * (-, *) et numérotées (1.), citations (>), séparateurs (---), **gras**,
 * *italique*, `code` et liens [texte](url).
 */
import { Linking, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type Block =
  | { kind: 'h'; level: number; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'ul'; items: string[] }
  | { kind: 'ol'; items: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'hr' };

function parse(md: string): Block[] {
  const lines = md.replace(/\r/g, '').split('\n');
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ kind: 'p', text: para.join(' ') });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flush();
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      flush();
      out.push({ kind: 'h', level: h[1].length, text: h[2] });
      continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line)) {
      flush();
      out.push({ kind: 'hr' });
      continue;
    }
    if (line.startsWith('>')) {
      flush();
      out.push({ kind: 'quote', text: line.replace(/^>\s?/, '') });
      continue;
    }
    const ul = /^[-*]\s+(.*)$/.exec(line);
    const ol = /^\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flush();
      const kind: 'ul' | 'ol' = ul ? 'ul' : 'ol';
      const items: string[] = [(ul ?? ol)![1]];
      while (i + 1 < lines.length) {
        const n = lines[i + 1].trim();
        const m = kind === 'ul' ? /^[-*]\s+(.*)$/.exec(n) : /^\d+[.)]\s+(.*)$/.exec(n);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      out.push(kind === 'ul' ? { kind: 'ul', items } : { kind: 'ol', items });
      continue;
    }
    para.push(line);
  }
  flush();
  return out;
}

/** Texte enrichi : **gras**, *italique*, `code`, [lien](url). */
function Inline({ text, style }: { text: string; style?: object }) {
  const theme = useTheme();
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith('**')) parts.push(<ThemedText key={k++} style={styles.bold}>{t.slice(2, -2)}</ThemedText>);
    else if (t.startsWith('`')) parts.push(<ThemedText key={k++} style={[styles.code, { backgroundColor: theme.backgroundElement }]}>{t.slice(1, -1)}</ThemedText>);
    else if (t.startsWith('[')) {
      const l = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t);
      parts.push(
        <ThemedText key={k++} style={styles.link} onPress={() => l && void Linking.openURL(l[2])}>
          {l?.[1] ?? t}
        </ThemedText>,
      );
    } else parts.push(<ThemedText key={k++} style={styles.italic}>{t.slice(1, -1)}</ThemedText>);
    last = m.index + t.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <ThemedText style={[styles.text, style]}>{parts}</ThemedText>;
}

export function Markdown({ content }: { content: string }) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      {parse(content).map((b, i) => {
        if (b.kind === 'h') return <Inline key={i} text={b.text} style={b.level === 1 ? styles.h1 : b.level === 2 ? styles.h2 : styles.h3} />;
        if (b.kind === 'hr') return <View key={i} style={[styles.hr, { backgroundColor: theme.border }]} />;
        if (b.kind === 'quote')
          return (
            <View key={i} style={[styles.quote, { borderLeftColor: theme.text, backgroundColor: theme.backgroundElement }]}>
              <Inline text={b.text} />
            </View>
          );
        if (b.kind === 'ul' || b.kind === 'ol')
          return (
            <View key={i} style={styles.list}>
              {b.items.map((it, j) => (
                <View key={j} style={styles.li}>
                  <ThemedText style={styles.bullet}>{b.kind === 'ul' ? '•' : `${j + 1}.`}</ThemedText>
                  <Inline text={it} style={styles.flex} />
                </View>
              ))}
            </View>
          );
        return <Inline key={i} text={b.text} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 12 },
  text: { fontSize: 15.5, lineHeight: 24 },
  bold: { fontWeight: '800' },
  italic: { fontStyle: 'italic' },
  code: { fontFamily: 'monospace', fontSize: 14 },
  link: { textDecorationLine: 'underline', fontWeight: '700' },
  h1: { fontSize: 22, lineHeight: 28, fontWeight: '900', marginTop: 6 },
  h2: { fontSize: 19, lineHeight: 25, fontWeight: '900', marginTop: 6 },
  h3: { fontSize: 16.5, lineHeight: 22, fontWeight: '800', marginTop: 4 },
  hr: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  quote: { borderLeftWidth: 3, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  list: { gap: 6 },
  li: { flexDirection: 'row', gap: 8 },
  bullet: { fontSize: 15.5, lineHeight: 24, fontWeight: '800', minWidth: 18 },
});
