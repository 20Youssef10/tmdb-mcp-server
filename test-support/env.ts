declare const process: {
  env: Record<string, string | undefined>;
};

interface FileModule {
  readFileSync(path: string, encoding: string): string;
}

export async function loadLocalEnvFile(path = '.dev.vars'): Promise<Record<string, string>> {
  try {
    const fs = await import('fs') as FileModule;
    const content = fs.readFileSync(path, 'utf-8');
    const env: Record<string, string> = {};

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const [key, ...valueParts] = trimmed.split('=');
      if (!key || valueParts.length === 0) {
        continue;
      }

      env[key.trim()] = valueParts.join('=').trim();
    }

    return env;
  } catch {
    return {};
  }
}

export async function getTMDBApiKey(path = '.dev.vars'): Promise<string | undefined> {
  return process.env.TMDB_API_KEY || (await loadLocalEnvFile(path)).TMDB_API_KEY;
}

export function formatConnectivityError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
