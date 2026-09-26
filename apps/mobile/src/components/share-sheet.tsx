import { CARD_FRAMES, formationLayout, type SavedPlayer, type SquadResult } from '@champion/shared';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LegalNote } from '@/components/legal-note';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { Btn } from '@/design/ui';
import { RESULT_SQUARE, shareHeadline, shareImage, shareText, squadShareText } from '@/game/share';
import { claim } from '@/game/wallet';
import { useProgress } from '@/game/progress';

export type ShareData = {
  username: string | null;
  formation: string;
  overall: number;
  rating: number;
  chemistry: number;
  /** In formation spot order. */
  players: SavedPlayer[];
  results: Omit<SquadResult, 'at'>[];
  /** The link if the squad is already saved (added to the emoji summary). */
  link?: string | null;
  /** The public link (saves the squad first if needed); null when offline. */
  getLink?: () => Promise<string | null>;
};

const SQUARE_COLOR = { '🟩': C.green, '🟨': C.gold, '🟥': C.red } as const;

const surname = (name: string) => name.split(' ').slice(-1)[0] ?? name;

/** Share a squad: the card as an image, an emoji summary, or the link that opens the XI. */
export function ShareSheet({ data, onClose }: { data: ShareData; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const card = useRef<View>(null);
  const [busy, setBusy] = useState<'image' | 'text' | 'link' | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const cardWidth = Math.min(width - 40, 380);
  // Share-card frame (store or earned cosmetic), e.g. 'frame-gold' → CARD_FRAMES.gold.
  const equippedFrame = useProgress().equipped.frame;
  const frame = equippedFrame ? CARD_FRAMES[equippedFrame.replace(/^frame-/, '')] : undefined;
  const head = shareHeadline(data.results);
  const best = [...data.players].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).map((p) => surname(p.name));

  const run = async (what: 'image' | 'text' | 'link') => {
    setBusy(what);
    setNote(null);
    try {
      if (what === 'image') {
        const r = await shareImage(card);
        setNote(r === 'failed' ? 'Image sharing is not available here.' : null);
        if (r !== 'failed') void claim('share', 'today', 'Shared your squad');
        return;
      }
      // The emoji summary only carries the link of an already saved squad; "Squad link" saves it.
      const link =
        what === 'link' ? (data.getLink ? await data.getLink().catch(() => null) : null) : (data.link ?? null);
      if (what === 'link' && !link) {
        setNote('Could not create the link – check your connection.');
        return;
      }
      const message =
        what === 'link'
          ? `⚽ ${head ? `${head.big} · ${head.sub}. ${head.dare}` : 'Can your XI beat mine?'} OVR ${Math.round(data.overall)} · CHEM ${data.chemistry}\n${link}`
          : squadShareText({ ...data, names: best, link });
      const r = await shareText(message);
      setNote(r === 'copied' ? 'Copied to the clipboard.' : r === 'failed' ? 'Sharing failed.' : null);
      if (r !== 'failed') void claim('share', 'today', 'Shared your squad');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.head}>
            <Txt v="h20">Share your XI</Txt>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.close}>
              <Icon name="close" size={18} color={C.text} />
            </Pressable>
          </View>

          {/* The card that becomes the image */}
          <View
            ref={card}
            collapsable={false}
            style={[
              styles.card,
              { width: cardWidth },
              frame && { borderWidth: 3, borderColor: frame.colors[0], boxShadow: `0px 0px 18px ${frame.colors[1]}` },
            ]}>
            <View style={styles.cardGlow} />
            <View style={styles.cardTop}>
              <View style={styles.flex}>
                <Txt v="capUpper" color={C.green}>
                  CHAMPION · DRAFTED XI
                </Txt>
                <Txt v="h20" numberOfLines={1}>
                  {data.username ? `@${data.username}` : 'My XI'}
                </Txt>
                <Txt v="cap" color={C.textMuted}>
                  {data.formation}
                </Txt>
              </View>
              <View style={styles.ovr}>
                <Txt v="h36" color={C.gold}>
                  {Math.round(data.overall)}
                </Txt>
                <Txt v="tinyBold" color={C.textMuted}>
                  OVERALL
                </Txt>
              </View>
            </View>
            {/* The headline: the squad's best result, big */}
            {head && (
              <View style={[styles.headline, { borderColor: alpha(SQUARE_COLOR[RESULT_SQUARE[head.outcome]], 0.5) }]}>
                <Txt
                  v="h36"
                  color={head.outcome === 'champion' ? C.gold : C.text}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={styles.center}>
                  {head.big}
                </Txt>
                <Txt v="bodySemi" color={C.textMuted} numberOfLines={2} style={styles.center}>
                  {head.sub}
                </Txt>
                {data.results.length > 1 && (
                  <View style={styles.squares}>
                    {data.results.map((r, k) => (
                      <View key={k} style={[styles.square, { backgroundColor: SQUARE_COLOR[RESULT_SQUARE[r.outcome]] }]} />
                    ))}
                  </View>
                )}
              </View>
            )}
            <View style={styles.stats}>
              <Stat label="RATING" value={data.rating.toFixed(1)} color={C.blueLight} />
              <Stat label="CHEM" value={String(data.chemistry)} color={C.green} />
            </View>
            <CardPitch formation={data.formation} players={data.players} width={cardWidth - 24} />
            {data.results.map((r, k) => (
              <View key={k} style={styles.result}>
                <Icon name="emoji_events" size={14} color={C.gold} />
                <Txt v="bodySemi" numberOfLines={1} style={styles.flex}>
                  {r.title} · {r.detail}
                </Txt>
              </View>
            ))}
            <Txt v="tinyBold" color={C.green} style={styles.brand}>
              {(head?.dare ?? 'Can your XI beat mine?').toUpperCase()} · CHAMPION
            </Txt>
            <LegalNote compact />
          </View>

          <Btn
            kind="blue"
            icon="image"
            label={busy === 'image' ? 'Preparing…' : 'Share image'}
            sub="The card above"
            disabled={!!busy}
            onPress={() => run('image')}
            style={{ width: cardWidth }}
          />
          <View style={[styles.row, { width: cardWidth }]}>
            <Btn
              kind="dark"
              icon="content_copy"
              label="Emoji summary"
              disabled={!!busy}
              onPress={() => run('text')}
              style={styles.flex}
            />
            {data.getLink && (
              <Btn
                kind="green"
                icon="link"
                label={busy === 'link' ? 'Saving…' : 'Squad link'}
                disabled={!!busy}
                onPress={() => run('link')}
                style={styles.flex}
              />
            )}
          </View>
          {note && (
            <Txt v="bodySemi" color={C.textMuted} style={styles.center}>
              {note}
            </Txt>
          )}
          {data.getLink && (
            <Txt v="capBody" color={C.textDim} style={[styles.center, { width: cardWidth }]}>
              The link opens your XI – anyone can view it and challenge it with their own squad. Sharing the link saves
              the squad on the leaderboard.
            </Txt>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

/** A static pitch for the image (no animations, so every capture shows all players). */
function CardPitch({ formation, players, width }: { formation: string; players: SavedPlayer[]; width: number }) {
  const height = width * 1.05;
  const spots = formationLayout(formation);
  const ys = spots.map((s) => s.y);
  const [minY, maxY] = [Math.min(...ys), Math.max(...ys)];
  return (
    <View style={[styles.pitch, { width, height }]}>
      <View style={styles.halfway} />
      <View
        style={[
          styles.circle,
          { width: width * 0.28, height: width * 0.28, marginLeft: -width * 0.14, marginTop: -width * 0.14 },
        ]}
      />
      <View style={[styles.box, { top: -1, width: width * 0.5, height: height * 0.14, marginLeft: -width * 0.25 }]} />
      <View
        style={[styles.box, { bottom: -1, width: width * 0.5, height: height * 0.14, marginLeft: -width * 0.25 }]}
      />
      {spots.map((s, i) => {
        const p = players[i];
        if (!p) return null;
        const x = (0.08 + s.x * 0.84) * width;
        const y = (0.9 - ((s.y - minY) / (maxY - minY || 1)) * 0.78) * height;
        return (
          <View key={i} style={[styles.dotWrap, { left: x - 36, top: y - 17 }]}>
            <View style={styles.dot}>
              <Txt v="num13" color={C.gold}>
                {p.rating !== null ? Math.round(p.rating) : '–'}
              </Txt>
            </View>
            <View style={styles.name}>
              <Txt v="tinyBold" numberOfLines={1}>
                {surname(p.name)}
              </Txt>
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Txt v="tinyBold" color={C.textMuted}>
        {label}
      </Txt>
      <Txt v="h20" color={color}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  headline: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: R.md,
    borderWidth: 1,
    backgroundColor: alpha(C.deep, 0.6),
  },
  squares: { flexDirection: 'row', gap: 4, marginTop: 4 },
  square: { width: 14, height: 14, borderRadius: 3 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,8,14,0.94)',
  },
  content: {
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  head: {
    width: '100%',
    maxWidth: 380,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface3,
  },
  card: {
    gap: 10,
    padding: 12,
    overflow: 'hidden',
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: alpha(C.gold, 0.4),
    backgroundColor: C.surface,
  },
  cardGlow: {
    ...StyleSheet.absoluteFill,
    experimental_backgroundImage: `radial-gradient(ellipse 80% 50% at 50% 0%, ${alpha(C.green, 0.25)} 0%, ${alpha(C.deep, 0)} 100%)`,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  flex: {
    flex: 1,
  },
  ovr: {
    alignItems: 'center',
  },
  stats: {
    flexDirection: 'row',
    gap: 8,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: R.sm,
    backgroundColor: C.surface3,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: R.sm,
    backgroundColor: alpha(C.gold, 0.1),
  },
  pitch: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: '#1d5c34',
  },
  halfway: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  circle: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  box: {
    position: 'absolute',
    left: '50%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  dotWrap: {
    position: 'absolute',
    width: 72,
    alignItems: 'center',
    gap: 2,
  },
  dot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.gold,
    backgroundColor: C.deep,
  },
  name: {
    maxWidth: 72,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: R.xs,
    backgroundColor: 'rgba(8,15,24,0.85)',
  },
  brand: {
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  center: {
    textAlign: 'center',
  },
});
