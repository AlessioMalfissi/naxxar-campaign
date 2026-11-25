import { HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { of, throwError } from 'rxjs';

import { GuestModeService } from '@core/guest/guest-mode.service';
import {
    findGuestEntry,
    GUEST_CAMPAIGN,
    GUEST_CAMPAIGN_SLUG,
    GUEST_CONFIG,
    GUEST_ENCOUNTER,
    GUEST_INVENTORY,
    GUEST_MEMBERS,
    GUEST_PURSES,
    GUEST_READ_ONLY_MESSAGE,
    GUEST_USER,
    guestEntrySummaries
} from '@core/guest/guest-data';

const DEMO_CAMPAIGN_PATH = `/api/campaigns/${GUEST_CAMPAIGN_SLUG}`;

const ok = <T>(request: HttpRequest<unknown>, body: T): HttpResponse<T> =>
    new HttpResponse({ status: 200, body, url: request.url });

const failure = (request: HttpRequest<unknown>, status: number, message: string): HttpErrorResponse =>
    new HttpErrorResponse({
        status,
        statusText: status === 403 ? 'Forbidden' : 'Not Found',
        url: request.url,
        error: { error: message }
    });

export const guestApiInterceptor: HttpInterceptorFn = (request, next) => {
    const guestMode = inject(GuestModeService);
    const url = new URL(request.urlWithParams, 'http://guest.local');
    const path = url.pathname.replace(/\/+$/, '');

    if (!guestMode.isGuest() || !path.startsWith('/api/')) {
        return next(request);
    }

    // Signing out must leave the demo even though there is no server session to end.
    if (request.method === 'POST' && path === '/api/auth/logout') {
        guestMode.leave();
        return of(ok(request, { ok: true }));
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
        return throwError(() => failure(request, 403, GUEST_READ_ONLY_MESSAGE));
    }

    if (path === '/api/config') {
        return of(ok(request, GUEST_CONFIG));
    }

    if (path === '/api/auth/me') {
        return of(ok(request, { user: GUEST_USER, campaigns: [GUEST_CAMPAIGN] }));
    }

    if (path === '/api/campaigns') {
        return of(ok(request, [GUEST_CAMPAIGN]));
    }

    if (path === DEMO_CAMPAIGN_PATH) {
        return of(ok(request, { campaign: GUEST_CAMPAIGN }));
    }

    if (path === `${DEMO_CAMPAIGN_PATH}/entries`) {
        return of(ok(request, guestEntrySummaries(url.searchParams)));
    }

    if (path.startsWith(`${DEMO_CAMPAIGN_PATH}/entries/`)) {
        const [section, slug] = path.slice(`${DEMO_CAMPAIGN_PATH}/entries/`.length).split('/');
        const entry = findGuestEntry(section ?? '', slug ?? '');
        if (entry === null) {
            return throwError(() => failure(request, 404, 'Entry not found.'));
        }

        return of(ok(request, entry));
    }

    if (path === `${DEMO_CAMPAIGN_PATH}/members`) {
        return of(ok(request, { members: GUEST_MEMBERS }));
    }

    if (path === `${DEMO_CAMPAIGN_PATH}/inventory`) {
        return of(ok(request, GUEST_INVENTORY));
    }

    if (path === `${DEMO_CAMPAIGN_PATH}/purses`) {
        return of(ok(request, GUEST_PURSES));
    }

    if (path === `${DEMO_CAMPAIGN_PATH}/combat`) {
        return of(ok(request, GUEST_ENCOUNTER));
    }

    if (path === `${DEMO_CAMPAIGN_PATH}/invites`) {
        return throwError(() => failure(request, 403, 'Only the Dungeon Master can manage invites.'));
    }

    return throwError(() => failure(request, 404, 'Not found in the demo.'));
};
