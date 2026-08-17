const USER_AGENT = 'FuelMapEurope/1.0 (+https://github.com/fuelmap-europe)';

export interface HttpFetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  retries?: number;
}

export class HttpFetchError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'HttpFetchError';
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export async function fetchWithRetry(
  url: string,
  options: HttpFetchOptions = {},
): Promise<{ body: string; bytes: number; contentType: string | null }> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const maxBytes = options.maxBytes ?? 100 * 1024 * 1024;
  const maxRetries = options.retries ?? 3;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'application/json, text/csv, */*',
        },
      });

      if (!response.ok) {
        const retryable = isRetryableStatus(response.status);
        if (retryable && attempt < maxRetries) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw new HttpFetchError(
          `HTTP ${response.status} fetching ${url}`,
          response.status,
          retryable,
        );
      }

      const contentLength = response.headers.get('content-length');
      if (contentLength && Number(contentLength) > maxBytes) {
        throw new HttpFetchError(
          `Response too large (${contentLength} bytes)`,
          response.status,
          false,
        );
      }

      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > maxBytes) {
        throw new HttpFetchError(
          `Response body exceeds ${maxBytes} bytes`,
          response.status,
          false,
        );
      }

      return {
        body: new TextDecoder('utf-8').decode(buffer),
        bytes: buffer.byteLength,
        contentType: response.headers.get('content-type'),
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const retryable =
        lastError.name === 'AbortError' ||
        (lastError instanceof HttpFetchError && lastError.retryable);

      if (retryable && attempt < maxRetries) {
        await sleep(500 * 2 ** attempt);
        continue;
      }

      if (lastError.name === 'AbortError') {
        throw new HttpFetchError(
          `Request timed out after ${timeoutMs}ms`,
          undefined,
          true,
        );
      }
      throw lastError;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new HttpFetchError('Request failed');
}

export async function fetchJsonWithRetry<T>(
  url: string,
  options?: HttpFetchOptions,
): Promise<{ data: T; bytes: number; contentType: string | null }> {
  const { body, bytes, contentType } = await fetchWithRetry(url, options);
  try {
    return { data: JSON.parse(body) as T, bytes, contentType };
  } catch {
    throw new HttpFetchError('Invalid JSON response', undefined, false);
  }
}
