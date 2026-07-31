// 极简 IndexedDB 封装。整个应用的数据都存在浏览器本地 IndexedDB 里，
// 这样部署到 Vercel（serverless 文件系统只读）也能正常读写。
//
// 设计：一个数据库 `tracebound`，每类数据一个 object store（keyPath: "id"）。
// 另有若干"文本/二进制正文"store，用来存故事正文、素材正文，以及素材上传的
// 图片/音频 Blob（客户需要在本地上传并查看图片和音频）。
//
// 只在浏览器环境运行。SSR / 测试时若无 indexedDB，会在调用处兜底。

const DB_NAME = "tracebound";
const DB_VERSION = 2;  // 升级版本以添加 importBatches store

// 所有 object store 名称
export const STORES = {
  materials: "materials",
  stories: "stories",
  ideas: "ideas",
  alchemy: "alchemy",
  reflections: "reflections",
  firstThoughts: "firstThoughts",
  events: "events",
  importBatches: "importBatches",  // 批量导入记录
  // 正文（纯文本）：key = 记录 id，value = string
  materialBodies: "materialBodies",
  storyBodies: "storyBodies",
  // 媒体 Blob：key = 记录 id，value = Blob（图片 / 音频）
  media: "media",
  // 单键配置：key = 名称，value = 任意
  settings: "settings",
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

// keyPath 型 store（存对象数组，主键在对象的 id 字段里）
const KEYED_STORES: StoreName[] = [
  STORES.materials,
  STORES.stories,
  STORES.ideas,
  STORES.alchemy,
  STORES.reflections,
  STORES.events,
  STORES.importBatches,
];
// firstThoughts 用 traceId 作主键
// 其余（bodies / media / settings）是纯 key-value

let dbPromise: Promise<IDBDatabase> | null = null;

function hasIDB(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!hasIDB()) {
      reject(new Error("IndexedDB 不可用（当前环境没有 indexedDB）"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of KEYED_STORES) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: "id" });
        }
      }
      if (!db.objectStoreNames.contains(STORES.firstThoughts)) {
        db.createObjectStore(STORES.firstThoughts, { keyPath: "traceId" });
      }
      for (const kv of [STORES.materialBodies, STORES.storyBodies, STORES.media, STORES.settings]) {
        if (!db.objectStoreNames.contains(kv)) db.createObjectStore(kv);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => resolve(req.result as T);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

// ---- keyPath store：整表读、按 id 增改删 ----

export async function idbGetAll<T>(store: StoreName): Promise<T[]> {
  if (!hasIDB()) return [];
  return (await tx<T[]>(store, "readonly", (s) => s.getAll())) ?? [];
}

export async function idbPut<T>(store: StoreName, value: T): Promise<void> {
  await tx(store, "readwrite", (s) => s.put(value as unknown as object));
}

export async function idbDelete(store: StoreName, key: IDBValidKey): Promise<void> {
  await tx(store, "readwrite", (s) => s.delete(key));
}

// ---- key-value store：正文 / 媒体 / 设置 ----

export async function idbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  if (!hasIDB()) return undefined;
  return await tx<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
}

export async function idbSet(store: StoreName, key: IDBValidKey, value: unknown): Promise<void> {
  await tx(store, "readwrite", (s) => s.put(value as object, key));
}

export async function idbDel(store: StoreName, key: IDBValidKey): Promise<void> {
  await tx(store, "readwrite", (s) => s.delete(key));
}
