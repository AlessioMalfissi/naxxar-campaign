import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import { buildSummary } from '@testing/entry.fixtures';
import * as AuthActions from '@store/auth/auth.actions';
import * as CodexActions from '@store/codex/codex.actions';
import { selectPlayerMode, selectVisibleEntries } from '@store/codex/codex.selectors';
import { CodexHeaderComponent } from './codex-header.component';

describe('CodexHeaderComponent', () => {
    let fixture: ComponentFixture<CodexHeaderComponent>;
    let component: CodexHeaderComponent;
    let store: MockStore;
    let router: { navigate: jest.Mock };

    const typeQuery = (value: string): void => {
        component['searchControl'].setValue(value);
        jest.advanceTimersByTime(250);
        fixture.detectChanges();
    };

    beforeEach(async () => {
        // Arrange
        jest.useFakeTimers();
        router = { navigate: jest.fn().mockResolvedValue(true) };

        await TestBed.configureTestingModule({
            imports: [CodexHeaderComponent, NoopAnimationsModule],
            providers: [provideMockStore({ initialState: {} }), { provide: Router, useValue: router }]
        }).compileComponents();

        store = TestBed.inject(MockStore);
        store.overrideSelector(selectPlayerMode, false);
        store.overrideSelector(selectVisibleEntries, [
            buildSummary(),
            buildSummary({
                id: 'places:ashfall-city',
                slug: 'ashfall-city',
                title: 'Ashfall city',
                tags: ['capital'],
                excerpt: 'Ash on every roof.'
            })
        ]);

        fixture = TestBed.createComponent(CodexHeaderComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should keep the results empty below the minimum query length', () => {
        // Arrange
        const query = 'v';

        // Act
        typeQuery(query);

        // Assert
        expect(component['results']().length).toBe(0);
    });

    it('should match on title, excerpt and tags', () => {
        // Arrange
        const query = 'ashfall';

        // Act
        typeQuery(query);

        // Assert
        expect(component['results']().length).toBe(1);
        expect(component['results']()[0].id).toBe('places:ashfall-city');
    });

    it('should match on a tag', () => {
        // Arrange
        const query = 'capital';

        // Act
        typeQuery(query);

        // Assert
        expect(component['results']()[0].id).toBe('places:ashfall-city');
    });

    it('should clear the field and navigate when a result is opened', () => {
        // Arrange
        const entry = buildSummary();

        // Act
        component['openResult'](entry);

        // Assert
        expect(component['searchControl'].value).toBe('');
        expect(router.navigate).toHaveBeenCalledWith(['/campaign', 'npcs', 'vaelith-corrun']);
    });

    it('should dispatch the sidebar toggle', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['toggleSidebar']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CodexActions.sidebarToggled());
    });

    it('should dispatch the player mode toggle', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['togglePlayerMode']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CodexActions.playerModeToggled());
    });

    it('should dispatch a logout request on sign out', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['signOut']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(AuthActions.logout.request({}));
    });

    it('should keep the autocomplete field blank when a result is picked', () => {
        // Arrange
        const display = component['displayEmpty']();

        // Act
        const isBlank = display === '';

        // Assert
        expect(isBlank).toBe(true);
    });
});
