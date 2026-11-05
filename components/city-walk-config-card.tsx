import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getCityWalkTheme } from '@/components/city-walk-theme';
import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { NearbyPlace } from '@/lib/reverse-geocode';
import {
  CITY_WALK_INTERESTS,
  CITY_WALK_PACES,
  CITY_WALK_ROUTE_SHAPES,
  CityWalkInterest,
  CityWalkOrigin,
  CityWalkPace,
  CityWalkPreferences,
  CityWalkRouteShape,
} from '@/types/city-walk';

const DURATION_OPTIONS = [45, 60, 90, 120];
const INTEREST_ICONS: Record<CityWalkInterest, ComponentProps<typeof MaterialIcons>['name']> = {
  architecture: 'apartment',
  cafe: 'local-cafe',
  park: 'park',
  museum: 'museum',
  food: 'restaurant',
  shopping: 'shopping-bag',
  riverside: 'water',
  history: 'account-balance',
};

type PlaceSearchState = {
  keyword: string;
  setKeyword: (value: string) => void;
  results: NearbyPlace[] | null;
  searching: boolean;
  failed: boolean;
};

type Props = {
  origin: CityWalkOrigin | null;
  preferences: CityWalkPreferences;
  locating: boolean;
  search: PlaceSearchState;
  onLocate: () => void;
  onOpenMapPicker: () => void;
  onSelectPlace: (place: NearbyPlace) => void;
  onClearOrigin: () => void;
  onDurationChange: (minutes: number) => void;
  onToggleInterest: (interest: CityWalkInterest) => void;
  onPaceChange: (pace: CityWalkPace) => void;
  onRouteShapeChange: (shape: CityWalkRouteShape) => void;
  onGenerate: () => void;
};

type OptionChipProps = {
  label: string;
  active: boolean;
  theme: ReturnType<typeof getCityWalkTheme>;
  icon?: ComponentProps<typeof MaterialIcons>['name'];
  wide?: boolean;
  equal?: boolean;
  onPress: () => void;
};

/** 时长/兴趣/节奏/路线形状共用同一套 chip 交互（含无障碍选中态） */
function OptionChip({ label, active, theme, icon, wide, equal, onPress }: OptionChipProps) {
  return (
    <Pressable
      style={[
        styles.chip,
        wide && styles.interestChip,
        equal && styles.equalChip,
        {
          backgroundColor: active ? theme.accentSoft : theme.subtle,
          borderColor: active ? theme.accent : 'transparent',
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {icon ? (
        <MaterialIcons name={icon} size={18} color={active ? theme.accent : theme.muted} />
      ) : null}
      <Text style={[styles.chipText, { color: active ? theme.accent : theme.text }]}>{label}</Text>
      {wide && active ? (
        <MaterialIcons name="check" size={16} color={theme.accent} style={styles.chipCheck} />
      ) : null}
    </Pressable>
  );
}

export function CityWalkConfigCard({
  origin,
  preferences,
  locating,
  search,
  onLocate,
  onOpenMapPicker,
  onSelectPlace,
  onClearOrigin,
  onDurationChange,
  onToggleInterest,
  onPaceChange,
  onRouteShapeChange,
  onGenerate,
}: Props) {
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme = getCityWalkTheme(isDark);
  const cardStyle = { backgroundColor: theme.surface, borderColor: theme.line };

  const canGenerate = Boolean(origin) && preferences.interests.length > 0;

  return (
    <View style={styles.layout}>
      <View style={[styles.hero, { backgroundColor: theme.hero }]}>
        <View pointerEvents="none" style={styles.heroArtwork}>
          <View style={styles.heroRing} />
          <View style={styles.heroPath} />
          <View style={styles.heroDot} />
        </View>
        <View style={styles.heroEyebrow}>
          <MaterialIcons name="explore" size={15} color="#b8dfc8" />
          <Text style={styles.heroEyebrowText}>A WALK IN THE CITY</Text>
        </View>
        <Text style={styles.heroTitle}>{t('cityWalk.heroTitle')}</Text>
        <Text style={styles.heroSubtitle}>{t('cityWalk.heroSubtitle')}</Text>
        <View style={styles.heroFooter}>
          <View style={styles.heroFooterLine} />
          <Text style={styles.heroFooterText}>GO WHERER / WALK NOTES</Text>
        </View>
      </View>

      <View style={styles.intro}>
        <Text style={[styles.introTitle, { color: theme.text }]}>{t('cityWalk.routeSetup')}</Text>
        <Text style={[styles.introHint, { color: theme.muted }]}>
          {t('cityWalk.screenSubtitle')}
        </Text>
      </View>

      <View style={[styles.card, cardStyle]}>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionNumber, { color: theme.accent }]}>01</Text>
          <View style={styles.sectionHeadingCopy}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t('cityWalk.originLabel')}
            </Text>
            <Text style={[styles.sectionHint, { color: theme.muted }]}>
              {t('cityWalk.originHint')}
            </Text>
          </View>
          <MaterialIcons name="near-me" size={20} color={theme.accent} />
        </View>

        <View style={[styles.originRow, { backgroundColor: theme.subtle }]}>
          <View style={[styles.originPin, { backgroundColor: theme.accentSoft }]}>
            <MaterialIcons name="place" size={19} color={theme.accent} />
          </View>
          <View style={styles.originCopy}>
            <Text
              style={[styles.originText, { color: origin ? theme.text : theme.muted }]}
              numberOfLines={2}
            >
              {origin ? (origin.label ?? t('cityWalk.originUnnamed')) : t('cityWalk.originEmpty')}
            </Text>
            {origin ? (
              <Text style={[styles.originCoordinates, { color: theme.muted }]}>
                {origin.latitude.toFixed(5)}, {origin.longitude.toFixed(5)}
              </Text>
            ) : null}
          </View>
          {origin ? (
            <Pressable
              onPress={onClearOrigin}
              accessibilityRole="button"
              accessibilityLabel={t('cityWalk.clearOrigin')}
              hitSlop={8}
              style={styles.clearButton}
            >
              <MaterialIcons name="close" size={18} color={theme.muted} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.originActions}>
          <Pressable
            style={[styles.smallButton, { borderColor: theme.line }]}
            onPress={onLocate}
            disabled={locating}
            accessibilityRole="button"
          >
            {locating ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <MaterialIcons name="my-location" size={17} color={theme.accent} />
            )}
            <Text style={[styles.smallButtonText, { color: theme.text }]}>
              {locating ? t('cityWalk.locating') : t('cityWalk.useCurrentLocation')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.smallButton, { borderColor: theme.line }]}
            onPress={onOpenMapPicker}
            accessibilityRole="button"
          >
            <MaterialIcons name="map" size={17} color={theme.accent} />
            <Text style={[styles.smallButtonText, { color: theme.text }]}>
              {t('cityWalk.mapPick')}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.searchShell, { backgroundColor: theme.subtle }]}>
          <MaterialIcons name="search" size={19} color={theme.muted} />
          <TextInput
            value={search.keyword}
            onChangeText={search.setKeyword}
            placeholder={t('cityWalk.searchPlaceholder')}
            placeholderTextColor={theme.muted}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.searching ? <ActivityIndicator size="small" color={theme.accent} /> : null}
        </View>
        {search.results ? (
          <View style={styles.searchResults}>
            {search.results.length === 0 ? (
              <Text style={[styles.sectionHint, { color: theme.muted }]}>
                {search.failed ? t('cityWalk.searchFailed') : t('cityWalk.searchEmpty')}
              </Text>
            ) : (
              search.results.slice(0, 5).map((place) => (
                <Pressable
                  key={place.id}
                  style={[styles.searchItem, { backgroundColor: theme.subtle }]}
                  onPress={() => onSelectPlace(place)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.searchItemTitle, { color: theme.text }]} numberOfLines={1}>
                    {place.name}
                  </Text>
                  <Text style={[styles.searchItemMeta, { color: theme.muted }]} numberOfLines={1}>
                    {[place.address, place.distance ? `${Math.round(place.distance)}m` : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        ) : null}
      </View>

      <View style={[styles.card, cardStyle]}>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionNumber, { color: theme.accent }]}>02</Text>
          <View style={styles.sectionHeadingCopy}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t('cityWalk.configTitle')}
            </Text>
            <Text style={[styles.sectionHint, { color: theme.muted }]}>
              {t('cityWalk.preferencesHint')}
            </Text>
          </View>
          <MaterialIcons name="tune" size={20} color={theme.accent} />
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            {t('cityWalk.durationLabel')}
          </Text>
          <Text style={[styles.fieldHint, { color: theme.muted }]}>
            {t('cityWalk.durationHint')}
          </Text>
          <View style={styles.chipRow}>
            {DURATION_OPTIONS.map((minutes) => (
              <OptionChip
                key={minutes}
                label={t('duration.minutes', { minutes })}
                active={preferences.durationMinutes === minutes}
                theme={theme}
                equal
                onPress={() => onDurationChange(minutes)}
              />
            ))}
          </View>
        </View>
        <View style={[styles.separator, { backgroundColor: theme.line }]} />
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>
            {t('cityWalk.interestsLabel')}
          </Text>
          <Text style={[styles.fieldHint, { color: theme.muted }]}>
            {t('cityWalk.interestsShortHint')}
          </Text>
          <View style={styles.chipRow}>
            {CITY_WALK_INTERESTS.map((interest) => (
              <OptionChip
                key={interest}
                label={t(`cityWalk.interest.${interest}`)}
                active={preferences.interests.includes(interest)}
                theme={theme}
                wide
                icon={INTEREST_ICONS[interest]}
                onPress={() => onToggleInterest(interest)}
              />
            ))}
          </View>
        </View>
        <View style={[styles.separator, { backgroundColor: theme.line }]} />
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>{t('cityWalk.paceLabel')}</Text>
          <View style={styles.chipRow}>
            {CITY_WALK_PACES.map((pace) => (
              <OptionChip
                key={pace}
                label={t(`cityWalk.pace.${pace}`)}
                active={preferences.pace === pace}
                theme={theme}
                equal
                onPress={() => onPaceChange(pace)}
              />
            ))}
          </View>
        </View>
        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: theme.text }]}>{t('cityWalk.shapeLabel')}</Text>
          <View style={styles.chipRow}>
            {CITY_WALK_ROUTE_SHAPES.map((shape) => (
              <OptionChip
                key={shape}
                label={t(`cityWalk.shape.${shape}`)}
                active={preferences.routeShape === shape}
                theme={theme}
                equal
                onPress={() => onRouteShapeChange(shape)}
              />
            ))}
          </View>
          <Text style={[styles.fieldHint, { color: theme.muted }]}>
            {t('cityWalk.maxStopsHint', { count: preferences.maxStops })}
          </Text>
        </View>
      </View>

      <Pressable
        style={[styles.primaryButton, !canGenerate && styles.primaryButtonDisabled]}
        onPress={onGenerate}
        disabled={!canGenerate}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canGenerate }}
      >
        <View style={styles.buttonIcon}>
          <MaterialIcons name="auto-awesome" size={19} color="#ffffff" />
        </View>
        <Text style={styles.primaryButtonText}>{t('cityWalk.generate')}</Text>
        <MaterialIcons name="arrow-forward" size={20} color="#ffffff" />
      </Pressable>
      <View style={styles.privacyNote}>
        <MaterialIcons name="lock-outline" size={14} color={theme.muted} />
        <Text style={[styles.privacyText, { color: theme.muted }]}>{t('cityWalk.configHint')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layout: {
    gap: 16,
  },
  hero: {
    minHeight: 190,
    borderRadius: 26,
    padding: 22,
    overflow: 'hidden',
    alignItems: 'flex-start',
  },
  heroArtwork: {
    position: 'absolute',
    right: -22,
    top: -26,
    width: 180,
    height: 220,
    opacity: 0.45,
  },
  heroRing: {
    position: 'absolute',
    right: 0,
    top: 10,
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: '#a9d9ba',
  },
  heroPath: {
    position: 'absolute',
    right: 62,
    top: 10,
    width: 70,
    height: 190,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#a9d9ba',
    borderBottomLeftRadius: 55,
    transform: [{ rotate: '32deg' }],
  },
  heroDot: {
    position: 'absolute',
    right: 46,
    top: 49,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#d2e8b3',
  },
  heroEyebrow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 14,
  },
  heroEyebrowText: {
    color: '#b8dfc8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: '#f6faf4',
    fontSize: 27,
    fontWeight: '800',
    lineHeight: 35,
    letterSpacing: -0.7,
    maxWidth: '90%',
  },
  heroSubtitle: {
    color: '#c3ddd0',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    maxWidth: '88%',
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  heroFooterLine: {
    width: 24,
    height: 1,
    backgroundColor: '#b8dfc8',
  },
  heroFooterText: {
    color: '#b8dfc8',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  intro: {
    paddingHorizontal: 2,
    paddingTop: 4,
    gap: 5,
  },
  introTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  introHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  card: {
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    gap: 12,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  sectionNumber: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.7,
    alignSelf: 'flex-start',
    paddingTop: 4,
  },
  sectionHeadingCopy: {
    flex: 1,
    gap: 3,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  sectionHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  fieldGroup: {
    gap: 9,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  fieldHint: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: -3,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 3,
  },
  originRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 16,
    padding: 12,
  },
  originPin: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  originCopy: {
    flex: 1,
    gap: 3,
  },
  originText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  originCoordinates: {
    fontSize: 10,
    letterSpacing: 0.2,
  },
  clearButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  originActions: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  smallButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchShell: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 13,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 9,
    fontSize: 13,
  },
  searchResults: {
    gap: 6,
  },
  searchItem: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  searchItemTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  searchItemMeta: {
    fontSize: 11,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  interestChip: {
    flexBasis: '48%',
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
  },
  equalChip: {
    flexGrow: 1,
  },
  chipCheck: {
    marginLeft: 'auto',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#176b58',
    borderRadius: 18,
    paddingHorizontal: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.48,
  },
  buttonIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    paddingHorizontal: 3,
  },
  privacyText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
});
