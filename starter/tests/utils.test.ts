import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorCodes, ReviewError, withRetry, withTimeout } from '../src/utils/error-handler.js';
import { RateLimiter } from '../src/utils/rate-limiter.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('withRetry', () => {
  it('returns the result when the function succeeds', async () => {
    await expect(withRetry(async () => 'ok', 3, 10)).resolves.toBe('ok');
  });

  it('retries with backoff and then succeeds', async () => {
    vi.useFakeTimers();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValueOnce('recovered');

    const promise = withRetry(fn, 3, 1000);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws ReviewError RETRY_EXHAUSTED when every attempt fails', async () => {
    vi.useFakeTimers();
    const fn = vi.fn().mockRejectedValue(new Error('still down'));
    const promise = withRetry(fn, 2, 10);
    const assertion = expect(promise).rejects.toBeInstanceOf(ReviewError);

    await vi.runAllTimersAsync();
    await assertion;
    await expect(withRetry(fn, 1, 10)).rejects.toMatchObject({ code: ErrorCodes.RETRY_EXHAUSTED });
    expect(fn).toHaveBeenCalled();
  });
});

describe('withTimeout', () => {
  it('returns the function result when it finishes in time', async () => {
    await expect(withTimeout(async () => 7, 1000)).resolves.toBe(7);
  });

  it('rejects with AGENT_TIMEOUT when the function is too slow', async () => {
    vi.useFakeTimers();
    const promise = withTimeout(() => new Promise(() => undefined), 500, 'too slow');
    const assertion = expect(promise).rejects.toMatchObject({
      code: ErrorCodes.AGENT_TIMEOUT,
      message: 'too slow',
      metadata: { timeoutMs: 500 }
    });

    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });
});

describe('RateLimiter', () => {
  it('allows a request under the default limits', async () => {
    const limiter = new RateLimiter();
    await limiter.acquire(1000);
    const status = limiter.getStatus();
    expect(status.activeRequests).toBe(1);
    expect(status.requestsInWindow).toBe(1);
    limiter.release();
    expect(limiter.getStatus().activeRequests).toBe(0);
  });

  it('blocks when the concurrent limit is reached and resumes after release', async () => {
    const limiter = new RateLimiter({ maxConcurrent: 1 });
    await limiter.acquire(10);

    let resumed = false;
    const pending = limiter.acquire(10).then(() => {
      resumed = true;
    });

    await new Promise((resolve) => setImmediate(resolve));
    expect(resumed).toBe(false);

    limiter.release();
    await pending;
    expect(resumed).toBe(true);
    expect(limiter.getStatus().activeRequests).toBe(1);
  });

  it('refuses another request when the per-minute request cap is full', async () => {
    const limiter = new RateLimiter({ maxRequestsPerMinute: 1, maxConcurrent: 5 });
    await limiter.acquire(10);
    limiter.release();
    expect(limiter.canProceed(10)).toBe(false);
  });

  it('refuses a request that would exceed the token budget', async () => {
    const limiter = new RateLimiter({ maxTokensPerMinute: 1000, maxConcurrent: 5 });
    await limiter.acquire(800);
    limiter.release();
    expect(limiter.canProceed(300)).toBe(false);
    expect(limiter.canProceed(200)).toBe(true);
  });

  it('drops records that fall outside the 60 second window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const limiter = new RateLimiter({ maxRequestsPerMinute: 2 });
    await limiter.acquire(10);
    limiter.release();
    expect(limiter.getStatus().requestsInWindow).toBe(1);

    vi.setSystemTime(new Date('2026-01-01T00:01:01.000Z'));
    expect(limiter.getStatus().requestsInWindow).toBe(0);
    expect(limiter.canProceed(10)).toBe(true);
  });
});
