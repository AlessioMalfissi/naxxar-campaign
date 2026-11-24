import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import { ICampaignSummary } from '@core/models';
import { INITIAL_AUTH_STATE } from '@store/auth/auth.state';
import { selectCampaigns } from '@store/auth/auth.selectors';
import { CampaignContextService } from './campaign-context.service';

const NAXXAR: ICampaignSummary = { id: 'campaign-1', slug: 'naxxar', name: 'Naxxar', role: 'dm' };
const OTHER: ICampaignSummary = { id: 'campaign-2', slug: 'other', name: 'Other', role: 'player' };

describe('CampaignContextService', () => {
    let service: CampaignContextService;
    let store: MockStore;

    beforeEach(() => {
        // Arrange
        TestBed.configureTestingModule({
            providers: [
                provideMockStore({
                    initialState: { auth: { ...INITIAL_AUTH_STATE, campaigns: [NAXXAR, OTHER] } }
                })
            ]
        });
        store = TestBed.inject(MockStore);
        store.overrideSelector(selectCampaigns, [NAXXAR, OTHER]);
        service = TestBed.inject(CampaignContextService);
    });

    it('should start without an active campaign', () => {
        // Assert
        expect(service.slug()).toBeNull();
        expect(service.campaign()).toBeNull();
        expect(service.role()).toBeNull();
    });

    it('should build the campaign API base URL from the slug', () => {
        // Act
        service.setSlug('naxxar');

        // Assert
        expect(service.baseUrl()).toBe('/api/campaigns/naxxar');
    });

    it('should encode the slug in the URL', () => {
        // Act
        service.setSlug('a/b');

        // Assert
        expect(service.baseUrl()).toBe('/api/campaigns/a%2Fb');
    });

    it('should expose the campaign and role for the active slug', () => {
        // Act
        service.setSlug('other');

        // Assert
        expect(service.campaign()).toEqual(OTHER);
        expect(service.role()).toBe('player');
    });

    it('should follow a change in the campaign list', () => {
        // Arrange
        service.setSlug('naxxar');
        const renamed: ICampaignSummary = { ...NAXXAR, name: 'Naxxar Reborn' };

        // Act
        store.overrideSelector(selectCampaigns, [renamed, OTHER]);
        store.refreshState();

        // Assert
        expect(service.campaign()?.name).toBe('Naxxar Reborn');
    });

    it('should clear the active campaign', () => {
        // Arrange
        service.setSlug('naxxar');

        // Act
        service.clear();

        // Assert
        expect(service.slug()).toBeNull();
    });

    it('should refuse to build a URL without an active campaign', () => {
        // Act / Assert
        expect(() => service.baseUrl()).toThrow('No active campaign.');
    });
});
