import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSelectChange } from '@angular/material/select';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';

import { ItemRarity, ItemStatus, PARTY_OWNER_ID } from '@core/models';
import { ModalService } from '@shared/modal/modal.service';
import { selectPlayerEntries } from '@store/codex/codex.selectors';
import * as InventoryActions from '@store/inventory/inventory.actions';
import { selectInventoryItems, selectInventoryLoading } from '@store/inventory/inventory.selectors';
import * as PursesActions from '@store/purses/purses.actions';
import { selectGoldByOwner } from '@store/purses/purses.selectors';
import { buildSummary } from '@testing/entry.fixtures';
import { buildInventoryItem } from '@testing/inventory.fixtures';
import { InventoryComponent } from './inventory.component';

const PLAYER = buildSummary({
    id: 'players:tessaly-oakhand',
    slug: 'tessaly-oakhand',
    title: 'Tessaly Oakhand'
});

describe('InventoryComponent', () => {
    let fixture: ComponentFixture<InventoryComponent>;
    let component: InventoryComponent;
    let store: MockStore;
    let modalService: { confirm: jest.Mock };

    beforeEach(async () => {
        // Arrange
        modalService = { confirm: jest.fn() };

        await TestBed.configureTestingModule({
            imports: [InventoryComponent, NoopAnimationsModule],
            providers: [provideMockStore({ initialState: {} }), { provide: ModalService, useValue: modalService }]
        }).compileComponents();

        store = TestBed.inject(MockStore);
        store.overrideSelector(selectInventoryItems, [
            buildInventoryItem({ id: 'party-item', owner: PARTY_OWNER_ID }),
            buildInventoryItem({ id: 'player-item', name: 'Rope', owner: PLAYER.id })
        ]);
        store.overrideSelector(selectInventoryLoading, false);
        store.overrideSelector(selectPlayerEntries, [PLAYER]);
        store.overrideSelector(selectGoldByOwner, { [PARTY_OWNER_ID]: 120 });

        fixture = TestBed.createComponent(InventoryComponent);
        component = fixture.componentInstance;
    });

    it('should request the inventory and purses on init', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        fixture.detectChanges();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(InventoryActions.loadItems.request({}));
        expect(dispatchSpy).toHaveBeenCalledWith(PursesActions.loadPurses.request({}));
    });

    it('should group items under party inventory and each player', () => {
        // Act
        fixture.detectChanges();
        const groups = component['groups']();

        // Assert
        expect(groups.length).toBe(2);
        expect(groups[0]).toEqual({
            id: PARTY_OWNER_ID,
            label: 'Party inventory',
            items: [expect.objectContaining({ id: 'party-item' })],
            totalCount: 1
        });
        expect(groups[1]).toEqual({
            id: PLAYER.id,
            label: PLAYER.title,
            items: [expect.objectContaining({ id: 'player-item' })],
            totalCount: 1
        });
    });

    it('should report gold from the store, defaulting to zero for an owner without a purse', () => {
        // Act
        fixture.detectChanges();

        // Assert
        expect(component['goldFor'](PARTY_OWNER_ID)).toBe(120);
        expect(component['goldFor'](PLAYER.id)).toBe(0);
    });

    it('should dispatch a gold update with the entered value', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const input = document.createElement('input');
        input.value = '75';

        // Act
        component['changeGold'](PARTY_OWNER_ID, { target: input } as unknown as Event);

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(PursesActions.updateGold.request({ owner: PARTY_OWNER_ID, gold: 75 }));
    });

    it('should clamp an invalid gold input to zero', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const input = document.createElement('input');
        input.value = 'not a number';

        // Act
        component['changeGold'](PARTY_OWNER_ID, { target: input } as unknown as Event);

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(PursesActions.updateGold.request({ owner: PARTY_OWNER_ID, gold: 0 }));
    });

    it('should filter items by search query, rarity and status', () => {
        // Arrange
        store.overrideSelector(selectInventoryItems, [
            buildInventoryItem({
                id: 'potion',
                name: 'Potion of healing',
                owner: PARTY_OWNER_ID,
                rarity: ItemRarity.Common,
                status: ItemStatus.Magic
            }),
            buildInventoryItem({
                id: 'torch',
                name: 'Torch',
                owner: PARTY_OWNER_ID,
                rarity: ItemRarity.None,
                status: ItemStatus.Mundane
            })
        ]);
        store.refreshState();
        fixture.detectChanges();

        // Act
        component['filterForm'].controls.query.setValue('potion');

        // Assert
        expect(component['groups']()[0].items.map((item) => item.id)).toEqual(['potion']);
        expect(component['hasActiveFilters']()).toBe(true);
    });

    it('should report totalCount unfiltered so the empty state can distinguish no items from no matches', () => {
        // Arrange
        store.overrideSelector(selectInventoryItems, [
            buildInventoryItem({ id: 'torch', name: 'Torch', owner: PARTY_OWNER_ID })
        ]);
        store.refreshState();
        fixture.detectChanges();
        component['filterForm'].controls.query.setValue('nonexistent');

        // Act
        const group = component['groups']()[0];

        // Assert
        expect(group.items.length).toBe(0);
        expect(group.totalCount).toBe(1);
    });

    it('should clear the filters', () => {
        // Arrange
        fixture.detectChanges();
        component['filterForm'].setValue({ query: 'potion', rarity: ItemRarity.Rare, status: ItemStatus.Attuned });

        // Act
        component['clearFilters']();

        // Assert
        expect(component['filterForm'].getRawValue()).toEqual({ query: '', rarity: 'all', status: 'all' });
        expect(component['hasActiveFilters']()).toBe(false);
    });

    it('should not add an item when the form is invalid', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        component['form'].controls.name.setValue('');

        // Act
        component['addItem']();

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
        expect(component['form'].controls.name.touched).toBe(true);
    });

    it('should dispatch a create request and reset the form when valid', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        component['form'].setValue({
            name: ' Torch ',
            description: ' Burns brightly ',
            quantity: 2,
            owner: PLAYER.id,
            rarity: ItemRarity.Rare,
            status: ItemStatus.Attuned
        });

        // Act
        component['addItem']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            InventoryActions.createItem.request({
                name: 'Torch',
                description: 'Burns brightly',
                quantity: 2,
                owner: PLAYER.id,
                rarity: ItemRarity.Rare,
                status: ItemStatus.Attuned
            })
        );
        expect(component['form'].controls.name.value).toBe('');
        expect(component['form'].controls.owner.value).toBe(PARTY_OWNER_ID);
        expect(component['form'].controls.rarity.value).toBe(ItemRarity.None);
        expect(component['form'].controls.status.value).toBe(ItemStatus.Mundane);
    });

    it('should increase and clamp the decreased quantity at zero', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const item = buildInventoryItem({ id: 'item-1', quantity: 0 });

        // Act
        component['changeQuantity'](item, 1);
        component['changeQuantity'](item, -5);

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            InventoryActions.updateItem.request({ id: 'item-1', changes: { quantity: 1 } })
        );
        expect(dispatchSpy).toHaveBeenCalledWith(
            InventoryActions.updateItem.request({ id: 'item-1', changes: { quantity: 0 } })
        );
    });

    it('should dispatch an owner update when the owner actually changes', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const item = buildInventoryItem({ id: 'item-1', owner: PARTY_OWNER_ID });

        // Act
        component['changeOwner'](item, { value: PLAYER.id } as MatSelectChange);

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            InventoryActions.updateItem.request({ id: 'item-1', changes: { owner: PLAYER.id } })
        );
    });

    it('should ignore an owner change to the same owner', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const item = buildInventoryItem({ id: 'item-1', owner: PARTY_OWNER_ID });

        // Act
        component['changeOwner'](item, { value: PARTY_OWNER_ID } as MatSelectChange);

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should dispatch a rarity update when the rarity actually changes', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const item = buildInventoryItem({ id: 'item-1', rarity: ItemRarity.None });

        // Act
        component['changeRarity'](item, { value: ItemRarity.Legendary } as MatSelectChange);

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            InventoryActions.updateItem.request({ id: 'item-1', changes: { rarity: ItemRarity.Legendary } })
        );
    });

    it('should ignore a rarity change to the same rarity', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const item = buildInventoryItem({ id: 'item-1', rarity: ItemRarity.None });

        // Act
        component['changeRarity'](item, { value: ItemRarity.None } as MatSelectChange);

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should dispatch a status update when the status actually changes', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const item = buildInventoryItem({ id: 'item-1', status: ItemStatus.Mundane });

        // Act
        component['changeStatus'](item, { value: ItemStatus.Attuned } as MatSelectChange);

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            InventoryActions.updateItem.request({ id: 'item-1', changes: { status: ItemStatus.Attuned } })
        );
    });

    it('should ignore a status change to the same status', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const item = buildInventoryItem({ id: 'item-1', status: ItemStatus.Mundane });

        // Act
        component['changeStatus'](item, { value: ItemStatus.Mundane } as MatSelectChange);

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should delete an item once the deletion is confirmed', () => {
        // Arrange
        fixture.detectChanges();
        modalService.confirm.mockReturnValue(of(true));
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const item = buildInventoryItem({ id: 'item-1' });

        // Act
        component['deleteItem'](item);

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(InventoryActions.deleteItem.request({ id: 'item-1' }));
    });

    it('should not delete an item when the confirmation is dismissed', () => {
        // Arrange
        fixture.detectChanges();
        modalService.confirm.mockReturnValue(of(false));
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['deleteItem'](buildInventoryItem());

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
    });
});
