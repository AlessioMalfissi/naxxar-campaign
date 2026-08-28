import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule, MatCheckboxChange } from '@angular/material/checkbox';
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
import * as PursesActions from '@store/purses/purses.actions';
import { selectGoldByOwner } from '@store/purses/purses.selectors';

const RARITY_FILTER_ALL = 'all';
const STATUS_FILTER_ALL = 'all';
const EMPTY_GOLD_BY_OWNER: Record<string, number> = {};

interface IInventoryGroup {
    id: string;
    label: string;
    items: IInventoryItem[];
    totalCount: number;
}

@Component({
    selector: 'cdx-inventory',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatCheckboxModule,
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
    protected readonly rarityFilterAll = RARITY_FILTER_ALL;
    protected readonly statusFilterAll = STATUS_FILTER_ALL;
    protected readonly items = toSignal(this.store.select(selectInventoryItems), { initialValue: [] });
    protected readonly loading = toSignal(this.store.select(selectInventoryLoading), { initialValue: false });
    protected readonly players = toSignal(this.store.select(selectPlayerEntries), { initialValue: [] });
    protected readonly goldByOwner = toSignal(this.store.select(selectGoldByOwner), {
        initialValue: EMPTY_GOLD_BY_OWNER
    });

    protected readonly form = new FormGroup({
        name: new FormControl<string>('', {
            nonNullable: true,
            validators: [Validators.required, Validators.minLength(1)]
        }),
        description: new FormControl<string>('', { nonNullable: true }),
        quantity: new FormControl<number>(1, { nonNullable: true, validators: [Validators.required, Validators.min(0)] }),
        owner: new FormControl<string>(PARTY_OWNER_ID, { nonNullable: true }),
        rarity: new FormControl<ItemRarity>(ItemRarity.None, { nonNullable: true }),
        status: new FormControl<ItemStatus>(ItemStatus.Mundane, { nonNullable: true }),
        forSale: new FormControl<boolean>(false, { nonNullable: true }),
        imp: new FormControl<boolean>(false, { nonNullable: true })
    });

    protected readonly filterForm = new FormGroup({
        query: new FormControl<string>('', { nonNullable: true }),
        rarity: new FormControl<ItemRarity | typeof RARITY_FILTER_ALL>(RARITY_FILTER_ALL, { nonNullable: true }),
        status: new FormControl<ItemStatus | typeof STATUS_FILTER_ALL>(STATUS_FILTER_ALL, { nonNullable: true })
    });

    private readonly filters = toSignal(this.filterForm.valueChanges, {
        initialValue: this.filterForm.getRawValue()
    });

    protected readonly hasActiveFilters = computed<boolean>(() => {
        const filters = this.filters();
        return (
            (filters.query ?? '').trim() !== '' ||
            filters.rarity !== RARITY_FILTER_ALL ||
            filters.status !== STATUS_FILTER_ALL
        );
    });

    private readonly filteredItems = computed<IInventoryItem[]>(() => {
        const filters = this.filters();
        const query = (filters.query ?? '').trim().toLowerCase();

        return this.items().filter((item) => {
            if (filters.rarity !== RARITY_FILTER_ALL && item.rarity !== filters.rarity) {
                return false;
            }
            if (filters.status !== STATUS_FILTER_ALL && item.status !== filters.status) {
                return false;
            }
            return (
                query === '' ||
                item.name.toLowerCase().includes(query) ||
                item.description.toLowerCase().includes(query)
            );
        });
    });

    protected readonly groups = computed<IInventoryGroup[]>(() => {
        const items = this.items();
        const filteredItems = this.filteredItems();

        const buildGroup = (id: string, label: string): IInventoryGroup => ({
            id,
            label,
            items: filteredItems.filter((item) => item.owner === id),
            totalCount: items.filter((item) => item.owner === id).length
        });

        return [
            buildGroup(PARTY_OWNER_ID, 'Party inventory'),
            ...this.players().map((player) => buildGroup(player.id, player.title))
        ];
    });

    ngOnInit(): void {
        this.store.dispatch(InventoryActions.loadItems.request({}));
        this.store.dispatch(PursesActions.loadPurses.request({}));
    }

    protected clearFilters(): void {
        this.filterForm.reset({ query: '', rarity: RARITY_FILTER_ALL, status: STATUS_FILTER_ALL });
    }

    protected goldFor(ownerId: string): number {
        return this.goldByOwner()[ownerId] ?? 0;
    }

    protected changeGold(ownerId: string, event: Event): void {
        const value = Number((event.target as HTMLInputElement).value);
        const gold = Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
        this.store.dispatch(PursesActions.updateGold.request({ owner: ownerId, gold }));
    }

    protected addItem(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        const { name, description, quantity, owner, rarity, status, forSale, imp } = this.form.getRawValue();
        this.store.dispatch(
            InventoryActions.createItem.request({
                name: name.trim(),
                description: description.trim(),
                quantity,
                owner,
                rarity,
                status,
                forSale,
                imp
            })
        );
        this.form.reset({
            name: '',
            description: '',
            quantity: 1,
            owner: PARTY_OWNER_ID,
            rarity: ItemRarity.None,
            status: ItemStatus.Mundane,
            forSale: false,
            imp: false
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

    protected changeForSale(item: IInventoryItem, event: MatCheckboxChange): void {
        this.store.dispatch(
            InventoryActions.updateItem.request({ id: item.id, changes: { forSale: event.checked } })
        );
    }

    protected changeImp(item: IInventoryItem, event: MatCheckboxChange): void {
        this.store.dispatch(InventoryActions.updateItem.request({ id: item.id, changes: { imp: event.checked } }));
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
