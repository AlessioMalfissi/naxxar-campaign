import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
    {
        path: 'campaign',
        loadComponent: () =>
            import('@features/shell/campaign-shell.component').then((module) => module.CampaignShellComponent),
        children: [
            { path: '', redirectTo: 'npcs', pathMatch: 'full' },
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
