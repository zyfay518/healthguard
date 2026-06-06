export function formatError(error: any, fallback = 'Request failed'): string {
    if (!error) return fallback;
    if (typeof error === 'string') return error;
    if (typeof error === 'number' || typeof error === 'boolean') return String(error);
    if (typeof error.message === 'string') return error.message;
    if (error.message) return formatError(error.message, fallback);
    if (typeof error.error === 'string') return error.error;
    if (error.error) return formatError(error.error, fallback);
    try {
        return JSON.stringify(error);
    } catch {
        return fallback;
    }
}
