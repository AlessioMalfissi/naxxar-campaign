import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { IInventoryItem, ItemRarity, ItemStatus } from '@core/models';
import { buildInventoryItem } from '@testing/inventory.fixtures';
import { InventoryApiService } from './inventory-api.service';

describe('InventoryApiService', () => {
    let service: InventoryApiService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        // Arrange
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()]
        });
        service = TestBed.inject(InventoryApiService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should list items', () => {
        // Arrange
        let items: IInventoryItem[] = [];
        service.loadItems().subscribe((result) => (items = result));

        // Act
        httpMock.expectOne('/api/inventory').flush([buildInventoryItem()]);

        // Assert
        expect(items.length).toBe(1);
        expect(items[0].name).toBe('Potion of healing');
    });

    it('should POST a new item with the supplied fields', () => {
        // Arrange
        let created: IInventoryItem | null = null;

        // Act
        service
            .createItem('Torch', '', 1, 'party', ItemRarity.None, ItemStatus.Mundane, true, false, 'Cromwell')
            .subscribe((result) => (created = result));
        const request = httpMock.expectOne('/api/inventory');
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({
            name: 'Torch',
            description: '',
            quantity: 1,
            owner: 'party',
            rarity: ItemRarity.None,
            status: ItemStatus.Mundane,
            forSale: true,
            imp: false,
            impTag: 'Cromwell'
        });
        request.flush(buildInventoryItem({ name: 'Torch' }));

        // Assert
        expect(created!.name).toBe('Torch');
    });

    it('should surface the server error message when creating fails', () => {
        // Arrange
        let error: Error | null = null;

        // Act
        service
            .createItem('', '', 1, 'party', ItemRarity.None, ItemStatus.Mundane, false, false, '')
            .subscribe({ error: (thrown: Error) => (error = thrown) });
        httpMock
            .expectOne('/api/inventory')
            .flush({ error: 'Name is required.' }, { status: 400, statusText: 'Bad Request' });

        // Assert
        expect(error!.message).toBe('Name is required.');
    });

    it('should fall back to a generic message when creating fails without a server message', () => {
        // Arrange
        let error: Error | null = null;

        // Act
        service
            .createItem('Torch', '', 1, 'party', ItemRarity.None, ItemStatus.Mundane, false, false, '')
            .subscribe({ error: (thrown: Error) => (error = thrown) });
        httpMock.expectOne('/api/inventory').flush(null, { status: 500, statusText: 'Server Error' });

        // Assert
        expect(error!.message).toBe("Couldn't create the item. Retry.");
    });

    it('should PATCH the item with only the changed fields', () => {
        // Arrange
        let updated: IInventoryItem | null = null;

        // Act
        service.updateItem('item-1', { quantity: 5 }).subscribe((result) => (updated = result));
        const request = httpMock.expectOne('/api/inventory/item-1');
        expect(request.request.method).toBe('PATCH');
        expect(request.request.body).toEqual({ quantity: 5 });
        request.flush(buildInventoryItem({ quantity: 5 }));

        // Assert
        expect(updated!.quantity).toBe(5);
    });

    it('should surface the server error message when updating fails', () => {
        // Arrange
        let error: Error | null = null;

        // Act
        service.updateItem('missing', { quantity: 1 }).subscribe({ error: (thrown: Error) => (error = thrown) });
        httpMock
            .expectOne('/api/inventory/missing')
            .flush({ error: 'Item not found.' }, { status: 404, statusText: 'Not Found' });

        // Assert
        expect(error!.message).toBe('Item not found.');
    });

    it('should DELETE the item by id', () => {
        // Arrange
        let deletedId = '';

        // Act
        service.deleteItem('item-1').subscribe((result) => (deletedId = result));
        const request = httpMock.expectOne('/api/inventory/item-1');
        expect(request.request.method).toBe('DELETE');
        request.flush({ id: 'item-1' });

        // Assert
        expect(deletedId).toBe('item-1');
    });

    it('should surface the server error message when deleting fails', () => {
        // Arrange
        let error: Error | null = null;

        // Act
        service.deleteItem('item-1').subscribe({ error: (thrown: Error) => (error = thrown) });
        httpMock.expectOne('/api/inventory/item-1').flush(null, { status: 500, statusText: 'Server Error' });

        // Assert
        expect(error!.message).toBe("Couldn't delete the item. Retry.");
    });
});
