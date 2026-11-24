import { HttpErrorResponse } from '@angular/common/http';

import { ApiError, toApiError } from './api-error';

describe('toApiError', () => {
    it('should keep an API error and its status', () => {
        // Arrange
        const original = new ApiError(401, 'Incorrect email or password.');

        // Act
        const error = toApiError(original, 'Fallback.');

        // Assert
        expect(error).toBe(original);
        expect(error.status).toBe(401);
    });

    it('should use the server message from an HTTP error', () => {
        // Arrange
        const response = new HttpErrorResponse({
            status: 409,
            error: { error: 'An account already exists for this email.' }
        });

        // Act
        const error = toApiError(response, 'Fallback.');

        // Assert
        expect(error.status).toBe(409);
        expect(error.message).toBe('An account already exists for this email.');
    });

    it('should fall back when the HTTP body has no message', () => {
        // Act
        const error = toApiError(new HttpErrorResponse({ status: 500 }), 'Something broke.');

        // Assert
        expect(error.status).toBe(500);
        expect(error.message).toBe('Something broke.');
    });

    it('should wrap a plain error as a network-style failure', () => {
        // Act
        const error = toApiError(new Error('network down'), 'Fallback.');

        // Assert
        expect(error.status).toBe(0);
        expect(error.message).toBe('network down');
    });

    it('should use the fallback for a non-error value', () => {
        // Act
        const error = toApiError(undefined, 'Fallback.');

        // Assert
        expect(error.status).toBe(0);
        expect(error.message).toBe('Fallback.');
    });
});
