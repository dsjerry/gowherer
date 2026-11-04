import { StyleSheet, Text, View } from 'react-native';

import { useI18n } from '@/hooks/locale-preference';
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

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{t('cityWalk.webUnsupported')}</Text>
      <Text style={styles.line}>
        {t('cityWalk.originLabel')}:{' '}
        {(plan.origin.label ?? '-') +
          ` (${plan.origin.latitude.toFixed(5)}, ${plan.origin.longitude.toFixed(5)})`}
      </Text>
      <Text style={styles.line}>
        {t('cityWalk.stopCount')}: {plan.stops.length}
      </Text>
      <Text style={styles.line} numberOfLines={2}>
        {plan.stops.map((stop) => `${stop.order}. ${stop.poi.name}`).join(' → ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    gap: 6,
  },
  title: {
    color: '#0f172a',
    fontWeight: '700',
  },
  line: {
    color: '#334155',
    fontSize: 12,
  },
});
