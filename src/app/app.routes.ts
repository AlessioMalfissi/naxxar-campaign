import { Routes } from '@angular/router';

import { authGuard, campaignMemberGuard, guestGuard } from '@core/guards/auth.guard';

export const APP_ROUTES: Routes = [
    {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () => import('@features/auth/login.component').then((module) => module.LoginComponent)
    },
    {
        path: 'forgot-password',
        canActivate: [guestGuard],
        loadComponent: () =>
            import('@features/auth/forgot-password.component').then((module) => module.ForgotPasswordComponent)
    },
    {
        path: 'reset-password/:token',
        loadComponent: () =>
            import('@features/auth/reset-password.component').then((module) => module.ResetPasswordComponent)
    },
    {
        path: 'invite/:token',
        loadComponent: () =>
            import('@features/invite/invite-accept.component').then((module) => module.InviteAcceptComponent)
    },
    { path: 'register', redirectTo: 'login', pathMatch: 'full' },
    {
        path: 'campaigns',
        canActivate: [authGuard],
        loadComponent: () =>
            import('@features/campaigns/campaign-list.component').then((module) => module.CampaignListComponent)
    },
    {
        path: 'campaigns/:campaignSlug',
        canActivate: [authGuard, campaignMemberGuard],
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
                path: 'combat',
                loadComponent: () =>
                    import('@features/combat/combat.component').then((module) => module.CombatComponent)
            },
            {
                path: 'members',
                loadComponent: () =>
                    import('@features/members/members.component').then((module) => module.MembersComponent)
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
    { path: '', redirectTo: 'campaigns', pathMatch: 'full' },
    { path: '**', redirectTo: 'campaigns' }
];
