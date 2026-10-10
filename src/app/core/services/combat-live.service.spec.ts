import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Subscription } from 'rxjs';

import { CombatLiveEvent, CombatLiveEventType } from '@core/models';
import { buildEncounter } from '@testing/combat.fixtures';
import { CombatLiveService, WEB_SOCKET_FACTORY } from './combat-live.service';

interface IFakeSocket {
    url: string;
    onopen: (() => void) | null;
    onmessage: ((event: { data: unknown }) => void) | null;
    onclose: (() => void) | null;
    close: jest.Mock;
}

describe('CombatLiveService', () => {
    let service: CombatLiveService;
    let sockets: IFakeSocket[];
    let events: CombatLiveEvent[];
    let subscription: Subscription | null;

    const configure = (protocol: string): void => {
        TestBed.configureTestingModule({
            providers: [
                { provide: DOCUMENT, useValue: { location: { protocol, host: 'table.example:4200' } } },
                {
                    provide: WEB_SOCKET_FACTORY,
                    useValue: (url: string) => {
                        const socket: IFakeSocket = { url, onopen: null, onmessage: null, onclose: null, close: jest.fn() };
                        sockets.push(socket);
                        return socket as unknown as WebSocket;
                    }
                }
            ]
        });
        service = TestBed.inject(CombatLiveService);
    };

    const listen = (): void => {
        subscription = service.connect().subscribe((event) => events.push(event));
    };

    const latest = (): IFakeSocket => sockets[sockets.length - 1];

    beforeEach(() => {
        // Arrange
        jest.useFakeTimers();
        sockets = [];
        events = [];
        subscription = null;
    });

    afterEach(() => {
        subscription?.unsubscribe();
        jest.useRealTimers();
    });

    it('should open a ws socket on the live path for an http page', () => {
        // Arrange
        configure('http:');

        // Act
        listen();

        // Assert
        expect(latest().url).toBe('ws://table.example:4200/api/combat/live');
    });

    it('should open a wss socket for an https page', () => {
        // Arrange
        configure('https:');

        // Act
        listen();

        // Assert
        expect(latest().url).toBe('wss://table.example:4200/api/combat/live');
    });

    it('should report the connection and every pushed encounter', () => {
        // Arrange
        configure('http:');
        const encounter = buildEncounter({ revision: 2 });
        listen();

        // Act
        latest().onopen?.();
        latest().onmessage?.({ data: JSON.stringify({ type: 'encounter', encounter }) });

        // Assert
        expect(events).toEqual([
            { type: CombatLiveEventType.Connected },
            { type: CombatLiveEventType.Encounter, encounter }
        ]);
    });

    it('should drop messages that are not well-formed encounters', () => {
        // Arrange
        configure('http:');
        listen();

        // Act
        latest().onmessage?.({ data: 'not json' });
        latest().onmessage?.({ data: new ArrayBuffer(2) });
        latest().onmessage?.({ data: 'null' });
        latest().onmessage?.({ data: JSON.stringify({ type: 'other', encounter: buildEncounter() }) });
        latest().onmessage?.({ data: JSON.stringify({ type: 'encounter', encounter: { round: 1 } }) });

        // Assert
        expect(events.length).toBe(0);
    });

    it('should report a dropped connection and reconnect with backoff', () => {
        // Arrange
        configure('http:');
        listen();

        // Act
        latest().onclose?.();
        jest.advanceTimersByTime(999);
        const beforeDelay = sockets.length;
        jest.advanceTimersByTime(1);
        const afterFirstDelay = sockets.length;
        latest().onclose?.();
        jest.advanceTimersByTime(1999);
        const beforeSecondDelay = sockets.length;
        jest.advanceTimersByTime(1);

        // Assert
        expect(events).toEqual([{ type: CombatLiveEventType.Disconnected }, { type: CombatLiveEventType.Disconnected }]);
        expect(beforeDelay).toBe(1);
        expect(afterFirstDelay).toBe(2);
        expect(beforeSecondDelay).toBe(2);
        expect(sockets.length).toBe(3);
    });

    it('should restart the backoff once a reconnect succeeds', () => {
        // Arrange
        configure('http:');
        listen();
        latest().onclose?.();
        jest.advanceTimersByTime(1000);
        latest().onclose?.();
        jest.advanceTimersByTime(2000);

        // Act
        latest().onopen?.();
        latest().onclose?.();
        jest.advanceTimersByTime(1000);

        // Assert
        expect(sockets.length).toBe(4);
    });

    it('should cap the reconnect delay', () => {
        // Arrange
        configure('http:');
        listen();
        [1000, 2000, 4000, 8000].forEach((delay) => {
            latest().onclose?.();
            jest.advanceTimersByTime(delay);
        });

        // Act
        latest().onclose?.();
        jest.advanceTimersByTime(14999);
        const beforeCap = sockets.length;
        jest.advanceTimersByTime(1);

        // Assert
        expect(beforeCap).toBe(5);
        expect(sockets.length).toBe(6);
    });

    it('should close the socket and stop reconnecting on unsubscribe', () => {
        // Arrange
        configure('http:');
        listen();
        const socket = latest();

        // Act
        subscription?.unsubscribe();
        jest.advanceTimersByTime(60000);

        // Assert
        expect(socket.close).toHaveBeenCalledTimes(1);
        expect(socket.onclose === null).toBe(true);
        expect(sockets.length).toBe(1);
    });
});
