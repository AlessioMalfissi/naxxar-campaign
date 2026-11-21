import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';

const GOOGLE_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

interface IGoogleCredentialResponse {
    credential?: string;
}

interface IGoogleIdentity {
    accounts: {
        id: {
            initialize(options: {
                client_id: string;
                callback: (response: IGoogleCredentialResponse) => void;
            }): void;
            renderButton(
                parent: HTMLElement,
                options: { theme?: string; size?: string; text?: string; width?: number }
            ): void;
        };
    };
}

type GoogleWindow = Window & { google?: IGoogleIdentity };

// Loads Google Identity Services once per page and renders its button. Kept out of the auth
// components so tests can replace it, and so no component has to know about script tags.
@Injectable({ providedIn: 'root' })
export class GoogleSignInService {
    private readonly document = inject(DOCUMENT);
    private loading: Promise<void> | null = null;

    async renderButton(
        parent: HTMLElement,
        clientId: string,
        onCredential: (credential: string) => void
    ): Promise<void> {
        await this.loadScript();

        const google = (this.document.defaultView as GoogleWindow | null)?.google;
        if (google === undefined) {
            throw new Error('Google sign-in is unavailable.');
        }

        google.accounts.id.initialize({
            client_id: clientId,
            callback: (response) => {
                if (typeof response.credential === 'string' && response.credential !== '') {
                    onCredential(response.credential);
                }
            }
        });
        parent.replaceChildren();
        google.accounts.id.renderButton(parent, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            width: parent.clientWidth > 0 ? parent.clientWidth : 320
        });
    }

    private loadScript(): Promise<void> {
        if ((this.document.defaultView as GoogleWindow | null)?.google !== undefined) {
            return Promise.resolve();
        }
        if (this.loading !== null) {
            return this.loading;
        }

        this.loading = new Promise<void>((resolve, reject) => {
            const script = this.document.createElement('script');
            script.src = GOOGLE_SCRIPT_URL;
            script.async = true;
            script.defer = true;
            script.onload = (): void => resolve();
            script.onerror = (): void => {
                this.loading = null;
                reject(new Error('Could not load Google sign-in.'));
            };
            this.document.head.appendChild(script);
        });

        return this.loading;
    }
}
