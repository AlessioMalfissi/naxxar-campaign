import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, map, of, switchMap } from 'rxjs';

import { InventoryApiService } from '@core/services/inventory-api.service';
import * as InventoryActions from './inventory.actions';

@Injectable()
export class InventoryEffects {
    private readonly actions$ = inject(Actions);
    private readonly inventoryApi = inject(InventoryApiService);

    readonly loadItems$ = createEffect(() =>
        this.actions$.pipe(
            ofType(InventoryActions.loadItems.request),
            switchMap(() =>
                this.inventoryApi.loadItems().pipe(
                    map((items) => InventoryActions.loadItems.success({ items })),
                    catchError(() =>
                        of(InventoryActions.loadItems.failure({ error: "Couldn't load the inventory. Retry." }))
                    )
                )
            )
        )
    );

    readonly createItem$ = createEffect(() =>
        this.actions$.pipe(
            ofType(InventoryActions.createItem.request),
            switchMap(({ name, description, quantity, owner }) =>
                this.inventoryApi.createItem(name, description, quantity, owner).pipe(
                    map((item) => InventoryActions.createItem.success({ item })),
                    catchError((error: Error) => of(InventoryActions.createItem.failure({ error: error.message })))
                )
            )
        )
    );

    readonly updateItem$ = createEffect(() =>
        this.actions$.pipe(
            ofType(InventoryActions.updateItem.request),
            switchMap(({ id, changes }) =>
                this.inventoryApi.updateItem(id, changes).pipe(
                    map((item) => InventoryActions.updateItem.success({ item })),
                    catchError((error: Error) => of(InventoryActions.updateItem.failure({ error: error.message })))
                )
            )
        )
    );

    readonly deleteItem$ = createEffect(() =>
        this.actions$.pipe(
            ofType(InventoryActions.deleteItem.request),
            switchMap(({ id }) =>
                this.inventoryApi.deleteItem(id).pipe(
                    map((deletedId) => InventoryActions.deleteItem.success({ id: deletedId })),
                    catchError((error: Error) => of(InventoryActions.deleteItem.failure({ error: error.message })))
                )
            )
        )
    );
}
