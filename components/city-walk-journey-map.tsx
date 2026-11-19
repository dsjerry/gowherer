import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CityWalkMap } from '@/components/city-walk-map';
import { getCityWalkTheme } from '@/components/city-walk-theme';
import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { CityWalkPlan } from '@/types/city-walk';
import { TimelineLocation } from '@/types/journey';

type Props = {
  plan: CityWalkPlan;
  /** 当前旅程实际记录到的 GPS 轨迹 */
  walkedTrack: TimelineLocation[];
  /** 打开全屏地图（可自由拖动 / 缩放） */
  onOpenMap?: () => void;
  /** 打开完整方案（途经点、推荐理由等） */
  onOpenPlan?: () => void;
};

/** 旅程记录页的漫步路线卡：计划路线 + 实时位置 + 已走轨迹 */
export function CityWalkJourneyMap({ plan, walkedTrack, onOpenMap, onOpenPlan }: Props) {
  const { t } = useI18n();
  const theme = getCityWalkTheme(useColorScheme() === 'dark');

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <Pressable
        style={styles.header}
        onPress={onOpenPlan}
        disabled={!onOpenPlan}
        accessibilityRole={onOpenPlan ? 'button' : undefined}
        accessibilityLabel={onOpenPlan ? t('cityWalk.openPlan') : undefined}
      >
        <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}>
          <MaterialIcons name="route" size={18} color={theme.accent} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.overline, { color: theme.accent }]}>{t('cityWalk.walkingNow')}</Text>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {plan.title || t('cityWalk.defaultPlanTitle', { count: plan.stops.length })}
          </Text>
        </View>
        <View style={[styles.count, { backgroundColor: theme.subtle }]}>
          <Text style={[styles.countText, { color: theme.muted }]}>
            {t('cityWalk.stopCountValue', { count: plan.stops.length })}
          </Text>
        </View>
        {onOpenPlan ? <MaterialIcons name="chevron-right" size={20} color={theme.muted} /> : null}
      </Pressable>

      <CityWalkMap plan={plan} walkedTrack={walkedTrack} onOpenFullscreen={onOpenMap} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 3,
  },
  overline: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  count: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
