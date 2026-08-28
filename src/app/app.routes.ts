import { Routes } from '@angular/router';

import { authGuard, guestGuard } from '@core/guards/auth.guard';

export const APP_ROUTES: Routes = [
    {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () => import('@features/auth/login.component').then((module) => module.LoginComponent)
    },
    {
        path: 'campaign',
        canActivate: [authGuard],
        loadComponent: () =>
            import('@features/shell/campaign-shell.component').then((module) => module.CampaignShellComponent),
        children: [
            { path: '', redirectTo: 'npcs', pathMatch: 'full' },
            {
                path: 'inventory',
                loadComponent: () =>
                    import('@features/inventory/inventory.component').then((module) => module.InventoryComponent)
            },
            {
                path: ':section',
                loadComponent: () =>
                    import('@features/section-list/section-list.component').then(
                        (module) => module.SectionListComponent
                    )
            },
            {
                path: ':section/:slug',
                loadComponent: () =>
                    import('@features/entry-detail/entry-detail.component').then(
                        (module) => module.EntryDetailComponent
                    )
            }
        ]
    },
    { path: '', redirectTo: 'campaign/npcs', pathMatch: 'full' },
    { path: '**', redirectTo: 'campaign/npcs' }
];
