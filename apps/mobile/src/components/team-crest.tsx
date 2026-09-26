import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/design/icon';
import { F } from '@/design/tokens';
import { crestIcon, kitColor, teamInitials, type Progress } from '@/game/progress';

/** Your club's crest: shape filled with the kit colour, trim-coloured border and emblem/initials. */
export function TeamCrest({ progress, size = 48 }: { progress: Progress; size?: number }) {
  const { shape, trim, initials, name } = progress.team;
  const fill = kitColor(progress);
  const emblem = crestIcon(progress);
  const border = Math.max(2, Math.round(size / 18));

  const content = initials ? (
    <Text
      numberOfLines={1}
      adjustsFontSizeToFit
      style={[styles.initials, { color: trim, fontSize: size * 0.34, maxWidth: size * 0.8 }]}>
      {teamInitials(name)}
    </Text>
  ) : (
    <Icon name={emblem} size={size * 0.48} color={trim} />
  );

  if (shape === 'diamond') {
    const inner = size * 0.72;
    return (
      <View style={[styles.center, { width: size, height: size }]} accessibilityLabel={`${name} crest`}>
        <View
          style={[
            styles.center,
            {
              width: inner,
              height: inner,
              backgroundColor: fill,
              borderColor: trim,
              borderWidth: border,
              borderRadius: size * 0.08,
              transform: [{ rotate: '45deg' }],
            },
          ]}>
          <View style={{ transform: [{ rotate: '-45deg' }] }}>{content}</View>
        </View>
      </View>
    );
  }

  const radii =
    shape === 'circle'
      ? { borderRadius: size / 2 }
      : shape === 'square'
        ? { borderRadius: size * 0.22 }
        : {
            borderTopLeftRadius: size * 0.12,
            borderTopRightRadius: size * 0.12,
            borderBottomLeftRadius: size * 0.5,
            borderBottomRightRadius: size * 0.5,
          };
  return (
    <View
      accessibilityLabel={`${name} crest`}
      style={[
        styles.center,
        {
          width: size,
          height: shape === 'shield' ? size * 1.12 : size,
          backgroundColor: fill,
          borderColor: trim,
          borderWidth: border,
        },
        radii,
      ]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: F.display, textAlign: 'center' },
});
