import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

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
  chipStyle: StyleProp<ViewStyle>;
  chipTextStyle: StyleProp<TextStyle>;
  onPress: () => void;
};

/** 时长/兴趣/节奏/路线形状共用同一套 chip 交互（含无障碍选中态） */
function OptionChip({ label, active, chipStyle, chipTextStyle, onPress }: OptionChipProps) {
  return (
    <Pressable
      style={[styles.chip, chipStyle, active && styles.chipActive]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, chipTextStyle, active && styles.chipTextActive]}>{label}</Text>
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

  const accent = isDark ? '#5eead4' : '#0f766e';
  const themedCard = {
    backgroundColor: isDark ? '#17232b' : '#ffffff',
    borderColor: isDark ? '#293b42' : '#e3e9e5',
  };
  const titleStyle = { color: isDark ? '#e2e8f0' : '#10231f' };
  const hintStyle = { color: isDark ? '#94a3b8' : '#75827d' };
  const inputStyle = {
    backgroundColor: isDark ? '#101b22' : '#f7f9f7',
    borderColor: isDark ? '#2b3d43' : '#e1e8e3',
    color: isDark ? '#e2e8f0' : '#10231f',
  };
  const itemStyle = {
    backgroundColor: isDark ? '#101b22' : '#f7f9f7',
    borderColor: isDark ? '#293b42' : '#e3e9e5',
  };
  const itemTitleStyle = { color: isDark ? '#e2e8f0' : '#0f172a' };
  const itemSubStyle = { color: isDark ? '#94a3b8' : '#64748b' };
  const chipStyle = {
    backgroundColor: isDark ? '#101b22' : '#f1f4f2',
    borderColor: isDark ? '#293b42' : '#e0e7e2',
  };
  const chipTextStyle = { color: isDark ? '#cbd5e1' : '#34453f' };
  const placeholderColor = isDark ? '#84959b' : '#87938e';

  const canGenerate = Boolean(origin) && preferences.interests.length > 0;

  return (
    <View style={[styles.card, themedCard]}>
      <View style={styles.cardIntro}>
        <View style={[styles.introIcon, { backgroundColor: isDark ? '#173c3a' : '#e4f2ec' }]}>
          <MaterialIcons name="directions-walk" size={22} color={accent} />
        </View>
        <View style={styles.introCopy}>
          <Text style={[styles.sectionTitle, titleStyle]}>{t('cityWalk.configTitle')}</Text>
          <Text style={[styles.sectionHint, hintStyle]}>{t('cityWalk.configHint')}</Text>
        </View>
      </View>

      {/* 起点 */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, hintStyle]}>{t('cityWalk.originLabel')}</Text>
        <View style={[styles.originRow, itemStyle]}>
          <MaterialIcons name="place" size={18} color={accent} />
          <Text style={[styles.originText, itemTitleStyle]} numberOfLines={2}>
            {origin
              ? `${origin.label ?? t('cityWalk.originUnnamed')} (${origin.latitude.toFixed(
                  5,
                )}, ${origin.longitude.toFixed(5)})`
              : t('cityWalk.originEmpty')}
          </Text>
          {origin ? (
            <Pressable onPress={onClearOrigin} accessibilityRole="button" hitSlop={8}>
              <MaterialIcons name="close" size={16} color={isDark ? '#94a3b8' : '#64748b'} />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.originActions}>
          <Pressable
            style={[styles.smallButton, chipStyle]}
            onPress={onLocate}
            disabled={locating}
            accessibilityRole="button"
          >
            {locating ? (
              <ActivityIndicator size="small" />
            ) : (
              <MaterialIcons name="my-location" size={15} color={accent} />
            )}
            <Text style={[styles.smallButtonText, chipTextStyle]}>
              {locating ? t('cityWalk.locating') : t('cityWalk.useCurrentLocation')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.smallButton, chipStyle]}
            onPress={onOpenMapPicker}
            accessibilityRole="button"
          >
            <MaterialIcons name="map" size={15} color={accent} />
            <Text style={[styles.smallButtonText, chipTextStyle]}>{t('cityWalk.mapPick')}</Text>
          </Pressable>
        </View>

        {/* 地点搜索 */}
        <View style={[styles.searchShell, inputStyle]}>
          <MaterialIcons name="search" size={17} color={placeholderColor} />
          <TextInput
            value={search.keyword}
            onChangeText={search.setKeyword}
            placeholder={t('cityWalk.searchPlaceholder')}
            placeholderTextColor={placeholderColor}
            style={[styles.searchInput, { color: inputStyle.color }]}
            returnKeyType="search"
            autoCorrect={false}
          />
          {search.searching ? <ActivityIndicator size="small" /> : null}
        </View>
        {search.results ? (
          <View style={styles.searchResults}>
            {search.results.length === 0 ? (
              <Text style={[styles.sectionHint, hintStyle]}>
                {search.failed ? t('cityWalk.searchFailed') : t('cityWalk.searchEmpty')}
              </Text>
            ) : (
              search.results.slice(0, 5).map((place) => (
                <Pressable
                  key={place.id}
                  style={[styles.searchItem, itemStyle]}
                  onPress={() => onSelectPlace(place)}
                  accessibilityRole="button"
                >
                  <Text style={[styles.searchItemTitle, itemTitleStyle]} numberOfLines={1}>
                    {place.name}
                  </Text>
                  <Text style={[styles.searchItemMeta, itemSubStyle]} numberOfLines={1}>
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

      {/* 可用时长 */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, hintStyle]}>{t('cityWalk.durationLabel')}</Text>
        <View style={styles.chipRow}>
          {DURATION_OPTIONS.map((minutes) => (
            <OptionChip
              key={minutes}
              label={t('duration.minutes', { minutes })}
              active={preferences.durationMinutes === minutes}
              chipStyle={chipStyle}
              chipTextStyle={chipTextStyle}
              onPress={() => onDurationChange(minutes)}
            />
          ))}
        </View>
      </View>

      {/* 兴趣主题 */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, hintStyle]}>{t('cityWalk.interestsLabel')}</Text>
        <View style={styles.chipRow}>
          {CITY_WALK_INTERESTS.map((interest) => (
            <OptionChip
              key={interest}
              label={t(`cityWalk.interest.${interest}`)}
              active={preferences.interests.includes(interest)}
              chipStyle={chipStyle}
              chipTextStyle={chipTextStyle}
              onPress={() => onToggleInterest(interest)}
            />
          ))}
        </View>
        <Text style={[styles.sectionHint, hintStyle]}>{t('cityWalk.interestsHint')}</Text>
      </View>

      {/* 步行节奏 + 路线形状 */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, hintStyle]}>{t('cityWalk.paceLabel')}</Text>
        <View style={styles.chipRow}>
          {CITY_WALK_PACES.map((pace) => (
            <OptionChip
              key={pace}
              label={t(`cityWalk.pace.${pace}`)}
              active={preferences.pace === pace}
              chipStyle={chipStyle}
              chipTextStyle={chipTextStyle}
              onPress={() => onPaceChange(pace)}
            />
          ))}
        </View>
      </View>

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, hintStyle]}>{t('cityWalk.shapeLabel')}</Text>
        <View style={styles.chipRow}>
          {CITY_WALK_ROUTE_SHAPES.map((shape) => (
            <OptionChip
              key={shape}
              label={t(`cityWalk.shape.${shape}`)}
              active={preferences.routeShape === shape}
              chipStyle={chipStyle}
              chipTextStyle={chipTextStyle}
              onPress={() => onRouteShapeChange(shape)}
            />
          ))}
        </View>
        <Text style={[styles.sectionHint, hintStyle]}>
          {t('cityWalk.maxStopsHint', { count: preferences.maxStops })}
        </Text>
      </View>

      <Pressable
        style={[styles.primaryButton, !canGenerate && styles.primaryButtonDisabled]}
        onPress={onGenerate}
        disabled={!canGenerate}
        accessibilityRole="button"
      >
        <Text style={styles.primaryButtonText}>{t('cityWalk.generate')}</Text>
        <MaterialIcons name="auto-awesome" size={18} color="#ffffff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 19,
    borderWidth: 1,
    gap: 15,
    shadowColor: '#1a382f',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.025,
    shadowRadius: 7,
    elevation: 1,
  },
  cardIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  introIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introCopy: {
    flex: 1,
    gap: 3,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.25,
  },
  sectionHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  originRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  originText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  originActions: {
    flexDirection: 'row',
    gap: 8,
  },
  smallButton: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  smallButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  searchShell: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 15,
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
    borderWidth: 1,
    borderRadius: 14,
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
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: '#0f766e',
    borderColor: '#0f766e',
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#ffffff',
  },
  primaryButton: {
    minHeight: 54,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0f766e',
    borderRadius: 16,
    paddingVertical: 14,
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 7,
    elevation: 1,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
