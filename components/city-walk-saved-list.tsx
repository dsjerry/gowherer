import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getCityWalkTheme } from '@/components/city-walk-theme';
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

  const theme = getCityWalkTheme(isDark);
  const titleStyle = { color: theme.text };
  const hintStyle = { color: theme.muted };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderTitle}>
          <Text style={[styles.overline, { color: theme.accent }]}>YOUR COLLECTION</Text>
          <Text style={[styles.sectionTitle, titleStyle]}>{t('cityWalk.savedTitle')}</Text>
          <Text style={[styles.sectionHint, hintStyle]}>{t('cityWalk.savedHint')}</Text>
        </View>
        {plans.length > 0 ? (
          <View style={[styles.countBadge, { backgroundColor: theme.accentSoft }]}>
            <Text style={[styles.countBadgeText, { color: theme.accent }]}>{plans.length}</Text>
          </View>
        ) : null}
      </View>
      {plans.length === 0 ? (
        <View
          style={[styles.emptyState, { backgroundColor: theme.surface, borderColor: theme.line }]}
        >
          <View style={[styles.itemIcon, { backgroundColor: theme.subtle }]}>
            <MaterialIcons name="bookmark-border" size={22} color={theme.muted} />
          </View>
          <Text style={[styles.empty, hintStyle]}>{t('cityWalk.savedEmpty')}</Text>
        </View>
      ) : (
        plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          return (
            <View
              key={plan.id}
              style={[
                styles.item,
                {
                  backgroundColor: theme.surface,
                  borderColor: isCurrent ? theme.accent : theme.line,
                },
              ]}
            >
              <Pressable
                style={styles.itemMain}
                onPress={() => onOpen(plan)}
                accessibilityRole="button"
              >
                <View style={[styles.itemIcon, { backgroundColor: theme.accentSoft }]}>
                  <MaterialIcons name="route" size={22} color={theme.accent} />
                </View>
                <View style={styles.itemCopy}>
                  <Text style={[styles.itemTitle, titleStyle]} numberOfLines={2}>
                    {plan.title || t('cityWalk.defaultPlanTitle', { count: plan.stops.length })}
                  </Text>
                  <Text style={[styles.itemMeta, hintStyle]} numberOfLines={2}>
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
                </View>
              </Pressable>
              <Pressable
                onPress={() => onDelete(plan.id)}
                hitSlop={8}
                style={styles.deleteButton}
                accessibilityRole="button"
                accessibilityLabel={t('cityWalk.delete')}
              >
                <MaterialIcons name="delete-outline" size={19} color={theme.muted} />
              </Pressable>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
    paddingTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderTitle: {
    gap: 9,
  },
  overline: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionHint: {
    fontSize: 12,
    lineHeight: 17,
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
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
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
    borderRadius: 18,
    padding: 12,
  },
  itemMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCopy: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  itemMeta: {
    fontSize: 11,
    lineHeight: 16,
  },
  deleteButton: {
    width: 36,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
