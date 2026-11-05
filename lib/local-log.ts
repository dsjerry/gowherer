import * as FileSystem from 'expo-file-system/legacy';

const LOG_FILE_NAME = 'gowherer-debug.log';
const LOG_FILE_URI = `${FileSystem.documentDirectory ?? ''}${LOG_FILE_NAME}`;

/** 控制台只留一行摘要，避免超长堆栈/模型原文把 RN 日志渲染成无信息的一行 */
const CONSOLE_TEXT_LIMIT = 400;

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

/** 折叠换行与连续空白，并按长度截断（模型输出/HTTP body 常常带换行） */
export function collapseLogText(text: string, limit = CONSOLE_TEXT_LIMIT): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  return collapsed.length > limit ? `${collapsed.slice(0, limit)}…` : collapsed;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const message = collapseLogText(error.message || '(empty message)');
    return `${error.name || 'Error'}: ${message}`;
  }
  if (error === undefined) {
    return '(undefined)';
  }
  if (error === null) {
    return '(null)';
  }
  if (typeof error === 'string') {
    return collapseLogText(error);
  }
  try {
    const json = JSON.stringify(error);
    if (typeof json === 'string') {
      return collapseLogText(json);
    }
  } catch {
    // 循环引用等无法序列化的情况，退回 String()
  }
  return collapseLogText(String(error));
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
  const timestamp = new Date().toISOString();
  const dataText = data !== undefined ? stringifyData(data) : '';
  // 文件里保留完整数据，控制台只留摘要，便于真机日志阅读
  const fileLine = `[${timestamp}] [INFO] [${tag}] ${message}${dataText ? ` | ${dataText}` : ''}\n`;
  console.log(
    `[${timestamp}] [INFO] [${tag}] ${collapseLogText(message)}${
      dataText ? ` | ${collapseLogText(dataText)}` : ''
    }`,
  );
  await appendLine(fileLine);
}

export async function logLocalError(tag: string, error: unknown, data?: unknown) {
  const timestamp = new Date().toISOString();
  const dataText = data !== undefined ? stringifyData(data) : '';
  // 文件里保留 name/message/stack，控制台只保留一行可读摘要
  const details =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack ?? '' }
      : { message: describeError(error) };
  const fileLine = `[${timestamp}] [ERROR] [${tag}] ${stringifyData(details)}${
    dataText ? ` | ${dataText}` : ''
  }\n`;
  console.error(
    `[${timestamp}] [ERROR] [${tag}] ${describeError(error)}${
      dataText ? ` | ${collapseLogText(dataText)}` : ''
    }`,
  );
  await appendLine(fileLine);
}

export function getLocalLogFileUri() {
  return LOG_FILE_URI;
}

export async function initLocalLogFile() {
  await logLocalInfo('Logger', 'initialized', {
    uri: LOG_FILE_URI,
  });
}
