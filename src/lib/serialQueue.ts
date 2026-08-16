/** Chains async work so only one task runs at a time; failures do not break the chain. */
export function createSerialQueue() {
  let chain: Promise<void> = Promise.resolve()

  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = chain.then(task)
    chain = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }
}
