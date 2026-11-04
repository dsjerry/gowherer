/** City Walk 卡片共用的数值格式化（列表与预览页保持一致） */

export function formatCityWalkDistance(meters: number) {
  if (!Number.isFinite(meters) || meters <= 0) {
    return '0 m';
  }
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}

export function formatCityWalkMinutes(totalMinutes: number) {
  const safeMinutes = Number.isFinite(totalMinutes) ? Math.max(0, Math.round(totalMinutes)) : 0;
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  if (hours <= 0) {
    return `${minutes} min`;
  }
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}
