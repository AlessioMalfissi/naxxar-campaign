import { ActivatedRouteSnapshot, Route } from '@angular/router';

import { CampaignRouteReuseStrategy } from './campaign-route-reuse.strategy';

describe('CampaignRouteReuseStrategy', () => {
    const strategy = new CampaignRouteReuseStrategy();
    const config: Route = { path: 'campaigns/:campaignSlug' };

    const snapshot = (params: Record<string, string>, routeConfig?: Route): ActivatedRouteSnapshot =>
        ({ params, routeConfig }) as unknown as ActivatedRouteSnapshot;

    it('should reuse the same campaign route on the same slug', () => {
        // Act
        const reused = strategy.shouldReuseRoute(
            snapshot({ campaignSlug: 'naxxar' }, config),
            snapshot({ campaignSlug: 'naxxar' }, config)
        );

        // Assert
        expect(reused).toBe(true);
    });

    it('should recreate the shell when the campaign slug changes', () => {
        // Act
        const reused = strategy.shouldReuseRoute(
            snapshot({ campaignSlug: 'naxxar' }, config),
            snapshot({ campaignSlug: 'other' }, config)
        );

        // Assert
        expect(reused).toBe(false);
    });

    it('should reuse child routes that do not carry a campaign slug', () => {
        // Act
        const reused = strategy.shouldReuseRoute(snapshot({}), snapshot({}));

        // Assert
        expect(reused).toBe(true);
    });

    it('should not reuse a different route config', () => {
        // Act
        const reused = strategy.shouldReuseRoute(
            snapshot({ campaignSlug: 'naxxar' }, { path: 'members' }),
            snapshot({ campaignSlug: 'naxxar' }, config)
        );

        // Assert
        expect(reused).toBe(false);
    });
});
