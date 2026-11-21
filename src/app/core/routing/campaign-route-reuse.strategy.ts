import { ActivatedRouteSnapshot, BaseRouteReuseStrategy, RouteReuseStrategy } from '@angular/router';

/*
 * Reuses a route only when it is the same route config and the same campaign slug. Without this,
 * Angular would keep the campaign shell alive when switching campaigns, so its ngOnInit loads and
 * the combat WebSocket would stay pointed at the previous campaign.
 */
export class CampaignRouteReuseStrategy extends BaseRouteReuseStrategy implements RouteReuseStrategy {
    override shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
        if (!super.shouldReuseRoute(future, curr)) {
            return false;
        }

        const futureSlug = future.params['campaignSlug'];
        const currSlug = curr.params['campaignSlug'];
        return futureSlug === undefined || currSlug === undefined || futureSlug === currSlug;
    }
}
