export function getCityWalkTheme(isDark: boolean) {
  return {
    page: isDark ? '#101a1c' : '#f3f5f1',
    surface: isDark ? '#1b292a' : '#ffffff',
    subtle: isDark ? '#223433' : '#f2f6f2',
    line: isDark ? '#344845' : '#e3ebe5',
    text: isDark ? '#edf4ef' : '#18332d',
    muted: isDark ? '#a7bcb3' : '#72877d',
    accent: isDark ? '#91d7bd' : '#176b58',
    accentSoft: isDark ? '#284b40' : '#e2f1e7',
    hero: isDark ? '#213f37' : '#174c40',
  };
}
