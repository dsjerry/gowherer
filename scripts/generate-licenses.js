const fs = require('fs');
const path = require('path');
const checker = require('license-checker');

const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'assets');
const outputPath = path.join(outputDir, 'licenses.json');

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
        const [name, version] = key.split('@');
        return {
          name: info.name || name,
          version: info.version || version,
          licenses: info.licenses ?? 'Unknown',
          licenseText: pickLicenseText(info),
          repository: info.repository || '',
          publisher: info.publisher || '',
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    fs.writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), entries }, null, 2));
    console.log(`Saved licenses to ${outputPath}`);
  }
);
