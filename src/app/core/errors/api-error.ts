import { HttpErrorResponse } from '@angular/common/http';

// Keeps the HTTP status alongside the message so callers can branch on 404/409/410 instead of
// matching message text.
export class ApiError extends Error {
    constructor(
        readonly status: number,
        message: string
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export const toApiError = (error: unknown, fallback: string): ApiError => {
    if (error instanceof HttpErrorResponse) {
        const body = error.error as { error?: unknown } | null;
        const message = typeof body?.error === 'string' && body.error.trim() !== '' ? body.error : fallback;
        return new ApiError(error.status, message);
    }

    if (error instanceof Error && error.message.trim() !== '') {
        return new ApiError(0, error.message);
    }

    return new ApiError(0, fallback);
};
