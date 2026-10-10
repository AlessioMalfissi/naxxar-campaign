import { DOCUMENT } from '@angular/common';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { defer, Observable, retry, tap, timer } from 'rxjs';

import { CombatLiveEvent, CombatLiveEventType, IEncounter } from '../models';

export const COMBAT_LIVE_PATH = '/api/combat/live';

const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 15000;

export type WebSocketFactory = (url: string) => WebSocket;

// Swappable so tests can drive a fake socket.
export const WEB_SOCKET_FACTORY = new InjectionToken<WebSocketFactory>('WEB_SOCKET_FACTORY', {
    providedIn: 'root',
    factory: () => (url: string) => new WebSocket(url)
});

const isEncounter = (value: unknown): value is IEncounter => {
    const candidate = value as Partial<IEncounter> | null;
    return (
        typeof candidate === 'object' &&
        candidate !== null &&
        typeof candidate.revision === 'number' &&
        Array.isArray(candidate.combatants)
    );
};

// Anything that is not a well-formed `{ type: 'encounter', encounter }` message is dropped.
const parseEncounter = (data: unknown): IEncounter | null => {
    if (typeof data !== 'string') {
        return null;
    }

    try {
        const message = JSON.parse(data) as { type?: unknown; encounter?: unknown } | null;
        return message?.type === CombatLiveEventType.Encounter && isEncounter(message.encounter)
            ? message.encounter
            : null;
    } catch {
        return null;
    }
};

// 1s, 2s, 4s, 8s, then every 15s.
const retryDelay = (attempt: number): number => Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);

@Injectable({ providedIn: 'root' })
export class CombatLiveService {
    private readonly document = inject(DOCUMENT);
    private readonly createSocket = inject(WEB_SOCKET_FACTORY);

    /*
     * Streams the encounter the server pushes on connect and after every save, plus the connection
     * state. A dropped connection is reported as Disconnected and reopened with backoff for as long as
     * the stream is subscribed; the backoff restarts once a connection opens. Unsubscribing closes the socket.
     */
    connect(): Observable<CombatLiveEvent> {
        return defer(() => {
            let failures = 0;

            return this.open().pipe(
                tap((event) => {
                    if (event.type === CombatLiveEventType.Connected) {
                        failures = 0;
                    }
                }),
                retry({
                    delay: () => {
                        failures += 1;
                        return timer(retryDelay(failures));
                    }
                })
            );
        });
    }

    // One socket: emits while it is open, then Disconnected and an error once it closes.
    private open(): Observable<CombatLiveEvent> {
        return new Observable<CombatLiveEvent>((subscriber) => {
            const socket = this.createSocket(this.liveUrl());

            socket.onopen = (): void => {
                subscriber.next({ type: CombatLiveEventType.Connected });
            };
            socket.onmessage = (event: MessageEvent): void => {
                const encounter = parseEncounter(event.data);
                if (encounter !== null) {
                    subscriber.next({ type: CombatLiveEventType.Encounter, encounter });
                }
            };
            socket.onclose = (): void => {
                subscriber.next({ type: CombatLiveEventType.Disconnected });
                subscriber.error(new Error('The combat live connection closed.'));
            };

            return (): void => {
                socket.onopen = null;
                socket.onmessage = null;
                socket.onclose = null;
                socket.close();
            };
        });
    }

    private liveUrl(): string {
        const { protocol, host } = this.document.location;
        return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}${COMBAT_LIVE_PATH}`;
    }
}
