/**
 * Safe-to-log description of a failure: type, provider HTTP status/code, and a
 * short message. Our own errors use fixed messages and provider (OpenAI,
 * Supabase) errors describe configuration problems, so no user text is logged.
 */
export function errorInfo(error: unknown) {
  if (!(error instanceof Error)) return { errorType: "Unknown" };
  const details = error as Error & { status?: unknown; code?: unknown };
  return {
    errorType: error.constructor?.name || error.name,
    errorStatus: typeof details.status === "number" ? details.status : undefined,
    errorCode: typeof details.code === "string" ? details.code : undefined,
    errorMessage: error.message.slice(0, 200),
  };
}
