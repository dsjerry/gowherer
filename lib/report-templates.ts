export type ReportTemplateId = 'classic' | 'compact';

export const REPORT_TEMPLATES: ReportTemplateId[] = ['classic', 'compact'];

export const DEFAULT_REPORT_TEMPLATE: ReportTemplateId = 'classic';

export function isReportTemplateId(value: unknown): value is ReportTemplateId {
  return value === 'classic' || value === 'compact';
}
