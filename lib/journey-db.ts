import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';

import { LEGACY_JOURNEY_STORAGE_KEY, normalizeJourneyList } from '@/lib/journey-normalize';
import { normalizeTrackLocation } from '@/lib/track-utils';
import { Journey, TimelineLocation } from '@/types/journey';

const DB_NAME = 'gowherer.db';
const META_RECOVERY_DONE = 'legacy_recovery_done';
const LEGACY_TRACKING_BATCH_PREFIX = 'gowherer:tracking:batch:v1';

/** substr 分块读取的字符数。CursorWindow 约 2MB(UTF-16),10 万字符最坏约 200KB,余量充足。 */
const LEGACY_CHUNK_CHARS = 100_000;
/** 批量 INSERT 每批行数,控制单条 SQL 体积。 */
const TRACK_INSERT_BATCH_SIZE = 400;

type JourneyRow = { id: string; sort_order: number; data: string };
type TrackRow = { journey_id: string; data: string };
type LegacyBatchRow = { key: string; value: string };

type LegacyPayload = {
  raw: string | null;
  batchPointsByJourney: Map<string, TimelineLocation[]>;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let recoveryPromise: Promise<void> | null = null;

export function getJourneyDb() {
  if (!dbPromise) {
    dbPromise = openJourneyDb();
  }
  return dbPromise;
}

async function openJourneyDb() {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS journeys (
      id TEXT PRIMARY KEY NOT NULL,
      sort_order INTEGER NOT NULL,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS track_locations (
      journey_id TEXT NOT NULL,
      seq INTEGER NOT NULL,
      data TEXT NOT NULL,
      PRIMARY KEY (journey_id, seq)
    );
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
  return db;
}

export async function loadJourneysFromDb(db: SQLite.SQLiteDatabase): Promise<Journey[]> {
  const journeyRows = await db.getAllAsync<JourneyRow>(
    'SELECT id, sort_order, data FROM journeys ORDER BY sort_order, id',
  );
  if (journeyRows.length === 0) {
    return [];
  }

  const tracksByJourney = new Map<string, TimelineLocation[]>();
  const trackRows = await db.getAllAsync<TrackRow>(
    'SELECT journey_id, data FROM track_locations ORDER BY journey_id, seq',
  );
  for (const row of trackRows) {
    const list = tracksByJourney.get(row.journey_id) ?? [];
    try {
      list.push(JSON.parse(row.data) as TimelineLocation);
    } catch {
      // 单点损坏时跳过,不影响其余数据。
    }
    tracksByJourney.set(row.journey_id, list);
  }

  return journeyRows.map((row) => {
    const journey = JSON.parse(row.data) as Journey;
    journey.trackLocations = tracksByJourney.get(journey.id) ?? [];
    return journey;
  });
}

export async function saveJourneysToDb(db: SQLite.SQLiteDatabase, journeys: Journey[]) {
  await db.withTransactionAsync(async () => {
    const countRows = await db.getAllAsync<{ journey_id: string; count: number }>(
      'SELECT journey_id, COUNT(*) AS count FROM track_locations GROUP BY journey_id',
    );
    const storedCounts = new Map(countRows.map((row) => [row.journey_id, row.count]));
    const keepIds = new Set<string>();

    for (let index = 0; index < journeys.length; index += 1) {
      const journey = journeys[index];
      keepIds.add(journey.id);
      // 轨迹单独存表,data 里置空,避免单行再次膨胀。
      await db.runAsync(
        'INSERT OR REPLACE INTO journeys (id, sort_order, data) VALUES (?, ?, ?)',
        journey.id,
        index,
        JSON.stringify({ ...journey, trackLocations: [] }),
      );
      // 轨迹点数不变时跳过重写;变化(导入/删除/恢复)才全量同步该旅程的轨迹行。
      if ((storedCounts.get(journey.id) ?? 0) !== journey.trackLocations.length) {
        await db.runAsync('DELETE FROM track_locations WHERE journey_id = ?', journey.id);
        await insertTrackRows(db, journey.id, journey.trackLocations, 0);
      }
    }

    const existingIds = await db.getAllAsync<{ id: string }>('SELECT id FROM journeys');
    for (const row of existingIds) {
      if (!keepIds.has(row.id)) {
        await db.runAsync('DELETE FROM journeys WHERE id = ?', row.id);
        await db.runAsync('DELETE FROM track_locations WHERE journey_id = ?', row.id);
      }
    }
  });
}

export async function appendTrackLocationsToDb(
  db: SQLite.SQLiteDatabase,
  journeyId: string,
  locations: TimelineLocation[],
) {
  if (locations.length === 0) {
    return;
  }

  await db.withTransactionAsync(async () => {
    const row = await db.getFirstAsync<{ max_seq: number | null }>(
      'SELECT MAX(seq) AS max_seq FROM track_locations WHERE journey_id = ?',
      journeyId,
    );
    const startSeq = (row?.max_seq ?? -1) + 1;
    await insertTrackRows(db, journeyId, locations, startSeq);
  });
}

async function insertTrackRows(
  db: SQLite.SQLiteDatabase,
  journeyId: string,
  locations: TimelineLocation[],
  startSeq: number,
) {
  for (let start = 0; start < locations.length; start += TRACK_INSERT_BATCH_SIZE) {
    const batch = locations.slice(start, start + TRACK_INSERT_BATCH_SIZE);
    const values = batch
      .map(
        (location, index) =>
          `(${sqlQuote(journeyId)}, ${startSeq + start + index}, ${sqlQuote(
            JSON.stringify(location),
          )})`,
      )
      .join(',');
    await db.execAsync(
      `INSERT OR REPLACE INTO track_locations (journey_id, seq, data) VALUES ${values};`,
    );
  }
}

function sqlQuote(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function getMeta(db: SQLite.SQLiteDatabase, key: string) {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM meta WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

async function setMeta(db: SQLite.SQLiteDatabase, key: string, value: string) {
  await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
}

/** 启动即触发旧数据恢复;loadJourneys/saveJourneys 都会 await,保证后续读写看到一致状态。 */
export function ensureLegacyRecovered() {
  if (!recoveryPromise) {
    recoveryPromise = runLegacyRecovery().catch((error) => {
      recoveryPromise = null;
      throw error;
    });
  }
  return recoveryPromise;
}

async function runLegacyRecovery() {
  const db = await getJourneyDb();
  if (await getMeta(db, META_RECOVERY_DONE)) {
    return;
  }

  const legacy = await readLegacyPayload();
  if (legacy.raw !== null) {
    const journeys = normalizeJourneyList(JSON.parse(legacy.raw));
    for (const [journeyId, points] of legacy.batchPointsByJourney) {
      const journey = journeys.find((item) => item.id === journeyId);
      if (journey) {
        journey.trackLocations = [...journey.trackLocations, ...points];
      }
    }
    await saveJourneysToDb(db, journeys);
  }

  await deleteLegacyKeys();
  await setMeta(db, META_RECOVERY_DONE, '1');
}

async function readLegacyPayload(): Promise<LegacyPayload> {
  if (Platform.OS === 'web') {
    return { raw: null, batchPointsByJourney: new Map() };
  }
  if (Platform.OS === 'ios') {
    // iOS 的 AsyncStorage 直接走 sqlite3 C API,没有 CursorWindow 限制,可以直接读。
    const raw = await AsyncStorage.getItem(LEGACY_JOURNEY_STORAGE_KEY);
    return { raw, batchPointsByJourney: await readLegacyBatchPointsFromAsyncStorage() };
  }
  return readLegacyPayloadAndroid();
}

function getAndroidDatabasesDirectory() {
  const documentDirectory = FileSystem.documentDirectory;
  if (!documentDirectory) {
    return null;
  }
  // documentDirectory 形如 file:///data/user/0/<pkg>/files/,AsyncStorage 的
  // RKStorage 数据库在同级的 databases/ 目录。
  const databasesDir = documentDirectory.replace(/\/files\/$/, '/databases/');
  return databasesDir === documentDirectory ? null : databasesDir;
}

async function readLegacyPayloadAndroid(): Promise<LegacyPayload> {
  const databasesDir = getAndroidDatabasesDirectory();
  if (!databasesDir) {
    throw new Error('Unable to resolve legacy AsyncStorage database directory.');
  }

  const info = await FileSystem.getInfoAsync(`${databasesDir}RKStorage`);
  if (!info.exists) {
    return { raw: null, batchPointsByJourney: new Map() };
  }

  const legacyDb = await SQLite.openDatabaseAsync('RKStorage', undefined, databasesDir);
  try {
    const table = await detectLegacyTable(legacyDb);
    if (!table) {
      return { raw: null, batchPointsByJourney: new Map() };
    }
    const raw = await readLegacyValueChunked(legacyDb, table, LEGACY_JOURNEY_STORAGE_KEY);
    const batchPointsByJourney = await readLegacyBatchPointsFromDb(legacyDb, table);
    return { raw, batchPointsByJourney };
  } finally {
    await legacyDb.closeAsync();
  }
}

/** AsyncStorage 旧版表名为 catalystLocalStorage,新版为 keyvalue,按实际建表情况检测。 */
async function detectLegacyTable(legacyDb: SQLite.SQLiteDatabase) {
  const rows = await legacyDb.getAllAsync<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  );
  const names = new Set(rows.map((row) => row.name));
  if (names.has('keyvalue')) {
    return 'keyvalue';
  }
  if (names.has('catalystLocalStorage')) {
    return 'catalystLocalStorage';
  }
  return null;
}

/** 大行用 substr 分块读取,每块远小于 CursorWindow 限制,绕开单行超限问题。 */
async function readLegacyValueChunked(legacyDb: SQLite.SQLiteDatabase, table: string, key: string) {
  const sizeRow = await legacyDb.getFirstAsync<{ size: number | null }>(
    `SELECT length(value) AS size FROM ${table} WHERE key = ?`,
    key,
  );
  if (sizeRow?.size == null) {
    return null;
  }

  const totalChars = sizeRow.size;
  if (totalChars <= LEGACY_CHUNK_CHARS) {
    const row = await legacyDb.getFirstAsync<{ value: string }>(
      `SELECT value FROM ${table} WHERE key = ?`,
      key,
    );
    return row?.value ?? null;
  }

  let raw = '';
  for (let offset = 1; offset <= totalChars; offset += LEGACY_CHUNK_CHARS) {
    const chunkRow = await legacyDb.getFirstAsync<{ chunk: string }>(
      `SELECT substr(value, ?, ?) AS chunk FROM ${table} WHERE key = ?`,
      offset,
      LEGACY_CHUNK_CHARS,
      key,
    );
    raw += chunkRow?.chunk ?? '';
  }
  return raw;
}

async function readLegacyBatchPointsFromDb(legacyDb: SQLite.SQLiteDatabase, table: string) {
  const rows = await legacyDb.getAllAsync<LegacyBatchRow>(
    `SELECT key, value FROM ${table} WHERE key LIKE '${LEGACY_TRACKING_BATCH_PREFIX}:%'`,
  );
  return parseBatchRows(rows);
}

async function readLegacyBatchPointsFromAsyncStorage() {
  const prefix = `${LEGACY_TRACKING_BATCH_PREFIX}:`;
  const batchKeys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(prefix));
  if (batchKeys.length === 0) {
    return new Map<string, TimelineLocation[]>();
  }
  const rawItems = await AsyncStorage.multiGet(batchKeys);
  return parseBatchRows(rawItems.map(([key, value]) => ({ key, value: value ?? '' })));
}

function parseBatchRows(rows: LegacyBatchRow[]) {
  const batchPointsByJourney = new Map<string, TimelineLocation[]>();
  for (const row of rows) {
    // key 格式:gowherer:tracking:batch:v1:<journeyId>:<ts>:<rand>
    const journeyId = row.key.split(':')[4];
    if (!journeyId) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.value);
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) {
      continue;
    }
    const points = parsed
      .map((location) => normalizeTrackLocation(location))
      .filter((location): location is TimelineLocation => Boolean(location));
    if (points.length === 0) {
      continue;
    }
    const existing = batchPointsByJourney.get(journeyId) ?? [];
    existing.push(...points);
    batchPointsByJourney.set(journeyId, existing);
  }
  return batchPointsByJourney;
}

async function deleteLegacyKeys() {
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      if (Platform.OS === 'ios') {
        await AsyncStorage.removeItem(LEGACY_JOURNEY_STORAGE_KEY);
        const prefix = `${LEGACY_TRACKING_BATCH_PREFIX}:`;
        const batchKeys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(prefix));
        if (batchKeys.length > 0) {
          await AsyncStorage.multiRemove(batchKeys);
        }
      } else {
        await deleteLegacyKeysAndroid();
      }
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
}

async function deleteLegacyKeysAndroid() {
  const databasesDir = getAndroidDatabasesDirectory();
  if (!databasesDir) {
    throw new Error('Unable to resolve legacy AsyncStorage database directory.');
  }

  const info = await FileSystem.getInfoAsync(`${databasesDir}RKStorage`);
  if (!info.exists) {
    return;
  }

  const legacyDb = await SQLite.openDatabaseAsync('RKStorage', undefined, databasesDir);
  try {
    const table = await detectLegacyTable(legacyDb);
    if (!table) {
      return;
    }
    await legacyDb.execAsync(`DELETE FROM ${table} WHERE key = '${LEGACY_JOURNEY_STORAGE_KEY}';`);
    await legacyDb.execAsync(
      `DELETE FROM ${table} WHERE key LIKE '${LEGACY_TRACKING_BATCH_PREFIX}:%';`,
    );
  } finally {
    await legacyDb.closeAsync();
  }
}
