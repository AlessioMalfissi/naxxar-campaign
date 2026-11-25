import { inject, Injectable, signal } from '@angular/core';
import { Store } from '@ngrx/store';

import * as AuthActions from '@store/auth/auth.actions';
import { GUEST_CAMPAIGN, GUEST_STORAGE_KEY, GUEST_USER } from './guest-data';

// Keeps the demo session in sessionStorage so a refresh stays in the demo but closing the tab
// leaves no trace. The mock HTTP layer and the campaign shell both read this flag.
@Injectable({ providedIn: 'root' })
export class GuestModeService {
    private readonly store = inject(Store);
    private readonly active = signal(this.readStoredFlag());

    readonly isGuest = this.active.asReadonly();

    enter(): void {
        if (!this.active()) {
            this.active.set(true);
            this.writeStoredFlag(true);
            this.seedAuthState();
        }
    }

    leave(): void {
        this.active.set(false);
        this.writeStoredFlag(false);
    }

    // App bootstrap calls this before the first route guard runs, so refreshing a demo URL keeps
    // the existing auth state rather than falling back to a server session check.
    restore(): void {
        if (this.active()) {
            this.seedAuthState();
        }
    }

    private seedAuthState(): void {
        this.store.dispatch(
            AuthActions.guestEntered({
                user: GUEST_USER,
                campaigns: [GUEST_CAMPAIGN]
            })
        );
    }

    private readStoredFlag(): boolean {
        try {
            return globalThis.sessionStorage?.getItem(GUEST_STORAGE_KEY) === 'true';
        } catch {
            return false;
        }
    }

    private writeStoredFlag(active: boolean): void {
        try {
            if (active) {
                globalThis.sessionStorage?.setItem(GUEST_STORAGE_KEY, 'true');
            } else {
                globalThis.sessionStorage?.removeItem(GUEST_STORAGE_KEY);
            }
        } catch {
            // Storage can be unavailable in private browsing; the in-memory flag still works.
        }
    }
}
