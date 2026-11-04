import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCityWalkDistance } from '@/lib/city-walk-format';
import { CityWalkPlan } from '@/types/city-walk';

type Props = {
  plans: CityWalkPlan[];
  currentPlanId?: string;
  onOpen: (plan: CityWalkPlan) => void;
  onDelete: (planId: string) => void;
};

export function CityWalkSavedList({ plans, currentPlanId, onOpen, onDelete }: Props) {
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

  return (
    <View style={[styles.card, cardStyle]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderTitle}>
          <View style={[styles.sectionIcon, { backgroundColor: isDark ? '#173c3a' : '#e4f2ec' }]}>
            <MaterialIcons name="bookmark" size={16} color={isDark ? '#5eead4' : '#0f766e'} />
          </View>
          <Text style={[styles.sectionTitle, titleStyle]}>{t('cityWalk.savedTitle')}</Text>
        </View>
        {plans.length > 0 ? (
          <View style={[styles.countBadge, { backgroundColor: isDark ? '#26383a' : '#edf3ef' }]}>
            <Text style={[styles.countBadgeText, { color: isDark ? '#cbd9d2' : '#587067' }]}>
              {plans.length}
            </Text>
          </View>
        ) : null}
      </View>
      {plans.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="map" size={20} color={isDark ? '#73868a' : '#8a9a92'} />
          <Text style={[styles.empty, hintStyle]}>{t('cityWalk.savedEmpty')}</Text>
        </View>
      ) : (
        plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          return (
            <View key={plan.id} style={[styles.item, itemStyle, isCurrent && styles.itemCurrent]}>
              <Pressable
                style={styles.itemMain}
                onPress={() => onOpen(plan)}
                accessibilityRole="button"
              >
                <Text style={[styles.itemTitle, titleStyle]} numberOfLines={1}>
                  {plan.title || t('cityWalk.defaultPlanTitle', { count: plan.stops.length })}
                </Text>
                <Text style={[styles.itemMeta, hintStyle]} numberOfLines={1}>
                  {[
                    t('cityWalk.savedMeta', {
                      count: plan.stops.length,
                      distance: formatCityWalkDistance(plan.totalDistanceMeters),
                      minutes: plan.estimatedTotalMinutes,
                    }),
                    plan.linkedJourneyId ? t('cityWalk.linkedJourney') : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => onDelete(plan.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('cityWalk.delete')}
              >
                <MaterialIcons name="delete-outline" size={18} color="#94a3b8" />
              </Pressable>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  sectionIcon: {
    width: 31,
    height: 31,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  countBadge: {
    minWidth: 27,
    height: 27,
    borderRadius: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyState: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 12,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: 'rgba(128,150,138,0.08)',
  },
  empty: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemCurrent: {
    borderColor: '#0f766e',
    borderWidth: 1.5,
  },
  itemMain: {
    flex: 1,
    gap: 3,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  itemMeta: {
    fontSize: 11,
  },
});
