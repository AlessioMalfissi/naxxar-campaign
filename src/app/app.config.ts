import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, isDevMode, provideZoneChangeDetection } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';

import { authInterceptor } from '@core/interceptors/auth.interceptor';
import { AuthEffects } from '@store/auth/auth.effects';
import { authReducer } from '@store/auth/auth.reducer';
import { AUTH_FEATURE_KEY } from '@store/auth/auth.state';
import { CodexEffects } from '@store/codex/codex.effects';
import { codexReducer } from '@store/codex/codex.reducer';
import { CODEX_FEATURE_KEY } from '@store/codex/codex.state';
import { EditorEffects } from '@store/editor/editor.effects';
import { editorReducer } from '@store/editor/editor.reducer';
import { EDITOR_FEATURE_KEY } from '@store/editor/editor.state';
import { APP_ROUTES } from './app.routes';

export const APP_CONFIG: ApplicationConfig = {
    providers: [
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(
            APP_ROUTES,
            withComponentInputBinding(),
            withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })
        ),
        provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
        provideAnimationsAsync(),
        provideStore({
            [AUTH_FEATURE_KEY]: authReducer,
            [CODEX_FEATURE_KEY]: codexReducer,
            [EDITOR_FEATURE_KEY]: editorReducer
        }),
        provideEffects([AuthEffects, CodexEffects, EditorEffects]),
        provideStoreDevtools({ maxAge: 25, logOnly: !isDevMode() })
    ]
};
