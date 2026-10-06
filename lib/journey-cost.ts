import { Journey, JourneyCostMode } from '@/types/journey';

export const JOURNEY_COST_MODES: JourneyCostMode[] = [
  'metro',
  'rail',
  'bus',
  'taxi',
  'flight',
  'other',
];

/** 旅程交通费合计（元），对条目上的 cost 求和，避免浮点误差 */
export function sumJourneyCosts(journey: Journey): number {
  return (
    Math.round(journey.entries.reduce((sum, entry) => sum + (entry.cost?.amount ?? 0), 0) * 100) /
    100
  );
}

/** 金额展示：整数不带小数，非整数保留两位 */
export function formatCostAmount(amount: number): string {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
}
