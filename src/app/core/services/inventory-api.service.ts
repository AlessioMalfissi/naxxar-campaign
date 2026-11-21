import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';

import { toApiError } from '../errors/api-error';
import { IInventoryItem, IInventoryItemChanges, ItemRarity, ItemStatus } from '../models';
import { CampaignContextService } from './campaign-context.service';

@Injectable({ providedIn: 'root' })
export class InventoryApiService {
    private readonly http = inject(HttpClient);
    private readonly campaignContext = inject(CampaignContextService);

    loadItems(): Observable<IInventoryItem[]> {
        return this.http.get<IInventoryItem[]>(this.inventoryUrl());
    }

    createItem(
        name: string,
        description: string,
        quantity: number,
        owner: string,
        rarity: ItemRarity,
        status: ItemStatus,
        forSale: boolean,
        imp: boolean,
        impTag: string
    ): Observable<IInventoryItem> {
        return this.http
            .post<IInventoryItem>(this.inventoryUrl(), {
                name,
                description,
                quantity,
                owner,
                rarity,
                status,
                forSale,
                imp,
                impTag
            })
            .pipe(catchError(this.toFriendlyError("Couldn't create the item. Retry.")));
    }

    updateItem(id: string, changes: IInventoryItemChanges): Observable<IInventoryItem> {
        return this.http
            .patch<IInventoryItem>(`${this.inventoryUrl()}/${id}`, changes)
            .pipe(catchError(this.toFriendlyError("Couldn't update the item. Retry.")));
    }

    deleteItem(id: string): Observable<string> {
        return this.http.delete<{ id: string }>(`${this.inventoryUrl()}/${id}`).pipe(
            map(() => id),
            catchError(this.toFriendlyError("Couldn't delete the item. Retry."))
        );
    }

    private inventoryUrl(): string {
        return `${this.campaignContext.baseUrl()}/inventory`;
    }

    private toFriendlyError(defaultMessage: string) {
        return (error: unknown): Observable<never> => throwError(() => toApiError(error, defaultMessage));
    }
}
