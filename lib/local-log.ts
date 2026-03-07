import * as FileSystem from 'expo-file-system';

const LOG_FILE_NAME = 'gowherer-debug.log';
const LOG_FILE_URI = `${FileSystem.documentDirectory ?? ''}${LOG_FILE_NAME}`;

function stringifyData(data: unknown): string {
  if (data === undefined) {
    return '';
  }
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

async function appendLine(line: string) {
  if (!FileSystem.documentDirectory) {
    return;
  }

  try {
    await FileSystem.writeAsStringAsync(LOG_FILE_URI, line, {
      encoding: FileSystem.EncodingType.UTF8,
      append: true,
    });
  } catch {
    // If append fails on some platforms, fallback to overwrite create.
    await FileSystem.writeAsStringAsync(LOG_FILE_URI, line, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }
}

export async function logLocalInfo(tag: string, message: string, data?: unknown) {
  const line = `[${new Date().toISOString()}] [INFO] [${tag}] ${message}${
    data !== undefined ? ` | ${stringifyData(data)}` : ''
  }\n`;
  console.log(line.trim());
  await appendLine(line);
}

export async function logLocalError(tag: string, error: unknown, data?: unknown) {
  const details =
    error instanceof Error
      ? { message: error.message, stack: error.stack ?? '' }
      : { message: String(error) };
  const line = `[${new Date().toISOString()}] [ERROR] [${tag}] ${stringifyData(details)}${
    data !== undefined ? ` | ${stringifyData(data)}` : ''
  }\n`;
  console.error(line.trim());
  await appendLine(line);
}

export function getLocalLogFileUri() {
  return LOG_FILE_URI;
}

export async function initLocalLogFile() {
  await logLocalInfo('Logger', 'initialized', {
    uri: LOG_FILE_URI,
  });
}
