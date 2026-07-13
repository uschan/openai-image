import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AtlasDatabase } from '../server/database.ts';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const database = new AtlasDatabase(rootDir);
const integrity = database.db.prepare('PRAGMA integrity_check').all();
const foreignKeys = database.db.prepare('PRAGMA foreign_key_check').all();
const rows = database.db.prepare("SELECT id, local_url FROM images WHERE local_url IS NOT NULL AND local_url != ''").all();
const missing: Array<{ id: string; localUrl: string }> = [];

for (const row of rows) {
  const localUrl = String(row.local_url);
  if (!localUrl.startsWith('/downloads/')) continue;
  const relative = decodeURIComponent(localUrl.slice('/downloads/'.length));
  const filePath = path.resolve(rootDir, 'downloads', relative);
  if (!fs.existsSync(filePath)) missing.push({ id: String(row.id), localUrl });
}

const bootstrap = database.getBootstrap();
const report = {
  integrity,
  foreignKeyErrors: foreignKeys,
  images: bootstrap.totalImages,
  subjects: Number(database.db.prepare('SELECT COUNT(*) count FROM subjects').get()?.count || 0),
  templates: bootstrap.templates.length,
  categories: bootstrap.categories.length,
  missingFiles: missing,
  pendingFileOperations: database.getPendingFileOperations(),
};

console.log(JSON.stringify(report, null, 2));
database.db.close();

if (integrity.some(row => row.integrity_check !== 'ok') || foreignKeys.length || missing.length) {
  process.exitCode = 1;
}
