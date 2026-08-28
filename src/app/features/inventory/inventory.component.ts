import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { Store } from '@ngrx/store';
import { filter } from 'rxjs';

import { IInventoryItem, ItemRarity, ItemStatus, PARTY_OWNER_ID } from '@core/models';
import { ModalService } from '@shared/modal/modal.service';
import { selectPlayerEntries } from '@store/codex/codex.selectors';
import * as InventoryActions from '@store/inventory/inventory.actions';
import { selectInventoryItems, selectInventoryLoading } from '@store/inventory/inventory.selectors';

interface IInventoryGroup {
    id: string;
    label: string;
    items: IInventoryItem[];
}

@Component({
    selector: 'cdx-inventory',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule
    ],
    templateUrl: './inventory.component.html',
    styleUrl: './inventory.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class InventoryComponent implements OnInit {
    private readonly store = inject(Store);
    private readonly modalService = inject(ModalService);
    private readonly destroyRef = inject(DestroyRef);

    protected readonly partyOwner = PARTY_OWNER_ID;
    protected readonly rarities = ItemRarity;
    protected readonly statuses = ItemStatus;
    protected readonly items = toSignal(this.store.select(selectInventoryItems), { initialValue: [] });
    protected readonly loading = toSignal(this.store.select(selectInventoryLoading), { initialValue: false });
    protected readonly players = toSignal(this.store.select(selectPlayerEntries), { initialValue: [] });

    protected readonly form = new FormGroup({
        name: new FormControl<string>('', {
            nonNullable: true,
            validators: [Validators.required, Validators.minLength(1)]
        }),
        description: new FormControl<string>('', { nonNullable: true }),
        quantity: new FormControl<number>(1, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
        owner: new FormControl<string>(PARTY_OWNER_ID, { nonNullable: true }),
        rarity: new FormControl<ItemRarity>(ItemRarity.None, { nonNullable: true }),
        status: new FormControl<ItemStatus>(ItemStatus.Mundane, { nonNullable: true })
    });

    protected readonly groups = computed<IInventoryGroup[]>(() => {
        const items = this.items();
        const groups: IInventoryGroup[] = [
            {
                id: PARTY_OWNER_ID,
                label: 'Party inventory',
                items: items.filter((item) => item.owner === PARTY_OWNER_ID)
            }
        ];

        for (const player of this.players()) {
            groups.push({
                id: player.id,
                label: player.title,
                items: items.filter((item) => item.owner === player.id)
            });
        }

        return groups;
    });

    ngOnInit(): void {
        this.store.dispatch(InventoryActions.loadItems.request({}));
    }

    protected addItem(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const { name, description, quantity, owner, rarity, status } = this.form.getRawValue();
        this.store.dispatch(
            InventoryActions.createItem.request({
                name: name.trim(),
                description: description.trim(),
                quantity,
                owner,
                rarity,
                status
            })
        );
        this.form.reset({
            name: '',
            description: '',
            quantity: 1,
            owner: PARTY_OWNER_ID,
            rarity: ItemRarity.None,
            status: ItemStatus.Mundane
        });
    }

    protected changeQuantity(item: IInventoryItem, delta: number): void {
        const quantity = Math.max(0, item.quantity + delta);
        this.store.dispatch(InventoryActions.updateItem.request({ id: item.id, changes: { quantity } }));
    }

    protected changeOwner(item: IInventoryItem, event: MatSelectChange): void {
        const owner = event.value as string;
        if (owner === item.owner) {
            return;
        }

        this.store.dispatch(InventoryActions.updateItem.request({ id: item.id, changes: { owner } }));
    }

    protected changeRarity(item: IInventoryItem, event: MatSelectChange): void {
        const rarity = event.value as ItemRarity;
        if (rarity === item.rarity) {
            return;
        }

        this.store.dispatch(InventoryActions.updateItem.request({ id: item.id, changes: { rarity } }));
    }

    protected changeStatus(item: IInventoryItem, event: MatSelectChange): void {
        const status = event.value as ItemStatus;
        if (status === item.status) {
            return;
        }

        this.store.dispatch(InventoryActions.updateItem.request({ id: item.id, changes: { status } }));
    }

    protected deleteItem(item: IInventoryItem): void {
        this.modalService
            .confirm({
                title: `Delete ${item.name}?`,
                message: 'This cannot be undone.',
                confirmLabel: 'Delete',
                danger: true
            })
            .pipe(
                filter((confirmed) => confirmed),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(() => {
                this.store.dispatch(InventoryActions.deleteItem.request({ id: item.id }));
            });
    }
}
