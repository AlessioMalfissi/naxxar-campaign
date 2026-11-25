import { HttpErrorResponse, HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';

import { GUEST_CAMPAIGN, GUEST_CONFIG, GUEST_READ_ONLY_MESSAGE, GUEST_USER } from '@core/guest/guest-data';
import { GuestModeService } from '@core/guest/guest-mode.service';
import { guestApiInterceptor } from './guest-api.interceptor';

describe('guestApiInterceptor', () => {
    let guestMode: { isGuest: jest.Mock; leave: jest.Mock };
    let next: jest.Mock;

    const run = (method: string, url: string): Promise<unknown> => {
        const request = new HttpRequest(method, url);
        return firstValueFrom(TestBed.runInInjectionContext(() => guestApiInterceptor(request, next))).catch(
            (error: unknown) => error
        );
    };

    const bodyOf = (result: unknown): unknown => (result as HttpResponse<unknown>).body;

    beforeEach(() => {
        // Arrange
        guestMode = { isGuest: jest.fn().mockReturnValue(true), leave: jest.fn() };
        next = jest.fn().mockReturnValue(of(new HttpResponse({ status: 200 })));
        TestBed.configureTestingModule({
            providers: [{ provide: GuestModeService, useValue: guestMode }]
        });
    });

    it('should leave a normal API request untouched', async () => {
        // Arrange
        guestMode.isGuest.mockReturnValue(false);

        // Act
        const result = await run('GET', '/api/config');

        // Assert
        expect(next).toHaveBeenCalled();
        expect(result).toBeInstanceOf(HttpResponse);
    });

    it('should leave non-API requests untouched', async () => {
        // Act
        const result = await run('GET', '/assets/logo.svg');

        // Assert
        expect(next).toHaveBeenCalled();
        expect(result).toBeInstanceOf(HttpResponse);
    });

    it('should serve the public config without Google sign-in', async () => {
        // Act
        const result = await run('GET', '/api/config');

        // Assert
        expect(bodyOf(result)).toEqual(GUEST_CONFIG);
        expect(next).not.toHaveBeenCalled();
    });

    it('should answer the session check with the demo account', async () => {
        // Act
        const result = await run('GET', '/api/auth/me');

        // Assert
        expect(bodyOf(result)).toEqual({ user: GUEST_USER, campaigns: [GUEST_CAMPAIGN] });
    });

    it('should list the demo campaign', async () => {
        // Act
        const result = await run('GET', '/api/campaigns');

        // Assert
        expect(bodyOf(result)).toEqual([GUEST_CAMPAIGN]);
    });

    it('should filter the codex index and hide DM-only entries', async () => {
        // Act
        const result = await run('GET', '/api/campaigns/demo/entries?section=npcs&query=vaelith');

        // Assert
        expect(bodyOf(result)).toEqual([
            expect.objectContaining({ id: 'npcs:vaelith-corrun', title: 'Vaelith Corrun' })
        ]);
    });

    it('should return an empty list when a guest asks for DM entries', async () => {
        // Act
        const result = await run('GET', '/api/campaigns/demo/entries?visibility=dm');

        // Assert
        expect(bodyOf(result)).toEqual([]);
    });

    it('should return a revealed entry without its DM block', async () => {
        // Act
        const result = await run('GET', '/api/campaigns/demo/entries/npcs/vaelith-corrun');
        const body = bodyOf(result) as { body: string };

        // Assert
        expect(body.body).toContain('Broker of debts');
        expect(body.body).not.toContain('Vaelith already sold');
    });

    it('should hide a DM-only entry from a guest', async () => {
        // Act
        const result = await run('GET', '/api/campaigns/demo/entries/story/session-14');

        // Assert
        expect(result).toBeInstanceOf(HttpErrorResponse);
        expect((result as HttpErrorResponse).status).toBe(404);
    });

    it.each([
        ['/api/campaigns/demo/members', { members: expect.any(Array) }],
        ['/api/campaigns/demo/inventory', expect.any(Array)],
        ['/api/campaigns/demo/purses', expect.any(Array)],
        ['/api/campaigns/demo/combat', expect.objectContaining({ revision: 4 })]
    ])('should serve mocked data for %s', async (url, expected) => {
        // Act
        const result = await run('GET', url);

        // Assert
        expect(bodyOf(result)).toEqual(expected);
    });

    it('should reject every guest write', async () => {
        // Act
        const result = await run('POST', '/api/campaigns/demo/entries');

        // Assert
        expect(result).toBeInstanceOf(HttpErrorResponse);
        expect((result as HttpErrorResponse).status).toBe(403);
        expect((result as HttpErrorResponse).error).toEqual({ error: GUEST_READ_ONLY_MESSAGE });
    });

    it('should forbid invite management', async () => {
        // Act
        const result = await run('GET', '/api/campaigns/demo/invites');

        // Assert
        expect(result).toBeInstanceOf(HttpErrorResponse);
        expect((result as HttpErrorResponse).status).toBe(403);
    });

    it('should answer unknown routes with a 404', async () => {
        // Act
        const result = await run('GET', '/api/campaigns/demo/unknown');

        // Assert
        expect(result).toBeInstanceOf(HttpErrorResponse);
        expect((result as HttpErrorResponse).status).toBe(404);
    });

    it('should leave guest mode when the client signs out', async () => {
        // Act
        const result = await run('POST', '/api/auth/logout');

        // Assert
        expect(guestMode.leave).toHaveBeenCalled();
        expect(bodyOf(result)).toEqual({ ok: true });
    });
});
