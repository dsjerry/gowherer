const fs = require('fs');
const path = require('path');
const checker = require('license-checker');

const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'assets');
const outputPath = path.join(outputDir, 'licenses.json');

const packageJson = require(path.join(rootDir, 'package.json'));
const directDependencyNames = new Set(Object.keys(packageJson.dependencies ?? {}));

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function pickLicenseText(data) {
  if (data.licenseText) {
    return data.licenseText;
  }
  if (Array.isArray(data.licenses)) {
    return data.licenses.join(', ');
  }
  return data.licenses ?? 'Unknown';
}

checker.init(
  {
    start: rootDir,
    production: true,
    json: true,
    excludePrivatePackages: true,
    customFormat: {
      name: '',
      version: '',
      licenses: '',
      repository: '',
      publisher: '',
      licenseText: '',
      licenseFile: '',
      copyright: '',
    },
  },
  (error, packages) => {
    if (error) {
      console.error(error);
      process.exit(1);
    }

    const entries = Object.entries(packages)
      .map(([key, info]) => {
        // Keys look like `name@version`, where `name` may itself be scoped
        // (`@scope/name@version`), so split on the last `@`.
        const atIndex = key.lastIndexOf('@');
        const fallbackName = atIndex > 0 ? key.slice(0, atIndex) : key;
        const fallbackVersion = atIndex > 0 ? key.slice(atIndex + 1) : '';
        const name = info.name || fallbackName;
        return {
          name,
          version: info.version || fallbackVersion,
          licenses: info.licenses ?? 'Unknown',
          licenseText: pickLicenseText(info),
          repository: info.repository || '',
          publisher: info.publisher || '',
          direct: directDependencyNames.has(name),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    fs.writeFileSync(
      outputPath,
      JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2),
    );
    console.log(`Saved licenses to ${outputPath}`);
  },
);
