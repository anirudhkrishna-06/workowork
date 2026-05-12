export function debugLog(scope: string, message: string, details?: unknown) {
  const prefix = `[WorkoWork:${scope}] ${message}`;

  if (details === undefined) {
    console.log(prefix);
    return;
  }

  console.log(prefix, details);
}

export function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return error;
}

export function preview(value: string, length = 600) {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}
