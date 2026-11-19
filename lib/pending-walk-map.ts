import { CityWalkPlan } from '@/types/city-walk';

/**
 * 打开全屏地图时的一次性方案交接。
 * 方案可能还没保存（新生成、未点保存），无法只靠 planId 路由参数还原，
 * 因此像 pending-location 一样在内存里传递一次，读取后即清空。
 */
let pendingPlan: CityWalkPlan | null = null;

export function setPendingWalkMapPlan(plan: CityWalkPlan) {
  pendingPlan = plan;
}

export function consumePendingWalkMapPlan(): CityWalkPlan | null {
  const plan = pendingPlan;
  pendingPlan = null;
  return plan;
}
