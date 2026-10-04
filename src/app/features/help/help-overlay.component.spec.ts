import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { NavigationStart, Router, RouterEvent } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Subject } from 'rxjs';

import * as CodexActions from '@store/codex/codex.actions';
import { HelpOverlayComponent } from './help-overlay.component';

interface IAnchorRect {
    top: number;
    left: number;
    width: number;
    height: number;
}

describe('HelpOverlayComponent', () => {
    let fixture: ComponentFixture<HelpOverlayComponent>;
    let component: HelpOverlayComponent;
    let store: MockStore;
    let routerEvents: Subject<RouterEvent>;
    let router: { url: string; events: Subject<RouterEvent> };
    let anchors: HTMLElement[];

    const addAnchor = (id: string, rect: IAnchorRect): HTMLElement => {
        const element = document.createElement('div');
        element.setAttribute('data-help', id);
        const bounds = {
            ...rect,
            x: rect.left,
            y: rect.top,
            right: rect.left + rect.width,
            bottom: rect.top + rect.height
        };
        element.getBoundingClientRect = (): DOMRect => ({ ...bounds, toJSON: () => bounds });
        document.body.appendChild(element);
        anchors.push(element);
        return element;
    };

    const createComponent = (url: string): void => {
        router.url = url;
        fixture = TestBed.createComponent(HelpOverlayComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        component['measure']();
        fixture.detectChanges();
    };

    const query = (selector: string): HTMLElement | null => fixture.nativeElement.querySelector(selector);

    const queryAll = (selector: string): HTMLElement[] => Array.from(fixture.nativeElement.querySelectorAll(selector));

    const buttonWithText = (text: string): HTMLButtonElement | undefined =>
        Array.from<HTMLButtonElement>(fixture.nativeElement.querySelectorAll('button')).find(
            (button) => button.textContent?.trim() === text
        );

    beforeEach(async () => {
        // Arrange
        anchors = [];
        routerEvents = new Subject<RouterEvent>();
        router = { url: '/campaign/npcs', events: routerEvents };

        await TestBed.configureTestingModule({
            imports: [HelpOverlayComponent, NoopAnimationsModule],
            providers: [provideMockStore({ initialState: {} }), { provide: Router, useValue: router }]
        }).compileComponents();

        store = TestBed.inject(MockStore);
    });

    afterEach(() => {
        anchors.forEach((anchor) => anchor.remove());
    });

    it('should place a numbered dot on each rendered anchor, page topics first', () => {
        // Arrange
        addAnchor('search', { top: 10, left: 600, width: 240, height: 40 });
        addAnchor('combat-controls', { top: 120, left: 300, width: 400, height: 40 });

        // Act
        createComponent('/campaign/combat');

        // Assert
        const dots = queryAll('.cdx-help-dot');
        expect(dots.length).toBe(2);
        expect(dots[0].getAttribute('aria-label')).toBe('Step 1: Run the encounter');
        expect(dots[1].getAttribute('aria-label')).toBe('Step 2: Search the codex');
        expect(dots[0].style.top).toBe('124px');
        expect(dots[0].style.left).toBe('696px');
    });

    it('should skip anchors that are missing or have no size', () => {
        // Arrange
        addAnchor('combat-refresh', { top: 0, left: 0, width: 0, height: 0 });
        addAnchor('combat-controls', { top: 120, left: 300, width: 400, height: 40 });

        // Act
        createComponent('/campaign/combat');

        // Assert
        const dots = queryAll('.cdx-help-dot');
        expect(dots.length).toBe(1);
        expect(dots[0].textContent?.trim()).toBe('1');
    });

    it('should keep dots inside the viewport', () => {
        // Arrange
        addAnchor('account-menu', { top: -40, left: 1000, width: 40, height: 40 });

        // Act
        createComponent('/campaign/npcs');

        // Assert
        const dot = queryAll('.cdx-help-dot')[0];
        expect(dot.style.top).toBe('14px');
        expect(dot.style.left).toBe(`${window.innerWidth - 14}px`);
    });

    it('should colour each dot by its category', () => {
        // Arrange
        addAnchor('section-status-filter', { top: 100, left: 100, width: 200, height: 32 });

        // Act
        createComponent('/campaign/npcs');

        // Assert
        const dot = queryAll('.cdx-help-dot')[0];
        expect(dot.style.getPropertyValue('--cdx-help-color')).toBe('var(--cdx-warning)');
    });

    it('should title the banner after the current page', () => {
        // Arrange
        addAnchor('inventory-filters', { top: 100, left: 100, width: 600, height: 40 });

        // Act
        createComponent('/campaign/inventory');

        // Assert
        expect(query('.cdx-help-banner-title')?.textContent?.trim()).toBe('Inventory guide');
    });

    it('should fall back to the shell topics outside a known page', () => {
        // Arrange
        addAnchor('search', { top: 10, left: 600, width: 240, height: 40 });

        // Act
        createComponent('/campaign');

        // Assert
        expect(query('.cdx-help-banner-title')?.textContent?.trim()).toBe('Campaign guide');
        expect(queryAll('.cdx-help-dot').length).toBe(1);
    });

    it('should say so when the page has nothing to point out', () => {
        // Arrange
        const url = '/campaign/combat';

        // Act
        createComponent(url);

        // Assert
        expect(queryAll('.cdx-help-dot').length).toBe(0);
        expect(query('.cdx-help-banner-hint')?.textContent?.trim()).toBe('Nothing to point out on this page.');
        expect(buttonWithText('Start tour') === undefined).toBe(true);
    });

    it('should open the tutorial card and highlight the target when a dot is clicked', () => {
        // Arrange
        addAnchor('combat-controls', { top: 120, left: 300, width: 400, height: 40 });
        addAnchor('search', { top: 10, left: 600, width: 240, height: 40 });
        createComponent('/campaign/combat');

        // Act
        queryAll('.cdx-help-dot')[1].click();
        fixture.detectChanges();

        // Assert
        expect(query('.cdx-help-card-title')?.textContent?.trim()).toBe('Search the codex');
        expect(query('.cdx-help-card-step')?.textContent?.trim()).toBe('2 of 2');
        expect(query('.cdx-help-card-category')?.textContent?.trim()).toBe('Navigation');
        expect(queryAll('.cdx-help-dot')[1].classList.contains('cdx-help-dot-active')).toBe(true);
        expect(query('.cdx-help-highlight')?.style.width).toBe('240px');
    });

    it('should place the card below the dot when there is room', () => {
        // Arrange
        addAnchor('combat-controls', { top: 120, left: 300, width: 400, height: 40 });
        createComponent('/campaign/combat');

        // Act
        queryAll('.cdx-help-dot')[0].click();
        fixture.detectChanges();

        // Assert
        const card = query('.cdx-help-card');
        expect(card?.style.top).toBe('142px');
        expect(card?.style.bottom).toBe('');
        expect(card?.style.left).toBe('546px');
    });

    it('should place the card above the dot near the bottom of the viewport', () => {
        // Arrange
        const top = window.innerHeight - 60;
        addAnchor('combat-controls', { top, left: 0, width: 40, height: 40 });
        createComponent('/campaign/combat');

        // Act
        queryAll('.cdx-help-dot')[0].click();
        fixture.detectChanges();

        // Assert
        const card = query('.cdx-help-card');
        expect(card?.style.top).toBe('');
        expect(card?.style.bottom).toBe(`${window.innerHeight - (top + 4) + 18}px`);
        expect(card?.style.left).toBe('16px');
    });

    it('should step through the tour with start, next and back', () => {
        // Arrange
        addAnchor('combat-controls', { top: 120, left: 300, width: 400, height: 40 });
        addAnchor('search', { top: 10, left: 600, width: 240, height: 40 });
        createComponent('/campaign/combat');

        // Act
        buttonWithText('Start tour')?.click();
        fixture.detectChanges();
        const first = query('.cdx-help-card-title')?.textContent?.trim();
        buttonWithText('Next')?.click();
        fixture.detectChanges();
        const second = query('.cdx-help-card-title')?.textContent?.trim();
        const hasDone = buttonWithText('Done') !== undefined;
        buttonWithText('Back')?.click();
        fixture.detectChanges();
        const back = query('.cdx-help-card-title')?.textContent?.trim();

        // Assert
        expect(first).toBe('Run the encounter');
        expect(second).toBe('Search the codex');
        expect(hasDone).toBe(true);
        expect(back).toBe('Run the encounter');
        expect(buttonWithText('Back')?.disabled).toBe(true);
        expect(buttonWithText('Start tour') === undefined).toBe(true);
    });

    it('should step with the arrow keys', () => {
        // Arrange
        addAnchor('combat-controls', { top: 120, left: 300, width: 400, height: 40 });
        addAnchor('search', { top: 10, left: 600, width: 240, height: 40 });
        createComponent('/campaign/combat');

        // Act
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        fixture.detectChanges();

        // Assert
        expect(query('.cdx-help-card-title')?.textContent?.trim()).toBe('Run the encounter');
    });

    it('should ignore back before the tour has started', () => {
        // Arrange
        addAnchor('combat-controls', { top: 120, left: 300, width: 400, height: 40 });
        createComponent('/campaign/combat');

        // Act
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
        fixture.detectChanges();

        // Assert
        expect(query('.cdx-help-card') === null).toBe(true);
    });

    it('should close from the Done button', () => {
        // Arrange
        addAnchor('combat-controls', { top: 120, left: 300, width: 400, height: 40 });
        createComponent('/campaign/combat');
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        queryAll('.cdx-help-dot')[0].click();
        fixture.detectChanges();

        // Act
        buttonWithText('Done')?.click();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CodexActions.helpClosed());
    });

    it('should scroll an off-screen target into view', () => {
        // Arrange
        const anchor = addAnchor('combat-controls', { top: window.innerHeight + 200, left: 300, width: 400, height: 40 });
        const scrollSpy = jest.fn();
        anchor.scrollIntoView = scrollSpy;
        createComponent('/campaign/combat');

        // Act
        buttonWithText('Start tour')?.click();

        // Assert
        expect(scrollSpy).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
    });

    it('should not scroll a target that is already visible', () => {
        // Arrange
        const anchor = addAnchor('combat-controls', { top: 120, left: 300, width: 400, height: 40 });
        const scrollSpy = jest.fn();
        anchor.scrollIntoView = scrollSpy;
        createComponent('/campaign/combat');

        // Act
        buttonWithText('Start tour')?.click();

        // Assert
        expect(scrollSpy).not.toHaveBeenCalled();
    });

    it('should move the dots when the page scrolls', () => {
        // Arrange
        const anchor = addAnchor('combat-controls', { top: 120, left: 300, width: 400, height: 40 });
        createComponent('/campaign/combat');
        const bounds = { top: 60, left: 300, width: 400, height: 40, x: 300, y: 60, right: 700, bottom: 100 };
        anchor.getBoundingClientRect = (): DOMRect => ({ ...bounds, toJSON: () => bounds });

        // Act
        document.body.dispatchEvent(new Event('scroll'));
        fixture.detectChanges();

        // Assert
        expect(queryAll('.cdx-help-dot')[0].style.top).toBe('64px');
    });

    it('should drop the open card when its target disappears', () => {
        // Arrange
        const anchor = addAnchor('combat-controls', { top: 120, left: 300, width: 400, height: 40 });
        createComponent('/campaign/combat');
        queryAll('.cdx-help-dot')[0].click();
        fixture.detectChanges();
        anchor.remove();

        // Act
        window.dispatchEvent(new Event('resize'));
        fixture.detectChanges();

        // Assert
        expect(query('.cdx-help-card') === null).toBe(true);
    });

    it('should close from the close button', () => {
        // Arrange
        createComponent('/campaign/npcs');
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const button = query('[aria-label="Close help"]');

        // Act
        button?.click();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CodexActions.helpClosed());
    });

    it('should close when the backdrop is clicked', () => {
        // Arrange
        createComponent('/campaign/npcs');
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        query('.cdx-help-backdrop')?.click();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CodexActions.helpClosed());
    });

    it('should close on Escape', () => {
        // Arrange
        createComponent('/campaign/npcs');
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CodexActions.helpClosed());
    });

    it('should close when navigating away', () => {
        // Arrange
        createComponent('/campaign/npcs');
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        routerEvents.next(new NavigationStart(1, '/campaign/places'));

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CodexActions.helpClosed());
    });
});
