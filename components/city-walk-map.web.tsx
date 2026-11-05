import { StyleSheet, Text, View } from 'react-native';

import { getCityWalkTheme } from '@/components/city-walk-theme';
import { useI18n } from '@/hooks/locale-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { CityWalkPlan } from '@/types/city-walk';

type Props = {
  plan: CityWalkPlan;
  /** Web 端没有原生地图，放大按钮不生效，仅保持与原生版本一致的接口 */
  expandedHeight: number;
  onEnlargedChange?: (enlarged: boolean) => void;
};

/** Web 端没有原生高德地图，改为展示计划摘要，路线详情见下方站点列表 */
export function CityWalkMap({ plan }: Props) {
  const { t } = useI18n();
  const theme = getCityWalkTheme(useColorScheme() === 'dark');

  return (
    <View style={[styles.box, { backgroundColor: theme.subtle, borderColor: theme.line }]}>
      <Text style={[styles.title, { color: theme.text }]}>{t('cityWalk.webUnsupported')}</Text>
      <Text style={[styles.line, { color: theme.muted }]}>
        {t('cityWalk.originLabel')}:{' '}
        {(plan.origin.label ?? '-') +
          ` (${plan.origin.latitude.toFixed(5)}, ${plan.origin.longitude.toFixed(5)})`}
      </Text>
      <Text style={[styles.line, { color: theme.muted }]}>
        {t('cityWalk.stopCount')}: {plan.stops.length}
      </Text>
      <Text style={[styles.line, { color: theme.muted }]} numberOfLines={2}>
        {plan.stops.map((stop) => `${stop.order}. ${stop.poi.name}`).join(' → ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 8,
  },
  title: {
    fontWeight: '700',
  },
  line: {
    fontSize: 12,
  },
});
