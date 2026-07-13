import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

export interface ImageRecord {
  id: string;
  url: string;
  localUrl?: string;
  subject: string;
  prompt: string;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
  categoryId?: string;
  isSaved: boolean;
  flagged?: boolean;
  metadata: { model: string; ratio: string; resolution: string };
  subjectCount?: number;
  thumbnailUrl?: string;
}

export interface CategoryRecord {
  id: string;
  name: string;
  count: number;
  icon?: string;
  folderName?: string;
  storageKey?: string;
}

export interface TemplateRecord {
  id: string;
  name: string;
  content: string;
  isPinned?: boolean;
}

type LegacyStats = { totalAttempts: number; successful: number; failed: number };

const nowIso = () => new Date().toISOString();
const sqlBool = (value: unknown) => value ? 1 : 0;

export function safeFolderName(value: string, fallback: string): string {
  let result = (value || fallback)
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 80);
  if (!result || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(result)) result = fallback;
  return result;
}

export function safeStorageKey(value: string, fallback: string): string {
  const fallbackKey = fallback
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'category';
  const result = (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 64);
  return result || fallbackKey.slice(0, 64);
}

const LEGACY_STORAGE_KEYS: Record<string, string> = {
  uncategorized: 'uncategorized',
  '5kz18k0m7': 'insect-atlas',
  '0dztxwd03': 'plant-atlas',
  p7ywtbjrh: 'animal-atlas',
  '2rkjmh2ze': 'nature-atlas',
  '1ribnw7c4': 'questionable',
  tn5ish3kl: 'concept-art',
  '6pt1a4art': 'fish-atlas',
  '05s4g2h1s': 'template-tests',
  v0ve13cgq: 'low-priority',
  '4k2v2ai3k': 'flower-atlas',
  ex8xf2vhj: 'bird-atlas',
  o1dk493uy: 'butterfly-atlas',
  egwuy0mg7: 'staging',
};

const PROVIDER_DEFAULTS: Record<string, string> = {
  apimart: 'https://api.aiuxu.com',
  apikeyfun: 'https://api.apikey.fun',
  gemini: 'https://generativelanguage.googleapis.com',
  deepseek: 'https://api.deepseek.com',
};

const subjectIdFor = (subject: string) => `sub_${createHash('sha1').update(subject).digest('hex').slice(0, 12)}`;

function readLegacyJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

function createVerifiedBackup(rootDir: string, files: string[]) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(rootDir, 'backups', `auto-pre-sqlite-${stamp}`);
  fs.mkdirSync(backupDir, { recursive: true });
  const hashes: Record<string, string> = {};
  for (const name of files) {
    const source = path.join(rootDir, name);
    if (!fs.existsSync(source)) continue;
    const target = path.join(backupDir, name);
    fs.copyFileSync(source, target);
    const sourceHash = createHash('sha256').update(fs.readFileSync(source)).digest('hex');
    const targetHash = createHash('sha256').update(fs.readFileSync(target)).digest('hex');
    if (sourceHash !== targetHash) throw new Error(`Backup verification failed for ${name}`);
    hashes[name] = sourceHash;
  }
  return { backupDir, hashes };
}

export class AtlasDatabase {
  readonly db: DatabaseSync;
  readonly rootDir: string;
  readonly downloadsDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
    this.downloadsDir = path.join(rootDir, 'downloads');
    this.db = new DatabaseSync(path.join(rootDir, 'atlas.db'));
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;');
    this.createSchema();
    this.migrateSchema();
    this.importLegacyDataIfNeeded();
  }

  private createSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        folder_name TEXT,
        storage_key TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        normalized_name TEXT NOT NULL,
        category_id TEXT,
        folder_name TEXT NOT NULL,
        folder_path TEXT,
        has_category_conflict INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(category_id) REFERENCES categories(id)
      );
      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        subject_id TEXT NOT NULL,
        subject_snapshot TEXT NOT NULL,
        prompt TEXT NOT NULL DEFAULT '',
        remote_url TEXT NOT NULL DEFAULT '',
        local_url TEXT,
        timestamp INTEGER NOT NULL,
        status TEXT NOT NULL,
        is_saved INTEGER NOT NULL DEFAULT 0,
        flagged INTEGER NOT NULL DEFAULT 0,
        category_id TEXT,
        model TEXT NOT NULL DEFAULT '',
        ratio TEXT NOT NULL DEFAULT '',
        resolution TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(subject_id) REFERENCES subjects(id),
        FOREIGN KEY(category_id) REFERENCES categories(id)
      );
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        is_pinned INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS generation_stats (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        total_attempts INTEGER NOT NULL DEFAULT 0,
        successful INTEGER NOT NULL DEFAULT 0,
        failed INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS provider_configs (
        provider TEXT PRIMARY KEY,
        base_url TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS file_operations (
        id TEXT PRIMARY KEY,
        image_id TEXT,
        subject_id TEXT NOT NULL,
        source_path TEXT NOT NULL,
        target_path TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        created_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_images_timestamp ON images(timestamp DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_images_category_timestamp ON images(category_id, timestamp DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_images_subject ON images(subject_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_images_subject_snapshot ON images(subject_snapshot);
      CREATE INDEX IF NOT EXISTS idx_images_flagged ON images(flagged) WHERE flagged = 1;
    `);
  }

  private migrateSchema() {
    const categoryColumns = this.db.prepare('PRAGMA table_info(categories)').all();
    if (!categoryColumns.some(column => String(column.name) === 'storage_key')) {
      this.db.exec('ALTER TABLE categories ADD COLUMN storage_key TEXT');
    }

    const timestamp = nowIso();
    const categories = this.db.prepare('SELECT id, folder_name, storage_key FROM categories').all();
    const updateStorageKey = this.db.prepare('UPDATE categories SET storage_key = ?, updated_at = ? WHERE id = ?');
    for (const category of categories) {
      const id = String(category.id);
      if (id === 'all' || category.storage_key) continue;
      const legacyFolder = category.folder_name ? String(category.folder_name) : '';
      const storageKey = LEGACY_STORAGE_KEYS[id]
        || (/^[a-z0-9][a-z0-9_-]*$/i.test(legacyFolder) ? safeStorageKey(legacyFolder, `category-${id}`) : safeStorageKey('', `category-${id}`));
      updateStorageKey.run(storageKey, timestamp, id);
    }

    const upsertProvider = this.db.prepare(`
      INSERT INTO provider_configs (provider, base_url, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(provider) DO NOTHING
    `);
    for (const [provider, baseUrl] of Object.entries(PROVIDER_DEFAULTS)) {
      upsertProvider.run(provider, baseUrl, timestamp);
    }
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_storage_key ON categories(storage_key) WHERE storage_key IS NOT NULL');
  }

  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  private importLegacyDataIfNeeded() {
    const imported = this.db.prepare("SELECT value FROM app_meta WHERE key = 'legacy_imported_at'").get();
    const imageCount = Number(this.db.prepare('SELECT COUNT(*) count FROM images').get()?.count || 0);
    if (imported || imageCount > 0) return;

    const required = ['images.json', 'templates.json', 'categories.json', 'stats.json'];
    if (!required.every(name => fs.existsSync(path.join(this.rootDir, name)))) return;

    const backup = createVerifiedBackup(this.rootDir, required);
    const images = readLegacyJson<ImageRecord[]>(path.join(this.rootDir, 'images.json'));
    const templates = readLegacyJson<TemplateRecord[]>(path.join(this.rootDir, 'templates.json'));
    const categories = readLegacyJson<CategoryRecord[]>(path.join(this.rootDir, 'categories.json'));
    const stats = readLegacyJson<LegacyStats>(path.join(this.rootDir, 'stats.json'));

    const categoryBySubject = new Map<string, Map<string, number>>();
    for (const image of images) {
      const subject = image.subject || 'Untitled';
      const categoryId = image.categoryId || 'uncategorized';
      if (!categoryBySubject.has(subject)) categoryBySubject.set(subject, new Map());
      const counts = categoryBySubject.get(subject)!;
      counts.set(categoryId, (counts.get(categoryId) || 0) + 1);
    }

    const conflicts: Array<{ subject: string; categories: Array<{ id: string; count: number }> }> = [];
    const missingFiles: Array<{ id: string; localUrl: string }> = [];
    const importedAt = nowIso();

    this.transaction(() => {
      const insertCategory = this.db.prepare(`
        INSERT INTO categories (id, name, icon, sort_order, folder_name, storage_key, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      categories.forEach((category, index) => {
        const folderName = category.id === 'all' ? null : safeFolderName(category.id === 'uncategorized' ? '未分类' : category.name, category.id);
        const storageKey = category.id === 'all' ? null : safeStorageKey(
          category.storageKey || LEGACY_STORAGE_KEYS[category.id] || '',
          `category-${category.id}`,
        );
        insertCategory.run(category.id, category.name, category.icon || null, index, folderName, storageKey, importedAt, importedAt);
      });

      const insertSubject = this.db.prepare(`
        INSERT INTO subjects (id, name, normalized_name, category_id, folder_name, has_category_conflict, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const [subject, counts] of categoryBySubject) {
        const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
        const id = subjectIdFor(subject);
        if (sorted.length > 1) conflicts.push({ subject, categories: sorted.map(([categoryId, count]) => ({ id: categoryId, count })) });
        insertSubject.run(
          id,
          subject,
          subject.normalize('NFKC').toLocaleLowerCase(),
          sorted[0]?.[0] || 'uncategorized',
          `${safeFolderName(subject, 'Untitled')}__${id.slice(-6)}`,
          sorted.length > 1 ? 1 : 0,
          importedAt,
          importedAt,
        );
      }

      const insertImage = this.db.prepare(`
        INSERT INTO images (
          id, subject_id, subject_snapshot, prompt, remote_url, local_url, timestamp, status,
          is_saved, flagged, category_id, model, ratio, resolution, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const image of images) {
        const subject = image.subject || 'Untitled';
        insertImage.run(
          image.id,
          subjectIdFor(subject),
          subject,
          image.prompt || '',
          image.url || '',
          image.localUrl || null,
          image.timestamp || Date.now(),
          image.status || 'failed',
          sqlBool(image.isSaved),
          sqlBool(image.flagged),
          image.categoryId || 'uncategorized',
          image.metadata?.model || '',
          image.metadata?.ratio || '',
          image.metadata?.resolution || '',
          importedAt,
          importedAt,
        );
        if (image.localUrl?.startsWith('/downloads/')) {
          const diskPath = path.join(this.downloadsDir, decodeURIComponent(image.localUrl.slice('/downloads/'.length)));
          if (!fs.existsSync(diskPath)) missingFiles.push({ id: image.id, localUrl: image.localUrl });
        }
      }

      const insertTemplate = this.db.prepare(`
        INSERT INTO templates (id, name, content, is_pinned, sort_order, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      templates.forEach((template, index) => {
        insertTemplate.run(template.id, template.name, template.content, template.isPinned === false ? 0 : 1, index, importedAt);
      });

      this.db.prepare(`
        INSERT INTO generation_stats (id, total_attempts, successful, failed, updated_at)
        VALUES (1, ?, ?, ?, ?)
      `).run(stats.totalAttempts || 0, stats.successful || 0, stats.failed || 0, importedAt);
      this.db.prepare('INSERT INTO app_meta (key, value) VALUES (?, ?)').run('schema_version', '1');
      this.db.prepare('INSERT INTO app_meta (key, value) VALUES (?, ?)').run('legacy_imported_at', importedAt);
    });

    const counts = {
      images: Number(this.db.prepare('SELECT COUNT(*) count FROM images').get()?.count || 0),
      templates: Number(this.db.prepare('SELECT COUNT(*) count FROM templates').get()?.count || 0),
      categories: Number(this.db.prepare('SELECT COUNT(*) count FROM categories').get()?.count || 0),
    };
    if (counts.images !== images.length || counts.templates !== templates.length || counts.categories !== categories.length) {
      throw new Error(`SQLite migration verification failed: ${JSON.stringify(counts)}`);
    }

    fs.writeFileSync(path.join(this.rootDir, 'migration-report.json'), JSON.stringify({
      importedAt,
      backup,
      counts,
      subjectCount: categoryBySubject.size,
      categoryConflicts: conflicts,
      missingFiles,
      legacyFilesPreserved: required,
    }, null, 2));
  }

  getBootstrap() {
    const countRows = this.db.prepare('SELECT category_id, COUNT(*) count FROM images GROUP BY category_id').all();
    const counts = new Map(countRows.map(row => [String(row.category_id || 'uncategorized'), Number(row.count)]));
    const total = Number(this.db.prepare('SELECT COUNT(*) count FROM images').get()?.count || 0);
    const categories = this.db.prepare('SELECT id, name, icon, folder_name, storage_key FROM categories ORDER BY sort_order, name').all().map(row => ({
      id: String(row.id),
      name: String(row.name),
      icon: row.icon ? String(row.icon) : undefined,
      folderName: row.folder_name ? String(row.folder_name) : undefined,
      storageKey: row.storage_key ? String(row.storage_key) : undefined,
      count: String(row.id) === 'all' ? total : (counts.get(String(row.id)) || 0),
    }));
    const templates = this.db.prepare('SELECT id, name, content, is_pinned FROM templates ORDER BY sort_order, name').all().map(row => ({
      id: String(row.id),
      name: String(row.name),
      content: String(row.content),
      isPinned: Number(row.is_pinned) === 1,
    }));
    const stat = this.db.prepare('SELECT total_attempts, successful, failed FROM generation_stats WHERE id = 1').get();
    return {
      categories,
      templates,
      stats: {
        totalAttempts: Number(stat?.total_attempts || 0),
        successful: Number(stat?.successful || 0),
        failed: Number(stat?.failed || 0),
      },
      totalImages: total,
      archived: Number(this.db.prepare('SELECT COUNT(*) count FROM images WHERE is_saved = 1').get()?.count || 0),
    };
  }

  listImages(options: { categoryId?: string; query?: string; cursor?: string; limit?: number; groupBySubject?: boolean }) {
    const limit = Math.min(Math.max(options.limit || 60, 1), 200);
    const where: string[] = [];
    const params: Array<string | number> = [];
    if (options.categoryId && options.categoryId !== 'all') {
      where.push("COALESCE(category_id, 'uncategorized') = ?");
      params.push(options.categoryId);
    }
    if (options.query?.trim()) {
      where.push('(subject_snapshot LIKE ? OR prompt LIKE ?)');
      const value = `%${options.query.trim()}%`;
      params.push(value, value);
    }
    const baseWhere = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const cursor = this.decodeCursor(options.cursor);
    const cursorWhere = cursor ? 'WHERE (timestamp < ? OR (timestamp = ? AND id < ?))' : '';
    const cursorParams = cursor ? [cursor.timestamp, cursor.timestamp, cursor.id] : [];

    const selectColumns = `
      id, remote_url, local_url, subject_snapshot, prompt, timestamp, status, is_saved,
      flagged, category_id, model, ratio, resolution
    `;
    let rows: Record<string, unknown>[];
    let total: number;
    if (options.groupBySubject !== false) {
      rows = this.db.prepare(`
        WITH filtered AS (
          SELECT ${selectColumns},
            COUNT(*) OVER (PARTITION BY subject_snapshot) subject_count,
            ROW_NUMBER() OVER (PARTITION BY subject_snapshot ORDER BY timestamp DESC, id DESC) row_num
          FROM images ${baseWhere}
        ), representatives AS (
          SELECT * FROM filtered WHERE row_num = 1
        )
        SELECT * FROM representatives ${cursorWhere}
        ORDER BY timestamp DESC, id DESC LIMIT ?
      `).all(...params, ...cursorParams, limit + 1);
      total = Number(this.db.prepare(`SELECT COUNT(DISTINCT subject_snapshot) count FROM images ${baseWhere}`).get(...params)?.count || 0);
    } else {
      const extra = cursor ? `${where.length ? 'AND' : 'WHERE'} (timestamp < ? OR (timestamp = ? AND id < ?))` : '';
      rows = this.db.prepare(`SELECT ${selectColumns}, 1 subject_count FROM images ${baseWhere} ${extra} ORDER BY timestamp DESC, id DESC LIMIT ?`)
        .all(...params, ...cursorParams, limit + 1);
      total = Number(this.db.prepare(`SELECT COUNT(*) count FROM images ${baseWhere}`).get(...params)?.count || 0);
    }
    const hasMore = rows.length > limit;
    const pageRows = rows.slice(0, limit);
    const last = pageRows.at(-1);
    return {
      images: pageRows.map(row => this.mapImage(row)),
      total,
      nextCursor: hasMore && last ? this.encodeCursor(Number(last.timestamp), String(last.id)) : null,
    };
  }

  getSubjectImages(subject: string) {
    return this.db.prepare(`
      SELECT id, remote_url, local_url, subject_snapshot, prompt, timestamp, status, is_saved,
        flagged, category_id, model, ratio, resolution, 1 subject_count
      FROM images WHERE subject_snapshot = ? ORDER BY timestamp DESC, id DESC
    `).all(subject).map(row => this.mapImage(row));
  }

  private mapImage(row: Record<string, unknown>): ImageRecord {
    return {
      id: String(row.id),
      url: String(row.remote_url || ''),
      localUrl: row.local_url ? String(row.local_url) : undefined,
      subject: String(row.subject_snapshot),
      prompt: String(row.prompt || ''),
      timestamp: Number(row.timestamp),
      status: String(row.status) as ImageRecord['status'],
      isSaved: Number(row.is_saved) === 1,
      flagged: Number(row.flagged) === 1,
      categoryId: row.category_id ? String(row.category_id) : 'uncategorized',
      metadata: { model: String(row.model || ''), ratio: String(row.ratio || ''), resolution: String(row.resolution || '') },
      subjectCount: Number(row.subject_count || 1),
      thumbnailUrl: row.local_url ? `/api/thumbnails/${encodeURIComponent(String(row.id))}` : undefined,
    };
  }

  private encodeCursor(timestamp: number, id: string) {
    return Buffer.from(JSON.stringify([timestamp, id])).toString('base64url');
  }

  private decodeCursor(cursor?: string) {
    if (!cursor) return null;
    try {
      const [timestamp, id] = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      return { timestamp: Number(timestamp), id: String(id) };
    } catch {
      return null;
    }
  }

  ensureSubject(subject: string, requestedCategoryId?: string) {
    const name = subject || 'Untitled';
    const existing = this.db.prepare('SELECT * FROM subjects WHERE name = ?').get(name);
    if (existing) return existing;
    const id = subjectIdFor(name);
    const categoryId = requestedCategoryId || 'uncategorized';
    const timestamp = nowIso();
    const folderName = `${safeFolderName(name, 'Untitled')}__${id.slice(-6)}`;
    this.db.prepare(`
      INSERT INTO subjects (id, name, normalized_name, category_id, folder_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, name.normalize('NFKC').toLocaleLowerCase(), categoryId, folderName, timestamp, timestamp);
    return this.db.prepare('SELECT * FROM subjects WHERE id = ?').get(id)!;
  }

  getSubjectStorage(subject: string) {
    const record = this.ensureSubject(subject);
    const categoryId = String(record.category_id || 'uncategorized');
    const relativePath = this.getCategoryFolder(categoryId);
    return { subjectId: String(record.id), categoryId, relativePath, absolutePath: path.join(this.downloadsDir, relativePath) };
  }

  upsertImage(image: ImageRecord) {
    const subject = this.ensureSubject(image.subject, image.categoryId);
    const categoryId = image.categoryId || String(subject.category_id || 'uncategorized');
    const timestamp = nowIso();
    this.db.prepare(`
      INSERT INTO images (
        id, subject_id, subject_snapshot, prompt, remote_url, local_url, timestamp, status,
        is_saved, flagged, category_id, model, ratio, resolution, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        subject_id = excluded.subject_id, subject_snapshot = excluded.subject_snapshot,
        prompt = excluded.prompt, remote_url = excluded.remote_url, local_url = excluded.local_url,
        timestamp = excluded.timestamp, status = excluded.status, is_saved = excluded.is_saved,
        flagged = excluded.flagged, category_id = excluded.category_id, model = excluded.model,
        ratio = excluded.ratio, resolution = excluded.resolution, updated_at = excluded.updated_at
    `).run(
      image.id, String(subject.id), image.subject, image.prompt || '', image.url || '', image.localUrl || null,
      image.timestamp, image.status, sqlBool(image.isSaved), sqlBool(image.flagged), categoryId,
      image.metadata?.model || '', image.metadata?.ratio || '', image.metadata?.resolution || '', timestamp, timestamp,
    );
    return this.getImageById(image.id);
  }

  getImageById(id: string) {
    const row = this.db.prepare(`
      SELECT id, remote_url, local_url, subject_snapshot, prompt, timestamp, status, is_saved,
        flagged, category_id, model, ratio, resolution, 1 subject_count
      FROM images WHERE id = ?
    `).get(id);
    return row ? this.mapImage(row) : null;
  }

  getImageWithSubject(id?: string, localUrl?: string) {
    const row = id
      ? this.db.prepare('SELECT i.*, s.folder_path, s.folder_name FROM images i JOIN subjects s ON s.id = i.subject_id WHERE i.id = ?').get(id)
      : this.db.prepare('SELECT i.*, s.folder_path, s.folder_name FROM images i JOIN subjects s ON s.id = i.subject_id WHERE i.local_url = ?').get(localUrl || '');
    return row || null;
  }

  getSubjectForImage(id?: string, localUrl?: string) {
    const image = this.getImageWithSubject(id, localUrl);
    if (!image) return null;
    const subject = this.db.prepare('SELECT * FROM subjects WHERE id = ?').get(String(image.subject_id));
    const images = this.db.prepare('SELECT id, local_url, timestamp FROM images WHERE subject_id = ?').all(String(image.subject_id));
    return { image, subject, images };
  }

  updateImage(id: string, changes: Partial<Pick<ImageRecord, 'flagged' | 'status' | 'localUrl' | 'categoryId' | 'isSaved'>>) {
    const current = this.getImageById(id);
    if (!current) return null;
    return this.upsertImage({ ...current, ...changes, metadata: current.metadata });
  }

  deleteImage(id: string) {
    const current = this.getImageById(id);
    if (!current) return null;
    this.transaction(() => {
      this.db.prepare('DELETE FROM images WHERE id = ?').run(id);
      this.db.prepare('DELETE FROM subjects WHERE id NOT IN (SELECT DISTINCT subject_id FROM images)').run();
    });
    return current;
  }

  recordFileOperation(values: { imageId?: string; subjectId: string; sourcePath: string; targetPath: string }) {
    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO file_operations (id, image_id, subject_id, source_path, target_path, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `).run(id, values.imageId || null, values.subjectId, values.sourcePath, values.targetPath, nowIso());
    return id;
  }

  completeFileOperation(operationId: string, imageId: string, localUrl: string) {
    this.transaction(() => {
      this.db.prepare('UPDATE images SET local_url = ?, updated_at = ? WHERE id = ?').run(localUrl, nowIso(), imageId);
      this.db.prepare("UPDATE file_operations SET status = 'completed', completed_at = ? WHERE id = ?").run(nowIso(), operationId);
    });
  }

  rewriteSubjectFolder(subjectId: string, oldRelativePath: string, newRelativePath: string, operationId: string) {
    const oldPrefix = `/downloads/${oldRelativePath.split(path.sep).map(encodeURIComponent).join('/')}`;
    const newPrefix = `/downloads/${newRelativePath.split(path.sep).map(encodeURIComponent).join('/')}`;
    this.transaction(() => {
      const rows = this.db.prepare('SELECT id, local_url FROM images WHERE subject_id = ?').all(subjectId);
      const update = this.db.prepare('UPDATE images SET local_url = ?, updated_at = ? WHERE id = ?');
      for (const row of rows) {
        const localUrl = row.local_url ? String(row.local_url) : '';
        if (localUrl.startsWith(oldPrefix)) update.run(`${newPrefix}${localUrl.slice(oldPrefix.length)}`, nowIso(), String(row.id));
      }
      this.db.prepare('UPDATE subjects SET folder_path = ?, updated_at = ? WHERE id = ?').run(newRelativePath, nowIso(), subjectId);
      this.db.prepare("UPDATE file_operations SET status = 'completed', completed_at = ? WHERE id = ?").run(nowIso(), operationId);
    });
  }

  failFileOperation(operationId: string, error: string) {
    this.db.prepare("UPDATE file_operations SET status = 'failed', error = ?, completed_at = ? WHERE id = ?").run(error, nowIso(), operationId);
  }

  finishSubjectMove(subjectId: string, categoryId: string, folderPath: string) {
    this.transaction(() => {
      this.db.prepare('UPDATE subjects SET category_id = ?, folder_path = ?, has_category_conflict = 0, updated_at = ? WHERE id = ?')
        .run(categoryId, folderPath, nowIso(), subjectId);
      this.db.prepare('UPDATE images SET category_id = ?, updated_at = ? WHERE subject_id = ?').run(categoryId, nowIso(), subjectId);
    });
  }

  getCategoryFolder(categoryId: string) {
    const row = this.db.prepare('SELECT storage_key FROM categories WHERE id = ?').get(categoryId);
    if (!row) throw new Error('Category not found');
    if (!row.storage_key) throw new Error('Category does not have a storage key');
    return safeStorageKey(String(row.storage_key), `category-${categoryId}`);
  }

  createCategory(input: { name: string; storageKey?: string; icon?: string }) {
    const name = input.name.trim();
    if (!name) throw new Error('Category name is required');
    const id = `cat_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const storageKey = safeStorageKey(input.storageKey || '', `category-${id.slice(-8)}`);
    const timestamp = nowIso();
    const maxOrder = Number(this.db.prepare('SELECT MAX(sort_order) value FROM categories').get()?.value || 0);
    this.db.prepare(`
      INSERT INTO categories (id, name, icon, sort_order, folder_name, storage_key, created_at, updated_at)
      VALUES (?, ?, ?, ?, NULL, ?, ?, ?)
    `).run(id, name, input.icon || 'Layers', maxOrder + 1, storageKey, timestamp, timestamp);
    return this.getCategory(id);
  }

  updateCategory(id: string, input: { name?: string; storageKey?: string; icon?: string }) {
    if (id === 'all') throw new Error('The All Work category cannot be edited');
    const current = this.db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!current) throw new Error('Category not found');
    const name = input.name === undefined ? String(current.name) : input.name.trim();
    if (!name) throw new Error('Category name is required');
    const storageKey = input.storageKey === undefined
      ? String(current.storage_key || safeStorageKey('', `category-${id}`))
      : safeStorageKey(input.storageKey, `category-${id}`);
    this.db.prepare('UPDATE categories SET name = ?, icon = ?, storage_key = ?, updated_at = ? WHERE id = ?')
      .run(name, input.icon === undefined ? current.icon : input.icon, storageKey, nowIso(), id);
    return this.getCategory(id);
  }

  deleteCategory(id: string) {
    if (id === 'all' || id === 'uncategorized') throw new Error('This category cannot be deleted');
    const count = Number(this.db.prepare('SELECT COUNT(*) count FROM images WHERE category_id = ?').get(id)?.count || 0);
    if (count > 0) throw new Error('Move or delete the category images before deleting it');
    const subjectCount = Number(this.db.prepare('SELECT COUNT(*) count FROM subjects WHERE category_id = ?').get(id)?.count || 0);
    if (subjectCount > 0) throw new Error('This category still contains subject records');
    const result = this.db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return Number(result.changes) > 0;
  }

  reorderCategories(ids: string[]) {
    this.transaction(() => {
      const update = this.db.prepare('UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ?');
      const timestamp = nowIso();
      ids.forEach((id, index) => update.run(index, timestamp, id));
    });
  }

  private getCategory(id: string) {
    const row = this.db.prepare('SELECT id, name, icon, folder_name, storage_key FROM categories WHERE id = ?').get(id);
    if (!row) return null;
    const count = id === 'all'
      ? Number(this.db.prepare('SELECT COUNT(*) count FROM images').get()?.count || 0)
      : Number(this.db.prepare('SELECT COUNT(*) count FROM images WHERE category_id = ?').get(id)?.count || 0);
    return {
      id: String(row.id),
      name: String(row.name),
      icon: row.icon ? String(row.icon) : undefined,
      folderName: row.folder_name ? String(row.folder_name) : undefined,
      storageKey: row.storage_key ? String(row.storage_key) : undefined,
      count,
    };
  }

  getProviderBaseUrl(provider: string) {
    const row = this.db.prepare('SELECT base_url FROM provider_configs WHERE provider = ?').get(provider);
    if (!row) throw new Error('Provider not found');
    return String(row.base_url).replace(/\/+$/, '');
  }

  listProviderBaseUrls() {
    return this.db.prepare('SELECT provider, base_url FROM provider_configs ORDER BY provider').all().map(row => ({
      provider: String(row.provider),
      baseUrl: String(row.base_url),
    }));
  }

  updateProviderBaseUrl(provider: string, baseUrl: string) {
    const url = new URL(baseUrl);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Provider URL must use HTTP or HTTPS');
    const normalized = url.toString().replace(/\/+$/, '');
    const result = this.db.prepare('UPDATE provider_configs SET base_url = ?, updated_at = ? WHERE provider = ?')
      .run(normalized, nowIso(), provider);
    if (Number(result.changes) === 0) throw new Error('Provider not found');
    return normalized;
  }

  getPendingFileOperations() {
    return this.db.prepare("SELECT * FROM file_operations WHERE status = 'pending' ORDER BY created_at").all();
  }

  saveSettings(data: { categories?: CategoryRecord[]; templates?: TemplateRecord[]; stats?: LegacyStats }) {
    this.transaction(() => {
      const timestamp = nowIso();
      if (data.categories) {
        const upsert = this.db.prepare(`
          INSERT INTO categories (id, name, icon, sort_order, folder_name, storage_key, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name, icon = excluded.icon,
            sort_order = excluded.sort_order, storage_key = COALESCE(categories.storage_key, excluded.storage_key), updated_at = excluded.updated_at
        `);
        data.categories.forEach((category, index) => {
          const folderName = category.id === 'all' ? null : safeFolderName(category.id === 'uncategorized' ? 'Uncategorized' : category.name, category.id);
          const storageKey = category.id === 'all' ? null : safeStorageKey(category.storageKey || '', `category-${category.id}`);
          upsert.run(category.id, category.name, category.icon || null, index, category.folderName || folderName, storageKey, timestamp, timestamp);
        });
      }
      if (data.templates) {
        this.db.prepare('DELETE FROM templates').run();
        const insert = this.db.prepare('INSERT INTO templates (id, name, content, is_pinned, sort_order, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
        data.templates.forEach((template, index) => insert.run(template.id, template.name, template.content, template.isPinned === false ? 0 : 1, index, timestamp));
      }
      if (data.stats) {
        this.db.prepare(`
          INSERT INTO generation_stats (id, total_attempts, successful, failed, updated_at)
          VALUES (1, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET total_attempts = excluded.total_attempts,
            successful = excluded.successful, failed = excluded.failed, updated_at = excluded.updated_at
        `).run(data.stats.totalAttempts, data.stats.successful, data.stats.failed, timestamp);
      }
    });
  }
}
