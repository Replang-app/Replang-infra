export interface FetchRetryOptions extends RequestInit {
  /** Nombre de tentatives supplémentaires après le 1er échec (défaut 3). */
  retries?: number;
  /** Délai de base du backoff exponentiel en ms (défaut 200). */
  backoffMs?: number;
  /** Timeout par tentative en ms (défaut 10000). */
  timeoutMs?: number;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * `fetch` pour les appels inter-services avec timeout + retry à backoff
 * exponentiel sur erreurs réseau et réponses 5xx (cf. doc §9.3).
 * Les 4xx ne sont PAS retentées (erreur côté appelant).
 */
export async function fetchWithRetry(
  url: string,
  options: FetchRetryOptions = {},
): Promise<Response> {
  const { retries = 3, backoffMs = 200, timeoutMs = 10_000, ...init } = options;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (res.status >= 500 && attempt < retries) {
        await delay(backoffMs * 2 ** attempt);
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < retries) {
        await delay(backoffMs * 2 ** attempt);
        continue;
      }
    }
  }
  throw lastError;
}
