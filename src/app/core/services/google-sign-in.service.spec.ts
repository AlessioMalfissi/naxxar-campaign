import { TestBed } from '@angular/core/testing';

import { GoogleSignInService } from './google-sign-in.service';

interface IGoogleMock {
    accounts: {
        id: {
            initialize: jest.Mock;
            renderButton: jest.Mock;
        };
    };
}

const googleWindow = window as unknown as { google?: IGoogleMock };

const installGoogle = (): IGoogleMock => {
    const google: IGoogleMock = {
        accounts: {
            id: {
                initialize: jest.fn(),
                renderButton: jest.fn()
            }
        }
    };
    googleWindow.google = google;
    return google;
};

describe('GoogleSignInService', () => {
    let service: GoogleSignInService;
    let parent: HTMLElement;

    beforeEach(() => {
        // Arrange
        TestBed.configureTestingModule({ providers: [GoogleSignInService] });
        service = TestBed.inject(GoogleSignInService);
        parent = document.createElement('div');
        document.body.appendChild(parent);
    });

    afterEach(() => {
        delete googleWindow.google;
        parent.remove();
        document
            .querySelectorAll('script[src="https://accounts.google.com/gsi/client"]')
            .forEach((node) => node.remove());
    });

    it('should initialize the Google client with the configured id', async () => {
        // Arrange
        const google = installGoogle();

        // Act
        await service.renderButton(parent, 'client-id', jest.fn());

        // Assert
        expect(google.accounts.id.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'client-id' }));
    });

    it('should render the button into the supplied element', async () => {
        // Arrange
        const google = installGoogle();
        Object.defineProperty(parent, 'clientWidth', { value: 260, configurable: true });

        // Act
        await service.renderButton(parent, 'client-id', jest.fn());

        // Assert
        expect(parent.childElementCount).toBe(0);
        expect(google.accounts.id.renderButton).toHaveBeenCalledWith(
            parent,
            expect.objectContaining({ width: 260, theme: 'outline', size: 'large' })
        );
    });

    it('should keep a fallback width in a zero-width container', async () => {
        // Arrange
        const google = installGoogle();
        Object.defineProperty(parent, 'clientWidth', { value: 0, configurable: true });

        // Act
        await service.renderButton(parent, 'client-id', jest.fn());

        // Assert
        expect(google.accounts.id.renderButton).toHaveBeenCalledWith(parent, expect.objectContaining({ width: 320 }));
    });

    it('should forward a non-empty credential to the caller', async () => {
        // Arrange
        const google = installGoogle();
        const onCredential = jest.fn();
        await service.renderButton(parent, 'client-id', onCredential);
        const options = google.accounts.id.initialize.mock.calls[0][0] as {
            callback: (response: { credential?: string }) => void;
        };

        // Act
        options.callback({ credential: 'credential' });
        options.callback({ credential: '' });
        options.callback({});

        // Assert
        expect(onCredential).toHaveBeenCalledTimes(1);
        expect(onCredential).toHaveBeenCalledWith('credential');
    });

    it('should load the Google script only once for concurrent callers', async () => {
        // Arrange
        const appended: HTMLScriptElement[] = [];
        jest.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            appended.push(node as HTMLScriptElement);
            return node;
        });

        // Act
        const first = service.renderButton(parent, 'client-id', jest.fn());
        const second = service.renderButton(parent, 'client-id', jest.fn());
        installGoogle();
        appended[0].onload?.(new Event('load'));
        await Promise.all([first, second]);

        // Assert
        expect(appended.length).toBe(1);
    });

    it('should reject when the Google script cannot be loaded', async () => {
        // Arrange
        const appended: HTMLScriptElement[] = [];
        jest.spyOn(document.head, 'appendChild').mockImplementation((node: Node) => {
            appended.push(node as HTMLScriptElement);
            return node;
        });

        // Act
        const result = service.renderButton(parent, 'client-id', jest.fn());
        appended[0].onerror?.(new Event('error'));

        // Assert
        await expect(result).rejects.toThrow('Could not load Google sign-in.');
    });
});
