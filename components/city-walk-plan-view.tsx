import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { CityWalkMap } from '@/components/city-walk-map';
import { getCityWalkTheme } from '@/components/city-walk-theme';
import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCityWalkDistance, formatCityWalkMinutes } from '@/lib/city-walk-format';
import { CityWalkBusyKind, CityWalkPlan } from '@/types/city-walk';

type Props = {
  plan: CityWalkPlan;
  busy: CityWalkBusyKind;
  isSaved: boolean;
  /** 地图放大后的目标高度 */
  expandedMapHeight: number;
  onMapEnlargedChange: (enlarged: boolean) => void;
  onRemoveStop: (poiId: string) => void;
  onAdjustPreferences: () => void;
  onSave: () => void;
  onStartWalk: () => void;
};

export function CityWalkPlanView({
  plan,
  busy,
  isSaved,
  expandedMapHeight,
  onMapEnlargedChange,
  onRemoveStop,
  onAdjustPreferences,
  onSave,
  onStartWalk,
}: Props) {
  const { t } = useI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme = getCityWalkTheme(isDark);
  const cardStyle = { backgroundColor: theme.surface, borderColor: theme.line };
  const titleStyle = { color: theme.text };
  const hintStyle = { color: theme.muted };
  const itemStyle = { backgroundColor: theme.subtle, borderColor: theme.line };
  const disabled = busy !== null;

  return (
    <View style={styles.section}>
      <View style={[styles.card, cardStyle]}>
        <CityWalkMap
          plan={plan}
          expandedHeight={expandedMapHeight}
          onEnlargedChange={onMapEnlargedChange}
        />
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={[styles.overline, { color: theme.accent }]}>
              {t('cityWalk.routeOverview')}
            </Text>
            <Text style={[styles.title, titleStyle]}>
              {plan.title || t('cityWalk.defaultPlanTitle', { count: plan.stops.length })}
            </Text>
            {plan.summary ? <Text style={[styles.summary, hintStyle]}>{plan.summary}</Text> : null}
          </View>
          {plan.aiModel ? (
            <View style={[styles.aiBadge, { backgroundColor: theme.accentSoft }]}>
              <MaterialIcons name="auto-awesome" size={11} color={theme.accent} />
              <Text style={[styles.aiBadgeText, { color: theme.accent }]}>AI</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={[styles.statLabel, hintStyle]}>{t('cityWalk.totalDistance')}</Text>
            <Text style={[styles.statValue, titleStyle]}>
              {formatCityWalkDistance(plan.totalDistanceMeters)}
            </Text>
          </View>
          <View style={[styles.statCell, styles.statDivider, { borderColor: theme.line }]}>
            <Text style={[styles.statLabel, hintStyle]}>{t('cityWalk.walkingTime')}</Text>
            <Text style={[styles.statValue, titleStyle]}>
              {formatCityWalkMinutes(plan.walkingDurationSeconds / 60)}
            </Text>
          </View>
          <View style={[styles.statCell, styles.statDivider, { borderColor: theme.line }]}>
            <Text style={[styles.statLabel, hintStyle]}>{t('cityWalk.totalTime')}</Text>
            <Text style={[styles.statValue, titleStyle]}>
              {formatCityWalkMinutes(plan.estimatedTotalMinutes)}
            </Text>
          </View>
        </View>

        {plan.truncatedStops ? (
          <View style={[styles.notice, { backgroundColor: isDark ? '#3b2f14' : '#fdf6e3' }]}>
            <MaterialIcons name="info-outline" size={14} color={isDark ? '#fbbf24' : '#b45309'} />
            <Text style={[styles.noticeText, { color: isDark ? '#fbbf24' : '#92400e' }]}>
              {t('cityWalk.truncated', { count: plan.truncatedStops })}
            </Text>
          </View>
        ) : null}
        {plan.overBudget ? (
          <View style={[styles.notice, { backgroundColor: isDark ? '#3b1f1f' : '#fdecec' }]}>
            <MaterialIcons name="schedule" size={14} color={isDark ? '#fca5a5' : '#b91c1c'} />
            <Text style={[styles.noticeText, { color: isDark ? '#fca5a5' : '#991b1b' }]}>
              {t('cityWalk.overBudget')}
            </Text>
          </View>
        ) : null}

        {busy === 'recalculating' ? (
          <View style={styles.busyRow}>
            <ActivityIndicator size="small" />
            <Text style={[styles.summary, hintStyle]}>{t('cityWalk.recalculating')}</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.card, cardStyle]}>
        <View style={styles.stopsHeading}>
          <View style={styles.stopsHeadingTitle}>
            <Text style={[styles.overline, { color: theme.accent }]}>THE WALK</Text>
            <Text style={[styles.sectionTitle, titleStyle]}>{t('cityWalk.routeItinerary')}</Text>
          </View>
          <View style={[styles.stopsCount, { backgroundColor: theme.accentSoft }]}>
            <Text style={[styles.stopsCountText, { color: theme.accent }]}>
              {t('cityWalk.stopCountValue', { count: plan.stops.length })}
            </Text>
          </View>
        </View>
        <View style={styles.originRow}>
          <View style={[styles.originBadge, { backgroundColor: theme.accentSoft }]}>
            <MaterialIcons name="near-me" size={15} color={theme.accent} />
          </View>
          <View style={styles.stopCopy}>
            <Text style={[styles.originLabel, hintStyle]}>{t('cityWalk.originLabel')}</Text>
            <Text style={[styles.originName, titleStyle]} numberOfLines={2}>
              {plan.origin.label ?? t('cityWalk.originUnnamed')}
            </Text>
          </View>
        </View>
        {plan.stops.map((stop, index) => (
          <View key={stop.poi.poiId} style={styles.stopCard}>
            <View
              pointerEvents="none"
              style={[
                styles.routeLine,
                { backgroundColor: theme.line },
                index === plan.stops.length - 1 && styles.routeLineLast,
              ]}
            />
            <View style={styles.stopHeader}>
              <View style={[styles.orderBadge, { backgroundColor: theme.hero }]}>
                <Text style={styles.orderBadgeText}>{stop.order}</Text>
              </View>
              <View style={styles.stopCopy}>
                <Text style={[styles.stopName, titleStyle]} numberOfLines={2}>
                  {stop.poi.name}
                </Text>
                <Text style={[styles.stopMeta, hintStyle]} numberOfLines={2}>
                  {[
                    stop.poi.category,
                    stop.poi.address,
                    typeof stop.poi.distanceFromOriginMeters === 'number'
                      ? t('cityWalk.distanceFromOrigin', {
                          distance: formatCityWalkDistance(stop.poi.distanceFromOriginMeters),
                        })
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <Pressable
                style={[styles.removeStopButton, { backgroundColor: theme.subtle }]}
                onPress={() => onRemoveStop(stop.poi.poiId)}
                disabled={disabled}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('cityWalk.removeStop')}
              >
                <MaterialIcons name="delete-outline" size={18} color={theme.muted} />
              </Pressable>
            </View>
            <View style={styles.stopFooter}>
              <View style={[styles.stayPill, { backgroundColor: theme.accentSoft }]}>
                <MaterialIcons name="hourglass-empty" size={11} color={theme.accent} />
                <Text style={[styles.stayPillText, { color: theme.accent }]}>
                  {t('cityWalk.stayMinutes', { minutes: stop.suggestedStayMinutes })}
                </Text>
              </View>
              {stop.reason ? (
                <Text style={[styles.reason, hintStyle]}>
                  {t('cityWalk.aiReason')}: {stop.reason}
                </Text>
              ) : null}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actionArea}>
        <Pressable
          style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
          onPress={onStartWalk}
          disabled={disabled}
          accessibilityRole="button"
        >
          {busy === 'starting' ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <MaterialIcons name="directions-walk" size={20} color="#ffffff" />
          )}
          <Text style={styles.primaryButtonText}>
            {busy === 'starting' ? t('cityWalk.starting') : t('cityWalk.startWalk')}
          </Text>
          <MaterialIcons name="arrow-forward" size={19} color="#ffffff" />
        </Pressable>
        <View style={styles.actions}>
          <Pressable
            style={[styles.secondaryButton, itemStyle]}
            onPress={onAdjustPreferences}
            disabled={disabled}
            accessibilityRole="button"
          >
            <MaterialIcons name="tune" size={16} color={theme.text} />
            <Text style={[styles.secondaryButtonText, titleStyle]}>
              {t('cityWalk.adjustPreferences')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, itemStyle]}
            onPress={onSave}
            disabled={disabled || isSaved}
            accessibilityRole="button"
          >
            {busy === 'saving' ? (
              <ActivityIndicator size="small" />
            ) : (
              <MaterialIcons
                name={isSaved ? 'bookmark' : 'bookmark-border'}
                size={16}
                color={theme.text}
              />
            )}
            <Text style={[styles.secondaryButtonText, titleStyle]}>
              {busy === 'saving'
                ? t('common.saving')
                : isSaved
                  ? t('cityWalk.saved')
                  : t('cityWalk.save')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 16,
  },
  card: {
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  headerCopy: {
    flex: 1,
    gap: 7,
  },
  overline: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: -0.5,
  },
  summary: {
    fontSize: 13,
    lineHeight: 20,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  statCell: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 9,
    gap: 6,
  },
  statDivider: {
    borderLeftWidth: 1,
  },
  statLabel: {
    fontSize: 11,
    lineHeight: 15,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '800',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  stopsHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stopsHeadingTitle: {
    gap: 5,
  },
  stopsCount: {
    minHeight: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  stopsCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stopCard: {
    position: 'relative',
    gap: 8,
  },
  routeLine: {
    position: 'absolute',
    left: 16,
    top: -20,
    bottom: -20,
    width: 1,
  },
  routeLineLast: {
    bottom: undefined,
    height: 38,
  },
  originRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  originBadge: {
    width: 33,
    height: 33,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  originLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  originName: {
    fontSize: 13,
    fontWeight: '700',
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  orderBadge: {
    width: 33,
    height: 33,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orderBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  stopCopy: {
    flex: 1,
    gap: 3,
  },
  stopName: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
  },
  stopMeta: {
    fontSize: 11,
    lineHeight: 16,
  },
  removeStopButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopFooter: {
    marginLeft: 45,
    paddingBottom: 5,
    gap: 8,
  },
  stayPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  stayPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  reason: {
    fontSize: 12,
    lineHeight: 19,
  },
  actionArea: {
    gap: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 14,
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  primaryButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#176b58',
    borderRadius: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
