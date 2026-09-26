import { LEAGUE_ADJECTIVES, seasonLabel, type SearchResponse, type SquadResponse } from '@champion/shared';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchSearch, fetchSquadByCode, toDraftPlayer } from '@/api/client';
import { PlayerCard } from '@/components/player-card';
import { Icon } from '@/design/icon';
import { Txt } from '@/design/text';
import { C, R, alpha } from '@/design/tokens';
import { ratingTint } from '@/design/ui';
import type { DraftPlayer } from '@/mocks/players';

const DEBOUNCE_MS = 300;
const SQUAD_PREVIEW = 12;

type Search = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; result: SearchResponse };
type ClubSquad = { key: string; status: 'loading' | 'error' } | { key: string; status: 'ready'; players: SquadResponse['players'] };

const leagueName = (l: string) => LEAGUE_ADJECTIVES[l as keyof typeof LEAGUE_ADJECTIVES] ?? l;
const years = (from: number, to: number) => (from === to ? seasonLabel(from) : `${from}–${to + 1}`);

/** Explore search: players and clubs by name. Players open their card; clubs show a decade's squad. */
export function SearchSheet({ onClose }: { onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState<Search>({ status: 'idle' });
  const [openClub, setOpenClub] = useState<string | null>(null);
  const [squad, setSquad] = useState<ClubSquad | null>(null);
  const [card, setCard] = useState<DraftPlayer | null>(null);
  const request = useRef(0);

  // Search as you type (debounced); only the latest request's answer is shown.
  useEffect(() => {
    const text = q.trim();
    const id = ++request.current;
    const t = setTimeout(() => {
      if (text.length < 2) return setSearch({ status: 'idle' });
      setSearch({ status: 'loading' });
      fetchSearch(text)
        .then((result) => id === request.current && setSearch({ status: 'ready', result }))
        .catch(() => id === request.current && setSearch({ status: 'error' }));
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [q]);

  const showSquad = (club: SearchResponse['clubs'][number], league: string, decade: number) => {
    const key = `${club.clubSlug}|${league}|${decade}`;
    setSquad({ key, status: 'loading' });
    fetchSquadByCode(league as SquadResponse['league'], decade, club.club)
      .then((r) => setSquad((s) => (s?.key === key ? { key, status: 'ready', players: r.players } : s)))
      .catch(() => setSquad((s) => (s?.key === key ? { key, status: 'error' } : s)));
  };

  const result = search.status === 'ready' ? search.result : null;
  const empty = result && !result.players.length && !result.clubs.length;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={styles.bar}>
          <View style={styles.inputWrap}>
            <Icon name="search" size={18} color={C.textMuted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Search players or clubs"
              placeholderTextColor={C.textDim}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              accessibilityLabel="Search players or clubs"
              style={styles.input}
            />
            {q ? (
              <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                <Icon name="close" size={16} color={C.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close search">
            <Txt v="bodySemi" color={C.green}>
              Close
            </Txt>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          {search.status === 'idle' && (
            <Txt v="body" color={C.textMuted} style={styles.hint}>
              Type at least 2 letters – accents don&apos;t matter (&quot;mbappe&quot;, &quot;koln&quot;).
            </Txt>
          )}
          {search.status === 'loading' && <ActivityIndicator color={C.green} style={styles.hint} />}
          {search.status === 'error' && (
            <Txt v="body" color={C.red} style={styles.hint}>
              Search failed – check your connection.
            </Txt>
          )}
          {empty && (
            <Txt v="body" color={C.textMuted} style={styles.hint}>
              Nothing found for “{q.trim()}”.
            </Txt>
          )}

          {result && result.players.length > 0 && (
            <View style={styles.section}>
              <Txt v="h14">PLAYERS</Txt>
              {result.players.map((p) => (
                <Pressable
                  key={`${p.tmPlayerId ?? p.nameSlug}`}
                  onPress={() =>
                    setCard({
                      id: p.nameSlug,
                      name: p.name,
                      position: p.position,
                      positions: p.positions,
                      rating: p.rating ?? undefined,
                      tmId: p.tmPlayerId,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${p.name}, open player card`}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                  <View style={styles.flex}>
                    <Txt v="bodyBold">{p.name}</Txt>
                    <Txt v="cap" color={C.textMuted}>
                      {[p.positions.join('/') || p.position, p.nationality, `${p.club} · ${leagueName(p.league)}`, years(p.from, p.to)]
                        .filter(Boolean)
                        .join(' · ')}
                    </Txt>
                  </View>
                  {p.rating !== null && (
                    <Txt v="num13" color={ratingTint(p.rating)}>
                      {Math.round(p.rating)}
                    </Txt>
                  )}
                  <Icon name="chevron_right" size={16} color={C.textDim} />
                </Pressable>
              ))}
            </View>
          )}

          {result && result.clubs.length > 0 && (
            <View style={styles.section}>
              <Txt v="h14">CLUBS</Txt>
              {result.clubs.map((c) => {
                const open = openClub === c.clubSlug;
                return (
                  <View key={c.clubSlug} style={styles.clubCard}>
                    <Pressable
                      onPress={() => {
                        setOpenClub(open ? null : c.clubSlug);
                        setSquad(null);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: open }}
                      style={styles.clubHead}>
                      <Icon name="shield" size={18} color={C.green} />
                      <View style={styles.flex}>
                        <Txt v="bodyBold">{c.club}</Txt>
                        <Txt v="cap" color={C.textMuted}>
                          {c.leagues.map(leagueName).join(', ')} · {years(c.from, c.to)}
                        </Txt>
                      </View>
                      <Icon name="expand_more" size={18} color={C.textMuted} />
                    </Pressable>
                    {open && (
                      <View style={styles.decades}>
                        {c.decades.map((d) =>
                          c.leagues.map((l) => {
                            const key = `${c.clubSlug}|${l}|${d}`;
                            const active = squad?.key === key;
                            return (
                              <Pressable
                                key={key}
                                onPress={() => showSquad(c, l, d)}
                                accessibilityRole="button"
                                style={[styles.decade, active && styles.decadeActive]}>
                                <Txt v="capUpper" color={active ? C.onGreenStrong : C.text}>
                                  {c.leagues.length > 1 ? `${l} ` : ''}
                                  {d}s
                                </Txt>
                              </Pressable>
                            );
                          }),
                        )}
                      </View>
                    )}
                    {open && squad?.key.startsWith(`${c.clubSlug}|`) && (
                      <View style={styles.squad}>
                        {squad.status === 'loading' && <ActivityIndicator color={C.green} />}
                        {squad.status === 'error' && (
                          <Txt v="cap" color={C.red}>
                            Could not load the squad.
                          </Txt>
                        )}
                        {squad.status === 'ready' && squad.players.length === 0 && (
                          <Txt v="cap" color={C.textMuted}>
                            No squad imported for this decade yet.
                          </Txt>
                        )}
                        {squad.status === 'ready' &&
                          squad.players.slice(0, SQUAD_PREVIEW).map((p) => (
                            <Pressable
                              key={p.nameSlug}
                              onPress={() => setCard(toDraftPlayer(p))}
                              accessibilityRole="button"
                              style={({ pressed }) => [styles.squadRow, pressed && styles.pressed]}>
                              <Txt v="tinyBold" color={C.textMuted} style={styles.pos}>
                                {p.position}
                              </Txt>
                              <Txt v="body" style={styles.flex} numberOfLines={1}>
                                {p.name}
                              </Txt>
                              {p.rating !== null && (
                                <Txt v="num13" color={ratingTint(p.rating)}>
                                  {Math.round(p.rating)}
                                </Txt>
                              )}
                            </Pressable>
                          ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>

        {card && (
          <PlayerCard
            key={card.id}
            player={card}
            role={card.positions?.join(' / ') || card.position}
            links={[]}
            onOpen={() => undefined}
            onClose={() => setCard(null)}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: R.pill,
    backgroundColor: C.surface3,
  },
  input: { flex: 1, color: C.text, fontSize: 16 },
  content: { paddingHorizontal: 16, gap: 18 },
  hint: { marginTop: 24, textAlign: 'center' },
  section: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: R.lg, backgroundColor: C.surface },
  pressed: { opacity: 0.7 },
  flex: { flex: 1 },
  clubCard: { borderRadius: R.lg, backgroundColor: C.surface, overflow: 'hidden' },
  clubHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  decades: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingBottom: 12 },
  decade: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: R.pill, backgroundColor: C.surface3 },
  decadeActive: { backgroundColor: C.greenStrong },
  squad: { gap: 4, paddingHorizontal: 12, paddingBottom: 12 },
  squadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: R.md,
    backgroundColor: alpha(C.surface3, 0.6),
  },
  pos: { width: 24 },
});
