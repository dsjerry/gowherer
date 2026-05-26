const { withAppBuildGradle } = require("@expo/config-plugins");

const IMPORT_LINE = "import com.android.build.OutputFile";
const CONFIG_MARKER = "// @gowherer-abi-splits";

const ABI_SPLIT_CONFIG = `
${CONFIG_MARKER}
def enableSeparateBuildPerCPUArchitecture = (findProperty('android.enableSeparateBuildPerCPUArchitecture') ?: false).toBoolean()

def reactNativeArchitectures() {
    def value = project.getProperties().get("reactNativeArchitectures")
    return value ? value.split(",")*.trim() : ["armeabi-v7a", "arm64-v8a", "x86", "x86_64"]
}
`.trim();

const SPLITS_BLOCK = `
    ${CONFIG_MARKER}
    splits {
        abi {
            reset()
            enable enableSeparateBuildPerCPUArchitecture
            universalApk true
            include(*reactNativeArchitectures())
        }
    }
`.trimEnd();

const VERSION_CODE_BLOCK = `
    ${CONFIG_MARKER}
    applicationVariants.all { variant ->
        variant.outputs.each { output ->
            def abiVersionCodes = ["armeabi-v7a": 1, "arm64-v8a": 2, "x86": 3, "x86_64": 4]
            def abi = output.getFilter(OutputFile.ABI)
            if (abi != null) {
                output.versionCodeOverride = defaultConfig.versionCode * 1000 + abiVersionCodes.get(abi)
            }
        }
    }
`.trimEnd();

function insertBeforeAndroidBlock(contents, snippet) {
  return contents.replace(/\nandroid\s*\{/, `\n${snippet}\n\nandroid {`);
}

function insertBeforePackagingOptions(contents, snippet) {
  return contents.replace(/\n\s{4}packagingOptions\s*\{/, `\n${snippet}\n    packagingOptions {`);
}

function insertBeforeAndroidBlockEnd(contents, snippet) {
  const resourcesPattern =
    /(\n\s{4}androidResources\s*\{[\s\S]*?\n\s{4}\}\n)(\})/;
  if (resourcesPattern.test(contents)) {
    return contents.replace(resourcesPattern, `$1\n${snippet}\n$2`);
  }

  const androidBlockStart = contents.indexOf("\nandroid {");
  if (androidBlockStart === -1) {
    return contents;
  }

  let depth = 0;
  for (let index = androidBlockStart; index < contents.length; index += 1) {
    const char = contents[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return `${contents.slice(0, index)}\n${snippet}\n${contents.slice(index)}`;
      }
    }
  }

  return contents;
}

function addAbiSplits(contents) {
  if (!contents.includes(IMPORT_LINE)) {
    contents = `${IMPORT_LINE}\n\n${contents}`;
  }

  if (!contents.includes("def enableSeparateBuildPerCPUArchitecture")) {
    contents = insertBeforeAndroidBlock(contents, ABI_SPLIT_CONFIG);
  }

  if (!contents.includes("splits {")) {
    contents = insertBeforePackagingOptions(contents, SPLITS_BLOCK);
  }

  if (!contents.includes("versionCodeOverride")) {
    contents = insertBeforeAndroidBlockEnd(contents, VERSION_CODE_BLOCK);
  }

  return contents;
}

module.exports = function withAndroidAbiSplits(config) {
  return withAppBuildGradle(config, (configWithBuildGradle) => {
    configWithBuildGradle.modResults.contents = addAbiSplits(
      configWithBuildGradle.modResults.contents
    );
    return configWithBuildGradle;
  });
};
