import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';

/** Dropdown: label, current value, and an inline list of options while open. */
export function Select({
  label,
  value,
  open,
  options,
  onToggle,
  onSelect,
}: {
  label: string;
  value: string;
  open: boolean;
  options: { key: string; label: string; active: boolean }[];
  onToggle: () => void;
  onSelect: (key: string) => void;
}) {
  return (
    <View style={styles.select}>
      <Txt v="capUpper" color={C.textMuted}>
        {label}
      </Txt>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityState={{ expanded: open }}
        style={[styles.button, open && styles.buttonOpen]}>
        <Txt v="bodySemi" numberOfLines={1} style={styles.grow}>
          {value}
        </Txt>
        <Icon name="expand_more" size={18} color={C.textMuted} style={open && styles.flip} />
      </Pressable>
      {open && (
        <ScrollView style={styles.options} nestedScrollEnabled>
          {options.map((o) => (
            <Pressable
              key={o.key}
              onPress={() => onSelect(o.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: !!o.active }}
              style={({ pressed }) => [styles.option, o.active && styles.active, pressed && styles.pressed]}>
              <Txt v={o.active ? 'bodyBold' : 'body'} color={o.active ? C.onGreenStrong : C.text}>
                {o.label}
              </Txt>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  select: {
    gap: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: R.sm,
    backgroundColor: C.surface2,
    borderWidth: 1,
    borderColor: C.surface3,
  },
  buttonOpen: {
    borderColor: alpha(C.green, 0.5),
  },
  grow: {
    flex: 1,
  },
  flip: {
    transform: [{ rotate: '180deg' }],
  },
  options: {
    maxHeight: 220,
    padding: 4,
    borderRadius: R.sm,
    backgroundColor: C.surface3,
  },
  option: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: R.sm,
  },
  active: {
    backgroundColor: C.green,
  },
  pressed: {
    backgroundColor: C.surface4,
  },
});
