import { CityWalkErrorCode, CityWalkErrorInfo } from '@/types/city-walk';

/** City Walk 流程内的可分类错误，UI 依据 code 展示对应文案 */
export class CityWalkError extends Error {
  readonly code: CityWalkErrorCode;
  readonly detail?: string;

  constructor(code: CityWalkErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'CityWalkError';
    this.code = code;
    this.detail = detail;
  }
}

export function isCityWalkError(error: unknown): error is CityWalkError {
  return error instanceof CityWalkError;
}

export function toCityWalkErrorInfo(error: unknown): CityWalkErrorInfo {
  if (isCityWalkError(error)) {
    return { code: error.code, detail: error.detail };
  }
  if (error instanceof Error) {
    return { code: 'unknown', detail: error.message };
  }
  return { code: 'unknown', detail: String(error) };
}

export function isAbortError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    ((error as { name?: unknown }).name === 'AbortError' ||
      (error as { name?: unknown }).name === 'TimeoutError')
  );
}

/** 错误码 -> i18n key，聊天页/状态卡片/弹窗共用同一套文案 */
export function getCityWalkErrorI18nKey(code: CityWalkErrorCode) {
  switch (code) {
    case 'missing-web-key':
      return 'cityWalk.error.missingKey';
    case 'no-candidates':
      return 'cityWalk.error.noCandidates';
    case 'amap-error':
      return 'cityWalk.error.amap';
    case 'amap-rate-limited':
      return 'cityWalk.error.amapRateLimited';
    case 'network':
      return 'cityWalk.error.network';
    case 'location-denied':
      return 'cityWalk.error.locationDenied';
    case 'location-failed':
      return 'cityWalk.error.locationFailed';
    case 'ai-not-configured':
      return 'cityWalk.error.aiNotConfigured';
    case 'ai-failed':
      return 'cityWalk.error.aiFailed';
    case 'ai-invalid-output':
      return 'cityWalk.error.aiInvalid';
    case 'route-failed':
      return 'cityWalk.error.routeFailed';
    case 'active-journey':
      return 'cityWalk.error.activeJourney';
    case 'cancelled':
      return 'cityWalk.error.cancelled';
    case 'timeout':
      return 'cityWalk.error.timeout';
    default:
      return 'cityWalk.error.unknown';
  }
}
