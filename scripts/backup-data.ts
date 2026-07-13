import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { AtlasDatabase } from '../server/database.ts';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(rootDir, 'backups', `manual-${stamp}`);
const database = new AtlasDatabase(rootDir);

fs.mkdirSync(backupDir, { recursive: true });
const databaseBackup = path.join(backupDir, 'atlas.db');
database.db.exec('PRAGMA wal_checkpoint(FULL)');
database.db.exec(`VACUUM INTO '${databaseBackup.replace(/'/g, "''")}'`);

for (const name of ['migration-report.json', 'images.json', 'templates.json', 'categories.json', 'stats.json']) {
  const source = path.join(rootDir, name);
  if (fs.existsSync(source)) fs.copyFileSync(source, path.join(backupDir, name));
}

database.db.close();
console.log(`Data backup created: ${backupDir}`);
