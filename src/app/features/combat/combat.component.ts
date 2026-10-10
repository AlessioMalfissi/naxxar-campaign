import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Store } from '@ngrx/store';
import { filter } from 'rxjs';

import {
    COMBAT_CONDITIONS,
    CombatantKind,
    DEFAULT_COMBATANT_COLORS,
    ICodexEntrySummary,
    ICombatant,
    ICombatantChanges,
    ICombatCondition
} from '@core/models';
import { colorOf, createCombatantId, rollD20 } from '@core/utils/combat.util';
import { ModalService } from '@shared/modal/modal.service';
import { selectPlayerEntries, selectPlayerMode } from '@store/codex/codex.selectors';
import * as CombatActions from '@store/combat/combat.actions';
import {
    selectActiveTurnId,
    selectCombatError,
    selectCombatInProgress,
    selectCombatLive,
    selectCombatLoading,
    selectCombatRound,
    selectTurnOrder
} from '@store/combat/combat.selectors';

const MAX_ENEMY_COUNT = 20;
const MAX_NAME_LENGTH = 100;
const EMPTY_ENEMY_FORM = { name: '', count: 1, initiative: null };

@Component({
    selector: 'cdx-combat',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatChipsModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatMenuModule,
        MatTooltipModule
    ],
    templateUrl: './combat.component.html',
    styleUrl: './combat.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CombatComponent implements OnInit {
    private readonly store = inject(Store);
    private readonly modalService = inject(ModalService);
    private readonly destroyRef = inject(DestroyRef);

    protected readonly combatantKind = CombatantKind;
    protected readonly maxEnemyCount = MAX_ENEMY_COUNT;
    protected readonly maxNameLength = MAX_NAME_LENGTH;
    protected readonly turnOrder = toSignal(this.store.select(selectTurnOrder), { initialValue: [] });
    protected readonly round = toSignal(this.store.select(selectCombatRound), { initialValue: 0 });
    protected readonly activeTurnId = toSignal(this.store.select(selectActiveTurnId), { initialValue: null });
    protected readonly inProgress = toSignal(this.store.select(selectCombatInProgress), { initialValue: false });
    protected readonly loading = toSignal(this.store.select(selectCombatLoading), { initialValue: false });
    protected readonly error = toSignal(this.store.select(selectCombatError), { initialValue: null });
    protected readonly live = toSignal(this.store.select(selectCombatLive), { initialValue: false });
    protected readonly players = toSignal(this.store.select(selectPlayerEntries), { initialValue: [] });
    protected readonly playerMode = toSignal(this.store.select(selectPlayerMode), { initialValue: false });

    protected readonly enemyForm = new FormGroup({
        name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        count: new FormControl<number>(1, {
            nonNullable: true,
            validators: [Validators.required, Validators.min(1), Validators.max(MAX_ENEMY_COUNT)]
        }),
        initiative: new FormControl<number | null>(null)
    });

    // Players from the codex who are not in the turn order yet.
    protected readonly availablePlayers = computed<ICodexEntrySummary[]>(() => {
        const present = new Set(this.turnOrder().map((combatant) => combatant.entryId));
        return this.players().filter((player) => !present.has(player.id));
    });

    // Stepping back stops at the first turn of round 1.
    protected readonly canRevert = computed<boolean>(() => {
        const [first] = this.turnOrder();
        return this.round() > 1 || (first !== undefined && first.id !== this.activeTurnId());
    });

    private readonly enemyFormDirective = viewChild(FormGroupDirective);

    // The live socket pushes every saved change, so the tracker stays in sync across devices while open.
    ngOnInit(): void {
        this.store.dispatch(CombatActions.loadEncounter.request({}));
        this.store.dispatch(CombatActions.liveSyncStarted());
        this.destroyRef.onDestroy(() => this.store.dispatch(CombatActions.liveSyncStopped()));
    }

    protected refresh(): void {
        this.store.dispatch(CombatActions.loadEncounter.request({}));
    }

    protected isActive(combatant: ICombatant): boolean {
        return combatant.id === this.activeTurnId();
    }

    protected colorOf(combatant: ICombatant): string {
        return colorOf(combatant);
    }

    protected addPlayers(players: ICodexEntrySummary[]): void {
        if (players.length === 0) {
            return;
        }

        this.store.dispatch(
            CombatActions.combatantsAdded({
                combatants: players.map((player) => ({
                    id: createCombatantId(),
                    name: player.title,
                    kind: CombatantKind.Player,
                    entryId: player.id,
                    initiative: 0,
                    initiativeNudge: 0,
                    color: null,
                    hp: null,
                    maxHp: null,
                    ac: null,
                    conditions: []
                }))
            })
        );
    }

    /*
     * Adds `count` copies of the enemy. Several copies are numbered after any already in the fight
     * ("Goblin 3", "Goblin 4"), and a blank initiative rolls a separate d20 for each copy.
     */
    protected addEnemies(): void {
        const name = this.enemyForm.controls.name.value.trim();
        if (this.enemyForm.invalid || name === '') {
            this.enemyForm.markAllAsTouched();
            return;
        }

        const { count, initiative } = this.enemyForm.getRawValue();
        const firstNumber = this.nextNumberFor(name);
        const combatants: ICombatant[] = Array.from({ length: count }, (_, index) => ({
            id: createCombatantId(),
            name: count > 1 || firstNumber > 1 ? `${name} ${firstNumber + index}` : name,
            kind: CombatantKind.Enemy,
            entryId: null,
            initiative: initiative ?? rollD20(),
            initiativeNudge: 0,
            color: null,
            hp: null,
            maxHp: null,
            ac: null,
            conditions: []
        }));

        this.store.dispatch(CombatActions.combatantsAdded({ combatants }));

        // Resetting through the directive also clears its submitted flag, so the emptied name field
        // isn't flagged as an error straight after a successful add.
        const directive = this.enemyFormDirective();
        if (directive === undefined) {
            this.enemyForm.reset(EMPTY_ENEMY_FORM);
        } else {
            directive.resetForm(EMPTY_ENEMY_FORM);
        }
    }

    private nextNumberFor(name: string): number {
        const base = name.toLowerCase();
        return this.turnOrder().reduce((next, combatant) => {
            const existing = combatant.name.toLowerCase();
            if (existing === base) {
                return Math.max(next, 2);
            }

            const suffix = existing.startsWith(`${base} `) ? Number(existing.slice(base.length + 1)) : NaN;
            return Number.isInteger(suffix) && suffix > 0 ? Math.max(next, suffix + 1) : next;
        }, 1);
    }

    // A blank name is rejected and the field shows the current name again.
    protected changeName(combatant: ICombatant, event: Event): void {
        const input = event.target as HTMLInputElement;
        const name = input.value.trim().slice(0, MAX_NAME_LENGTH);
        if (name === '') {
            input.value = combatant.name;
            return;
        }
        if (name !== combatant.name) {
            this.update(combatant, { name });
        }
    }

    protected changeInitiative(combatant: ICombatant, event: Event): void {
        const initiative = this.readInteger(event);
        if (initiative !== combatant.initiative) {
            this.update(combatant, { initiative });
        }
    }

    protected changeInitiativeNudge(combatant: ICombatant, event: Event): void {
        const initiativeNudge = this.readInteger(event);
        if (initiativeNudge !== combatant.initiativeNudge) {
            this.update(combatant, { initiativeNudge });
        }
    }

    // Picking the default colour for the combatant's kind stores null, so it follows any later default change.
    protected changeColor(combatant: ICombatant, event: Event): void {
        const picked = (event.target as HTMLInputElement).value.toLowerCase();
        const color = picked === DEFAULT_COMBATANT_COLORS[combatant.kind] ? null : picked;
        if (color !== combatant.color) {
            this.update(combatant, { color });
        }
    }

    protected addCondition(combatant: ICombatant): void {
        this.modalService
            .addCondition({ title: `Add condition to ${combatant.name}`, suggestions: COMBAT_CONDITIONS })
            .pipe(
                filter((condition): condition is ICombatCondition => condition !== null),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((condition) => {
                this.store.dispatch(CombatActions.conditionAdded({ id: combatant.id, condition }));
            });
    }

    protected editCondition(combatant: ICombatant, condition: ICombatCondition): void {
        this.modalService
            .editCondition({
                title: `Edit ${condition.name} on ${combatant.name}`,
                suggestions: COMBAT_CONDITIONS,
                condition
            })
            .pipe(
                filter((edited): edited is ICombatCondition => edited !== null),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe((edited) => {
                this.store.dispatch(
                    CombatActions.conditionUpdated({ id: combatant.id, name: condition.name, condition: edited })
                );
            });
    }

    protected removeCondition(combatant: ICombatant, condition: ICombatCondition): void {
        this.store.dispatch(CombatActions.conditionRemoved({ id: combatant.id, name: condition.name }));
    }

    protected removeCombatant(combatant: ICombatant): void {
        this.store.dispatch(CombatActions.combatantRemoved({ id: combatant.id }));
    }

    protected startCombat(): void {
        this.store.dispatch(CombatActions.combatStarted());
    }

    protected nextTurn(): void {
        this.store.dispatch(CombatActions.turnAdvanced());
    }

    protected previousTurn(): void {
        this.store.dispatch(CombatActions.turnReverted());
    }

    protected endCombat(): void {
        this.modalService
            .confirm({
                title: 'End combat?',
                message: 'Enemies are removed from the tracker and the round counter resets. The party stays.',
                confirmLabel: 'End combat',
                danger: true
            })
            .pipe(
                filter((confirmed) => confirmed),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(() => {
                this.store.dispatch(CombatActions.combatEnded());
            });
    }

    private update(combatant: ICombatant, changes: ICombatantChanges): void {
        this.store.dispatch(CombatActions.combatantUpdated({ id: combatant.id, changes }));
    }

    private readInteger(event: Event): number {
        const value = Number((event.target as HTMLInputElement).value);
        return Number.isFinite(value) ? Math.trunc(value) : 0;
    }
}
