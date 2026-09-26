import { Text, type StyleProp, type TextStyle } from 'react-native';

import { C, F } from './tokens';

/** Material Symbols code points of the icons the design uses. */
const GLYPHS = {
  bolt: 59915,
  casino: 60224,
  sports_soccer: 59951,
  explore: 59514,
  notifications: 59380,
  person: 59389,
  close: 58829,
  tune: 58409,
  expand_more: 58831,
  info: 59534,
  auto_awesome: 58975,
  play_arrow: 57399,
  fast_forward: 57375,
  slow_motion_video: 57448,
  skip_next: 57412,
  arrow_forward: 58824,
  arrow_back_ios_new: 58090,
  emoji_events: 59939,
  timer: 58405,
  lock: 59543,
  kid_star: 62758,
  star: 59448,
  account_tree: 59770,
  flag: 57683,
  workspace_premium: 59311,
  add: 57669,
  shield: 59872,
  stars: 59600,
  autorenew: 59491,
  check_circle: 59500,
  verified: 61302,
  deployed_code: 63264,
  stadium: 60304,
  local_fire_department: 61269,
  link: 57687,
  crown: 60595,
  handshake: 60363,
  restart_alt: 61523,
  chevron_right: 58828,
  leaderboard: 61964,
  calendar_month: 60364,
  military_tech: 59967,
  sports: 59952,
  search: 59574,
  location_on: 57544,
  groups: 62003,
  hub: 59892,
  grid_view: 59824,
  sports_score: 61550,
  schema: 58621,
  water_drop: 59288,
  check: 58826,
  swords: 63625,
  image: 58356,
  content_copy: 57677,
  share: 59405,
  hourglass_empty: 59531,
  toll: 57568,
  monetization_on: 58979,
  shopping_bag: 61900,
  play_circle: 57796,
  card_giftcard: 59638,
  replay: 57410,
} as const;

export type IconName = keyof typeof GLYPHS;

export function Icon({
  name,
  size = 16,
  color = C.text,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      accessible={false}
      style={[
        { fontFamily: F.icons, fontSize: size, lineHeight: size, width: size, color, textAlign: 'center' },
        style,
      ]}>
      {String.fromCodePoint(GLYPHS[name])}
    </Text>
  );
}
