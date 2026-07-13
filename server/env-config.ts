import fs from 'fs';
import path from 'path';

export const PROVIDER_ENV_KEYS = {
  apimart: 'APIMART_API_KEY',
  apikeyfun: 'APIKEYFUN_API_KEY',
  gemini: 'GEMINI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
} as const;

export type ProviderName = keyof typeof PROVIDER_ENV_KEYS;

export function isProviderName(value: string): value is ProviderName {
  return Object.prototype.hasOwnProperty.call(PROVIDER_ENV_KEYS, value);
}

function quoteEnvValue(value: string) {
  return JSON.stringify(value);
}

export class EnvConfig {
  private readonly envPath: string;
  private readonly backupPath: string;

  constructor(rootDir: string) {
    this.envPath = path.join(rootDir, '.env');
    this.backupPath = path.join(rootDir, '.env.bak');
  }

  isConfigured(provider: ProviderName) {
    return Boolean(process.env[PROVIDER_ENV_KEYS[provider]]?.trim());
  }

  setProviderKey(provider: ProviderName, value: string | null) {
    const variable = PROVIDER_ENV_KEYS[provider];
    const normalized = value?.trim() || '';
    if (/\r|\n/.test(normalized)) throw new Error('API key cannot contain line breaks');

    const current = fs.existsSync(this.envPath) ? fs.readFileSync(this.envPath, 'utf8') : '';
    const newline = current.includes('\r\n') ? '\r\n' : '\n';
    const lines = current ? current.split(/\r?\n/) : [];
    const pattern = new RegExp(`^\\s*${variable}\\s*=`);
    const nextLine = `${variable}=${quoteEnvValue(normalized)}`;
    const index = lines.findIndex(line => pattern.test(line));

    if (index >= 0) lines[index] = nextLine;
    else {
      if (lines.length && lines.at(-1) !== '') lines.push('');
      lines.push(nextLine);
    }

    const next = lines.join(newline);
    if (fs.existsSync(this.envPath)) fs.copyFileSync(this.envPath, this.backupPath);
    const temporaryPath = `${this.envPath}.tmp`;
    fs.writeFileSync(temporaryPath, next, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporaryPath, this.envPath);

    if (normalized) process.env[variable] = normalized;
    else delete process.env[variable];
  }
}
