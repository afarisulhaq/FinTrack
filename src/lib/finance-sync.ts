export function createFinanceSync() {
  let revision = 0;
  let pending = 0;
  const waiting = new Set<() => void>();

  return {
    beginWrite() {
      revision++;
      pending++;
      return () => {
        revision++;
        pending--;
        if (pending === 0) {
          for (const resolve of waiting) resolve();
          waiting.clear();
        }
      };
    },
    snapshot() {
      return revision;
    },
    isCurrent(snapshot: number) {
      return pending === 0 && snapshot === revision;
    },
    async waitForWrites() {
      if (pending > 0)
        await new Promise<void>((resolve) => waiting.add(resolve));
    },
  };
}
