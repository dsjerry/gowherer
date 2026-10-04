/**
 * Static catalog of the licenses of everything bundled into the app.
 *
 * `assets/licenses.json` is produced by `scripts/generate-licenses.js` from the
 * full production dependency tree (`license-checker`), because the app ships
 * every transitive dependency inside the JS bundle — not just the packages
 * listed under `dependencies` in `package.json`.
 */

export type LicenseDependency = {
  name: string;
  version: string;
  /** SPDX-ish license id(s), used for grouping and filtering. */
  licenseType: string;
  licenseText: string;
  repository: string;
  /** Listed under `dependencies` in package.json. */
  direct: boolean;
};

export type LicenseTypeSummary = {
  type: string;
  count: number;
};

type RawEntry = {
  name?: string;
  version?: string;
  licenses?: string | string[];
  licenseText?: string;
  repository?: string;
  direct?: boolean;
};

const licenseData = require('../assets/licenses.json') as {
  generatedAt?: string;
  entries?: RawEntry[];
};

function normalizeLicense(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return value ?? 'Unknown';
}

export const licenseGeneratedAt: string | undefined = licenseData.generatedAt;

/** Entries sorted by package name, as written by the generator. */
export const licenseDependencies: LicenseDependency[] = (licenseData.entries ?? []).map(
  (entry) => {
    const licenseType = normalizeLicense(entry.licenses);
    return {
      name: entry.name ?? 'Unknown',
      version: entry.version ?? '-',
      licenseType,
      licenseText: entry.licenseText || licenseType,
      repository: entry.repository ?? '',
      direct: entry.direct === true,
    };
  }
);

const licenseTypeCounts = new Map<string, number>();
for (const dependency of licenseDependencies) {
  licenseTypeCounts.set(
    dependency.licenseType,
    (licenseTypeCounts.get(dependency.licenseType) ?? 0) + 1
  );
}

/** Distinct license types, most common first. */
export const licenseTypes: LicenseTypeSummary[] = [...licenseTypeCounts]
  .map(([type, count]) => ({ type, count }))
  .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));

export const licenseDirectCount = licenseDependencies.filter((item) => item.direct).length;
export const licenseTransitiveCount = licenseDependencies.length - licenseDirectCount;

export function matchesLicenseFilter(
  dependency: LicenseDependency,
  filters: { query: string; licenseType: string | null }
): boolean {
  if (filters.licenseType && dependency.licenseType !== filters.licenseType) {
    return false;
  }
  const query = filters.query.trim().toLowerCase();
  return query === '' || dependency.name.toLowerCase().includes(query);
}
