export type ReportTemplateId = 'classic' | 'compact' | 'premium';

export const REPORT_TEMPLATES: ReportTemplateId[] = ['classic', 'compact', 'premium'];

export const DEFAULT_REPORT_TEMPLATE: ReportTemplateId = 'classic';

export const REPORT_TEMPLATE_META: Record<ReportTemplateId, { nameKey: string; descKey: string }> =
  {
    classic: { nameKey: 'review.templateClassic', descKey: 'review.templateClassicDesc' },
    compact: { nameKey: 'review.templateCompact', descKey: 'review.templateCompactDesc' },
    premium: { nameKey: 'review.templatePremium', descKey: 'review.templatePremiumDesc' },
  };

export function isReportTemplateId(value: unknown): value is ReportTemplateId {
  return value === 'classic' || value === 'compact' || value === 'premium';
}
