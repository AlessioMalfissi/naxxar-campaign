import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';

import { IInventoryItem, IInventoryItemChanges } from '../models';

const INVENTORY_URL = '/api/inventory';

@Injectable({ providedIn: 'root' })
export class InventoryApiService {
    private readonly http = inject(HttpClient);

    loadItems(): Observable<IInventoryItem[]> {
        return this.http.get<IInventoryItem[]>(INVENTORY_URL);
    }

    createItem(name: string, description: string, quantity: number, owner: string): Observable<IInventoryItem> {
        return this.http
            .post<IInventoryItem>(INVENTORY_URL, { name, description, quantity, owner })
            .pipe(catchError(this.toFriendlyError("Couldn't create the item. Retry.")));
    }

    updateItem(id: string, changes: IInventoryItemChanges): Observable<IInventoryItem> {
        return this.http
            .patch<IInventoryItem>(`${INVENTORY_URL}/${id}`, changes)
            .pipe(catchError(this.toFriendlyError("Couldn't update the item. Retry.")));
    }

    deleteItem(id: string): Observable<string> {
        return this.http.delete<{ id: string }>(`${INVENTORY_URL}/${id}`).pipe(
            map(() => id),
            catchError(this.toFriendlyError("Couldn't delete the item. Retry."))
        );
    }

    private toFriendlyError(defaultMessage: string) {
        return (error: HttpErrorResponse): Observable<never> => {
            const body = error.error as { error?: unknown } | null;
            const message = typeof body?.error === 'string' && body.error.trim() !== '' ? body.error : defaultMessage;
            return throwError(() => new Error(message));
        };
    }
}
