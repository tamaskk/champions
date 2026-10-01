import { isLockedSpot, type Formation } from '@champion/shared';
import { StyleSheet, View } from 'react-native';

import { ROLE_TITLES } from '@/components/draft-spin';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R } from '@/design/tokens';
import { formatRating } from '@/utils/rating';

import type { Draft } from './use-draft';

/** The line under the pitch: what to do next with the pick, the picked-up player or the squad. */
export function DraftHint({ d, formation }: { d: Draft; formation: Formation }) {
  const { benchOpen, lineupFull, moving, pending, pendingPreview, selected, sub } = d;
  return (
    <View style={styles.callout}>
      <Icon name="info" size={15} color={C.textMuted} />
      <Txt v="body" color={C.textMuted} style={styles.flex}>
        {sub ? (
          <>
            Bring on{' '}
            <Txt v="bodyBold" color={C.gold}>
              {sub.player.name}
            </Txt>
            {sub.player.position === 'GK'
              ? ': tap your goalkeeper to swap them. Tap the substitute again to cancel.'
              : ': tap a starter to swap them – blue = main position, gold = other, red = out of position. Tap the substitute again to cancel.'}
          </>
        ) : moving ? (
          <>
            Swap{' '}
            <Txt v="bodyBold" color={C.gold}>
              {moving.player.name}
            </Txt>
            {isLockedSpot(formation, selected!)
              ? ': the goalkeeper stays in goal. Open his card or give him the armband; tap him again to cancel.'
              : ': tap another player (or a substitute) to swap. Red = out of position (−1 chemistry). Tap him again to cancel.'}
          </>
        ) : pending ? (
          <>
            Place{' '}
            <Txt v="bodyBold" color={C.blueLight}>
              {pending.player.name}
            </Txt>{' '}
            ({ROLE_TITLES[pending.player.position].slice(0, -1)}
            {pending.player.rating !== undefined && ` · Rtg ${formatRating(pending.player.rating)}`}) on a blue
            (main position) or gold (other position) spot
            {pendingPreview?.best && pendingPreview.best.gain > 0
              ? ` · up to +${pendingPreview.best.gain} chemistry`
              : ''}
          </>
        ) : lineupFull && benchOpen ? (
          <>
            XI complete. The bench is{' '}
            <Txt v="bodyBold" color={C.text}>
              optional
            </Txt>
            : substitutes rest your starters over a league season.{' '}
            <Txt v="bodyBold" color={C.gold}>
              Auto-bench
            </Txt>{' '}
            fills it in one tap, or tap{' '}
            <Txt v="bodyBold" color={C.blueLight}>
              Complete
            </Txt>
            .
          </>
        ) : lineupFull ? (
          <>
            Squad full. Tap{' '}
            <Txt v="bodyBold" color={C.blueLight}>
              Complete
            </Txt>{' '}
            for the summary, or tap two players to swap them.
          </>
        ) : (
          <>
            Tap{' '}
            <Txt v="bodyBold" color={C.blueLight}>
              Spin
            </Txt>{' '}
            to draft next player, or{' '}
            <Txt v="bodySemi" color={C.text}>
              Autocomplete
            </Txt>{' '}
            to fill the rest.
          </>
        )}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  callout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: R.md,
    backgroundColor: C.surface,
  },
  flex: {
    flex: 1,
  },
});
