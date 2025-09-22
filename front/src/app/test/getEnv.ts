export function getEnv(key: string): string | undefined {
  if (typeof window !== "undefined") {
    // Client-side: use NEXT_PUBLIC_ prefixed environment variables
    return process.env[`NEXT_PUBLIC_${key}`];
  } else {
    // Server-side: use any environment variable
    return process.env[key] || process.env[`NEXT_PUBLIC_${key}`];
  }
}