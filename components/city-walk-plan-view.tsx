import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { CityWalkMap } from '@/components/city-walk-map';
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

  const cardStyle = {
    backgroundColor: isDark ? '#17232b' : '#ffffff',
    borderColor: isDark ? '#293b42' : '#e3e9e5',
  };
  const titleStyle = { color: isDark ? '#e2e8f0' : '#10231f' };
  const hintStyle = { color: isDark ? '#94a3b8' : '#75827d' };
  const itemStyle = {
    backgroundColor: isDark ? '#101b22' : '#f7f9f7',
    borderColor: isDark ? '#293b42' : '#e0e7e2',
  };
  const disabled = busy !== null;

  return (
    <View style={styles.section}>
      <View style={[styles.card, cardStyle]}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, titleStyle]}>
              {plan.title || t('cityWalk.defaultPlanTitle', { count: plan.stops.length })}
            </Text>
            {plan.summary ? <Text style={[styles.summary, hintStyle]}>{plan.summary}</Text> : null}
          </View>
          {plan.aiModel ? (
            <View style={[styles.aiBadge, { backgroundColor: isDark ? '#173c3a' : '#e4f2ec' }]}>
              <MaterialIcons name="auto-awesome" size={11} color={isDark ? '#5eead4' : '#0f766e'} />
              <Text style={[styles.aiBadgeText, { color: isDark ? '#5eead4' : '#0f766e' }]}>
                AI
              </Text>
            </View>
          ) : null}
        </View>

        <CityWalkMap
          plan={plan}
          expandedHeight={expandedMapHeight}
          onEnlargedChange={onMapEnlargedChange}
        />

        <View style={styles.statsRow}>
          <View style={[styles.statCell, itemStyle]}>
            <Text style={[styles.statLabel, hintStyle]}>{t('cityWalk.totalDistance')}</Text>
            <Text style={[styles.statValue, titleStyle]}>
              {formatCityWalkDistance(plan.totalDistanceMeters)}
            </Text>
          </View>
          <View style={[styles.statCell, itemStyle]}>
            <Text style={[styles.statLabel, hintStyle]}>{t('cityWalk.walkingTime')}</Text>
            <Text style={[styles.statValue, titleStyle]}>
              {formatCityWalkMinutes(plan.walkingDurationSeconds / 60)}
            </Text>
          </View>
          <View style={[styles.statCell, itemStyle]}>
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
            <View
              style={[styles.stopsHeadingIcon, { backgroundColor: isDark ? '#173c3a' : '#e4f2ec' }]}
            >
              <MaterialIcons name="route" size={17} color={isDark ? '#5eead4' : '#0f766e'} />
            </View>
            <Text style={[styles.sectionTitle, titleStyle]}>{t('cityWalk.stopsTitle')}</Text>
          </View>
          <View style={[styles.stopsCount, { backgroundColor: isDark ? '#26383a' : '#edf3ef' }]}>
            <Text style={[styles.stopsCountText, { color: isDark ? '#cbd9d2' : '#587067' }]}>
              {plan.stops.length}
            </Text>
          </View>
        </View>
        {plan.stops.map((stop) => (
          <View key={stop.poi.poiId} style={[styles.stopCard, itemStyle]}>
            <View style={styles.stopHeader}>
              <View style={styles.orderBadge}>
                <Text style={styles.orderBadgeText}>{stop.order}</Text>
              </View>
              <View style={styles.stopCopy}>
                <Text style={[styles.stopName, titleStyle]} numberOfLines={2}>
                  {stop.poi.name}
                </Text>
                <Text style={[styles.stopMeta, hintStyle]} numberOfLines={1}>
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
                style={[
                  styles.removeStopButton,
                  { backgroundColor: isDark ? '#26333a' : '#f0f3f1' },
                ]}
                onPress={() => onRemoveStop(stop.poi.poiId)}
                disabled={disabled}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('cityWalk.removeStop')}
              >
                <MaterialIcons
                  name="delete-outline"
                  size={18}
                  color={isDark ? '#a6b5b5' : '#718078'}
                />
              </Pressable>
            </View>
            <View style={[styles.stopFooter, { borderTopColor: isDark ? '#293b42' : '#e8ede9' }]}>
              <View style={[styles.stayPill, { backgroundColor: isDark ? '#173c3a' : '#e4f2ec' }]}>
                <MaterialIcons
                  name="hourglass-empty"
                  size={11}
                  color={isDark ? '#5eead4' : '#0f766e'}
                />
                <Text style={[styles.stayPillText, { color: isDark ? '#5eead4' : '#0f766e' }]}>
                  {t('cityWalk.stayMinutes', { minutes: stop.suggestedStayMinutes })}
                </Text>
              </View>
              {stop.reason ? (
                <Text style={[styles.reason, hintStyle]} numberOfLines={2}>
                  {t('cityWalk.aiReason')}: {stop.reason}
                </Text>
              ) : null}
            </View>
          </View>
        ))}

        <View style={styles.actions}>
          <Pressable
            style={[styles.secondaryButton, itemStyle]}
            onPress={onAdjustPreferences}
            disabled={disabled}
            accessibilityRole="button"
          >
            <MaterialIcons name="tune" size={16} color={isDark ? '#cbd5e1' : '#34453f'} />
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
                color={isDark ? '#cbd5e1' : '#34453f'}
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

        <Pressable
          style={[styles.primaryButton, disabled && styles.primaryButtonDisabled]}
          onPress={onStartWalk}
          disabled={disabled}
          accessibilityRole="button"
        >
          {busy === 'starting' ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <MaterialIcons name="play-arrow" size={20} color="#ffffff" />
          )}
          <Text style={styles.primaryButtonText}>
            {busy === 'starting' ? t('cityWalk.starting') : t('cityWalk.startWalk')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 14,
  },
  card: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.45,
  },
  summary: {
    fontSize: 12,
    lineHeight: 18,
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
    gap: 8,
  },
  statCell: {
    flex: 1,
    minWidth: 0,
    minHeight: 66,
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 15,
    borderColor: '#e0e7e2',
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 5,
  },
  statLabel: {
    fontSize: 10,
    lineHeight: 14,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '700',
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
    fontSize: 17,
    fontWeight: '700',
  },
  stopsHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  stopsHeadingTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  stopsHeadingIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopsCount: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  stopsCountText: {
    fontSize: 11,
    fontWeight: '700',
  },
  stopCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  orderBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 1,
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
    fontSize: 14,
    fontWeight: '700',
  },
  stopMeta: {
    fontSize: 11,
    lineHeight: 16,
  },
  removeStopButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopFooter: {
    borderTopWidth: 1,
    paddingTop: 9,
    gap: 6,
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
    fontSize: 11,
    lineHeight: 17,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
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
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0f766e',
    borderRadius: 16,
    shadowColor: '#0f766e',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 7,
    elevation: 1,
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
