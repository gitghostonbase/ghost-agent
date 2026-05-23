export type CapturedStdoutResult<T> = {
  value: T;
  capturedStdout: string[];
};

export async function withoutProtocolStdout<T>(
  run: () => Promise<T>,
): Promise<CapturedStdoutResult<T>> {
  const originalWrite = process.stdout.write.bind(process.stdout);
  const originalConsoleLog = console.log.bind(console);
  const capturedStdout: string[] = [];

  const captureWrite: typeof process.stdout.write = function write(
    chunk: string | Uint8Array,
    encodingOrCallback?: BufferEncoding | ((error?: Error | null) => void),
    callback?: (error?: Error | null) => void,
  ): boolean {
    capturedStdout.push(
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8"),
    );
    if (typeof encodingOrCallback === "function") {
      encodingOrCallback(null);
    }
    if (callback) {
      callback(null);
    }
    return true;
  };

  process.stdout.write = captureWrite;
  console.log = ((...args: unknown[]) => {
    capturedStdout.push(`${args.map(String).join(" ")}\n`);
  }) as typeof console.log;
  try {
    return { value: await run(), capturedStdout };
  } finally {
    process.stdout.write = originalWrite;
    console.log = originalConsoleLog;
  }
}
