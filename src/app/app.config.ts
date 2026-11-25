import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, isDevMode, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, RouteReuseStrategy, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideStore, Store } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { authInterceptor } from '@core/interceptors/auth.interceptor';
import { guestApiInterceptor } from '@core/interceptors/guest-api.interceptor';
import { GuestModeService } from '@core/guest/guest-mode.service';
import { CampaignRouteReuseStrategy } from '@core/routing/campaign-route-reuse.strategy';
import { AuthEffects } from '@store/auth/auth.effects';
import * as AuthActions from '@store/auth/auth.actions';
import { authReducer } from '@store/auth/auth.reducer';
import { AUTH_FEATURE_KEY } from '@store/auth/auth.state';
import { CampaignMembersEffects } from '@store/campaign-members/campaign-members.effects';
import { campaignMembersReducer } from '@store/campaign-members/campaign-members.reducer';
import { CAMPAIGN_MEMBERS_FEATURE_KEY } from '@store/campaign-members/campaign-members.state';
import { CodexEffects } from '@store/codex/codex.effects';
import { codexReducer } from '@store/codex/codex.reducer';
import { CODEX_FEATURE_KEY } from '@store/codex/codex.state';
import { CombatEffects } from '@store/combat/combat.effects';
import { combatReducer } from '@store/combat/combat.reducer';
import { COMBAT_FEATURE_KEY } from '@store/combat/combat.state';
import { EditorEffects } from '@store/editor/editor.effects';
import { editorReducer } from '@store/editor/editor.reducer';
import { EDITOR_FEATURE_KEY } from '@store/editor/editor.state';
import { InventoryEffects } from '@store/inventory/inventory.effects';
import { inventoryReducer } from '@store/inventory/inventory.reducer';
import { INVENTORY_FEATURE_KEY } from '@store/inventory/inventory.state';
import { PursesEffects } from '@store/purses/purses.effects';
import { pursesReducer } from '@store/purses/purses.reducer';
import { PURSES_FEATURE_KEY } from '@store/purses/purses.state';
import { APP_ROUTES } from './app.routes';

export const APP_CONFIG: ApplicationConfig = {
    providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(
            APP_ROUTES,
            withComponentInputBinding(),
            withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })
        ),
        { provide: RouteReuseStrategy, useClass: CampaignRouteReuseStrategy },
        provideHttpClient(withFetch(), withInterceptors([guestApiInterceptor, authInterceptor])),
        provideAnimationsAsync(),
        provideStore({
            [AUTH_FEATURE_KEY]: authReducer,
            [CAMPAIGN_MEMBERS_FEATURE_KEY]: campaignMembersReducer,
            [CODEX_FEATURE_KEY]: codexReducer,
            [COMBAT_FEATURE_KEY]: combatReducer,
            [EDITOR_FEATURE_KEY]: editorReducer,
            [INVENTORY_FEATURE_KEY]: inventoryReducer,
            [PURSES_FEATURE_KEY]: pursesReducer
        }),
        provideEffects([
            AuthEffects,
            CampaignMembersEffects,
            CodexEffects,
            CombatEffects,
            EditorEffects,
            InventoryEffects,
            PursesEffects
        ]),
        // Restore a demo tab before the first guard or config request runs, so a refresh never
        // falls back to the real API.
        provideAppInitializer(() => {
            inject(GuestModeService).restore();
        }),
        // The login and invite screens need to know whether Google is enabled before they render.
        provideAppInitializer(() => {
            inject(Store).dispatch(AuthActions.loadConfig.request({}));
        }),
        provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() })
    ]
};
