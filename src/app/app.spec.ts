import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Route } from '@angular/router';

import { AppComponent } from './app.component';
import { APP_CONFIG } from './app.config';
import { APP_ROUTES } from './app.routes';

const findRoute = (routes: Route[], path: string): Route | undefined =>
    routes.find((route) => route.path === path);

describe('AppComponent', () => {
    beforeEach(async () => {
        // Arrange
        await TestBed.configureTestingModule({
            imports: [AppComponent],
            providers: [provideRouter([])]
        }).compileComponents();
    });

    it('should render the routed outlet', () => {
        // Arrange
        const fixture = TestBed.createComponent(AppComponent);

        // Act
        fixture.detectChanges();

        // Assert
        expect(fixture.nativeElement.querySelector('router-outlet') !== null).toBe(true);
    });
});

describe('APP_ROUTES', () => {
    it('should send the bare path to the NPCs section', () => {
        // Arrange
        const root = findRoute(APP_ROUTES, '');

        // Act
        const redirect = root?.redirectTo;

        // Assert
        expect(redirect).toBe('campaign/npcs');
        expect(root?.pathMatch).toBe('full');
    });

    it('should send an unknown path to the NPCs section', () => {
        // Arrange
        const wildcard = findRoute(APP_ROUTES, '**');

        // Act
        const redirect = wildcard?.redirectTo;

        // Assert
        expect(redirect).toBe('campaign/npcs');
    });

    it('should lazily load the shell and both campaign children', async () => {
        // Arrange
        const campaign = findRoute(APP_ROUTES, 'campaign');
        const children = campaign?.children ?? [];

        // Act
        const shell = await campaign?.loadComponent?.();
        const list = await findRoute(children, ':section')?.loadComponent?.();
        const detail = await findRoute(children, ':section/:slug')?.loadComponent?.();

        // Assert
        expect(shell?.name).toBe('CampaignShellComponent');
        expect(list?.name).toBe('SectionListComponent');
        expect(detail?.name).toBe('EntryDetailComponent');
    });
});

describe('APP_CONFIG', () => {
    it('should bootstrap an application that can route', async () => {
        // Arrange
        TestBed.configureTestingModule({ providers: [...APP_CONFIG.providers] });

        // Act
        const router = TestBed.inject(Router);

        // Assert
        expect(router.config.length).toBe(APP_ROUTES.length);
    });
});
