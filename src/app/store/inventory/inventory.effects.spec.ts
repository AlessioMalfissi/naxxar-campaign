import { TestBed } from '@angular/core/testing';
import { provideMockActions } from '@ngrx/effects/testing';
import { Action } from '@ngrx/store';
import { Observable, of, ReplaySubject, throwError } from 'rxjs';

import { ItemRarity, ItemStatus } from '@core/models';
import { InventoryApiService } from '@core/services/inventory-api.service';
import { buildInventoryItem } from '@testing/inventory.fixtures';
import * as InventoryActions from './inventory.actions';
import { InventoryEffects } from './inventory.effects';

describe('InventoryEffects', () => {
    let actions$: ReplaySubject<Action>;
    let effects: InventoryEffects;
    let inventoryApi: jest.Mocked<Pick<InventoryApiService, 'loadItems' | 'createItem' | 'updateItem' | 'deleteItem'>>;

    const dispatched = <T>(source: Observable<T>): Promise<T> =>
        new Promise<T>((resolve) => source.subscribe((action) => resolve(action)));

    beforeEach(() => {
        // Arrange
        actions$ = new ReplaySubject<Action>(1);
        inventoryApi = {
            loadItems: jest.fn(),
            createItem: jest.fn(),
            updateItem: jest.fn(),
            deleteItem: jest.fn()
        };

        TestBed.configureTestingModule({
            providers: [
                InventoryEffects,
                provideMockActions(() => actions$),
                { provide: InventoryApiService, useValue: inventoryApi }
            ]
        });

        effects = TestBed.inject(InventoryEffects);
    });

    it('should map loaded items onto a success action', async () => {
        // Arrange
        const items = [buildInventoryItem()];
        inventoryApi.loadItems.mockReturnValue(of(items));
        actions$.next(InventoryActions.loadItems.request({}));

        // Act
        const result = await dispatched(effects.loadItems$);

        // Assert
        expect(result).toEqual(InventoryActions.loadItems.success({ items }));
    });

    it('should map a load error onto a failure action', async () => {
        // Arrange
        inventoryApi.loadItems.mockReturnValue(throwError(() => new Error('offline')));
        actions$.next(InventoryActions.loadItems.request({}));

        // Act
        const result = await dispatched(effects.loadItems$);

        // Assert
        expect(result).toEqual(InventoryActions.loadItems.failure({ error: "Couldn't load the inventory. Retry." }));
    });

    it('should request an item to be created with the full payload', async () => {
        // Arrange
        const item = buildInventoryItem();
        inventoryApi.createItem.mockReturnValue(of(item));
        actions$.next(
            InventoryActions.createItem.request({
                name: 'Torch',
                description: '',
                quantity: 1,
                owner: 'party',
                rarity: ItemRarity.None,
                status: ItemStatus.Mundane
            })
        );

        // Act
        const result = await dispatched(effects.createItem$);

        // Assert
        expect(inventoryApi.createItem).toHaveBeenCalledWith(
            'Torch',
            '',
            1,
            'party',
            ItemRarity.None,
            ItemStatus.Mundane
        );
        expect(result).toEqual(InventoryActions.createItem.success({ item }));
    });

    it('should surface the create error message', async () => {
        // Arrange
        inventoryApi.createItem.mockReturnValue(throwError(() => new Error('bad name')));
        actions$.next(
            InventoryActions.createItem.request({
                name: '',
                description: '',
                quantity: 1,
                owner: 'party',
                rarity: ItemRarity.None,
                status: ItemStatus.Mundane
            })
        );

        // Act
        const result = await dispatched(effects.createItem$);

        // Assert
        expect(result).toEqual(InventoryActions.createItem.failure({ error: 'bad name' }));
    });

    it('should request an item update with the id and changes', async () => {
        // Arrange
        const item = buildInventoryItem({ quantity: 5 });
        inventoryApi.updateItem.mockReturnValue(of(item));
        actions$.next(InventoryActions.updateItem.request({ id: item.id, changes: { quantity: 5 } }));

        // Act
        const result = await dispatched(effects.updateItem$);

        // Assert
        expect(inventoryApi.updateItem).toHaveBeenCalledWith(item.id, { quantity: 5 });
        expect(result).toEqual(InventoryActions.updateItem.success({ item }));
    });

    it('should surface the update error message', async () => {
        // Arrange
        inventoryApi.updateItem.mockReturnValue(throwError(() => new Error('gone')));
        actions$.next(InventoryActions.updateItem.request({ id: 'item-1', changes: { quantity: 1 } }));

        // Act
        const result = await dispatched(effects.updateItem$);

        // Assert
        expect(result).toEqual(InventoryActions.updateItem.failure({ error: 'gone' }));
    });

    it('should confirm a deletion', async () => {
        // Arrange
        inventoryApi.deleteItem.mockReturnValue(of('item-1'));
        actions$.next(InventoryActions.deleteItem.request({ id: 'item-1' }));

        // Act
        const result = await dispatched(effects.deleteItem$);

        // Assert
        expect(result).toEqual(InventoryActions.deleteItem.success({ id: 'item-1' }));
    });

    it('should surface the delete error message', async () => {
        // Arrange
        inventoryApi.deleteItem.mockReturnValue(throwError(() => new Error('locked')));
        actions$.next(InventoryActions.deleteItem.request({ id: 'item-1' }));

        // Act
        const result = await dispatched(effects.deleteItem$);

        // Assert
        expect(result).toEqual(InventoryActions.deleteItem.failure({ error: 'locked' }));
    });
});
