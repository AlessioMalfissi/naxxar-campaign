import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTooltip } from '@angular/material/tooltip';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';

import { COMBAT_CONDITIONS, CombatantKind, DEFAULT_COMBATANT_COLORS, ICombatant } from '@core/models';
import { ModalService } from '@shared/modal/modal.service';
import { selectPlayerEntries, selectPlayerMode } from '@store/codex/codex.selectors';
import * as CombatActions from '@store/combat/combat.actions';
import {
    selectActiveTurnId,
    selectCombatError,
    selectCombatInProgress,
    selectCombatLoading,
    selectCombatRound,
    selectTurnOrder
} from '@store/combat/combat.selectors';
import { buildCombatant, buildPlayerCombatant } from '@testing/combat.fixtures';
import { buildSummary } from '@testing/entry.fixtures';
import { CombatComponent } from './combat.component';

const TESSALY = buildSummary({ id: 'players:tessaly-oakhand', slug: 'tessaly-oakhand', title: 'Tessaly Oakhand' });
const SERRIK = buildSummary({ id: 'players:serrik-vane', slug: 'serrik-vane', title: 'Serrik Vane' });

const inputWithValue = (value: string): HTMLInputElement => {
    const input = document.createElement('input');
    input.value = value;
    return input;
};

const changeEvent = (value: string): Event => ({ target: inputWithValue(value) }) as unknown as Event;

describe('CombatComponent', () => {
    let fixture: ComponentFixture<CombatComponent>;
    let component: CombatComponent;
    let store: MockStore;
    let modalService: { confirm: jest.Mock; addCondition: jest.Mock; editCondition: jest.Mock };

    const setTurnOrder = (combatants: ICombatant[]): void => {
        store.overrideSelector(selectTurnOrder, combatants);
        store.refreshState();
    };

    const setInProgress = (round: number, turnId: string | null): void => {
        store.overrideSelector(selectCombatRound, round);
        store.overrideSelector(selectActiveTurnId, turnId);
        store.overrideSelector(selectCombatInProgress, turnId !== null);
        store.refreshState();
    };

    const setPlayerMode = (playerMode: boolean): void => {
        store.overrideSelector(selectPlayerMode, playerMode);
        store.refreshState();
    };

    const textOf = (selector: string): string =>
        (fixture.nativeElement.querySelector(selector) as HTMLElement | null)?.textContent ?? '';

    const nameIn = (row: HTMLElement): string =>
        (row.querySelector('.cdx-combat-name-input') as HTMLInputElement | null)?.value ??
        row.querySelector('.cdx-combat-name')?.textContent ??
        '';

    beforeEach(async () => {
        // Arrange
        modalService = { confirm: jest.fn(), addCondition: jest.fn(), editCondition: jest.fn() };

        await TestBed.configureTestingModule({
            imports: [CombatComponent, NoopAnimationsModule],
            providers: [provideMockStore({ initialState: {} }), { provide: ModalService, useValue: modalService }]
        }).compileComponents();

        store = TestBed.inject(MockStore);
        store.overrideSelector(selectTurnOrder, [buildPlayerCombatant(), buildCombatant()]);
        store.overrideSelector(selectCombatRound, 0);
        store.overrideSelector(selectActiveTurnId, null);
        store.overrideSelector(selectCombatInProgress, false);
        store.overrideSelector(selectCombatLoading, false);
        store.overrideSelector(selectCombatError, null);
        store.overrideSelector(selectPlayerEntries, [TESSALY, SERRIK]);
        store.overrideSelector(selectPlayerMode, false);

        fixture = TestBed.createComponent(CombatComponent);
        component = fixture.componentInstance;
    });

    it('should request the encounter on init', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        fixture.detectChanges();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CombatActions.loadEncounter.request({}));
    });

    it('should reload the encounter on refresh', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['refresh']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CombatActions.loadEncounter.request({}));
    });

    it('should render a row per combatant in turn order', () => {
        // Act
        fixture.detectChanges();
        const rows = fixture.nativeElement.querySelectorAll('.cdx-combat-row') as NodeListOf<HTMLElement>;

        // Assert
        expect(rows.length).toBe(2);
        expect(nameIn(rows[0])).toBe('Tessaly Oakhand');
        expect(nameIn(rows[1])).toBe('Goblin 1');
    });

    it('should render an empty state without combatants', () => {
        // Arrange
        setTurnOrder([]);

        // Act
        fixture.detectChanges();

        // Assert
        expect(textOf('.cdx-section-empty').includes('No one is in the turn order yet.')).toBe(true);
        expect(textOf('.cdx-section-empty').includes('Add the party')).toBe(true);
    });

    it('should show the error message', () => {
        // Arrange
        store.overrideSelector(selectCombatError, 'offline');
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        expect(textOf('.cdx-combat-error')).toBe('offline');
    });

    it('should show the round and highlight the acting combatant while combat runs', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        setInProgress(3, 'goblin-1');
        fixture.detectChanges();
        const active = fixture.nativeElement.querySelector('.cdx-combat-row-active') as HTMLElement;

        // Assert
        expect(textOf('.cdx-combat-round').includes('Round 3')).toBe(true);
        expect(nameIn(active)).toBe('Goblin 1');
        expect(active.getAttribute('aria-current')).toBe('step');
    });

    it('should list only the players not yet in the fight', () => {
        // Act
        fixture.detectChanges();
        const available = component['availablePlayers']();

        // Assert
        expect(available).toEqual([SERRIK]);
    });

    it('should add players from the codex with blank stats', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['addPlayers']([SERRIK]);

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CombatActions.combatantsAdded({
                combatants: [
                    {
                        id: expect.any(String),
                        name: 'Serrik Vane',
                        kind: CombatantKind.Player,
                        entryId: SERRIK.id,
                        initiative: 0,
                        initiativeNudge: 0,
                        color: null,
                        hp: null,
                        maxHp: null,
                        ac: null,
                        conditions: []
                    }
                ]
            })
        );
    });

    it('should not dispatch when there are no players to add', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['addPlayers']([]);

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should add a single enemy without hit points or armour class', () => {
        // Arrange
        setTurnOrder([]);
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        component['enemyForm'].setValue({ name: ' Ogre ', count: 1, initiative: 8 });

        // Act
        component['addEnemies']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CombatActions.combatantsAdded({
                combatants: [
                    {
                        id: expect.any(String),
                        name: 'Ogre',
                        kind: CombatantKind.Enemy,
                        entryId: null,
                        initiative: 8,
                        initiativeNudge: 0,
                        color: null,
                        hp: null,
                        maxHp: null,
                        ac: null,
                        conditions: []
                    }
                ]
            })
        );
        expect(component['enemyForm'].controls.name.value).toBe('');
        expect(component['enemyForm'].controls.count.value).toBe(1);
    });

    it('should number several copies after those already fighting and roll a blank initiative', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
        component['enemyForm'].setValue({ name: 'Goblin', count: 2, initiative: null });

        // Act
        component['addEnemies']();
        randomSpy.mockRestore();

        // Assert
        const action = dispatchSpy.mock.calls[0][0] as ReturnType<typeof CombatActions.combatantsAdded>;
        expect(action.combatants.map((combatant) => combatant.name)).toEqual(['Goblin 2', 'Goblin 3']);
        expect(action.combatants.every((combatant) => combatant.initiative === 11)).toBe(true);
        expect(action.combatants.every((combatant) => combatant.hp === null && combatant.ac === null)).toBe(true);
        expect(action.combatants[0].id === action.combatants[1].id).toBe(false);
    });

    it('should number a second copy of an unnumbered enemy', () => {
        // Arrange
        setTurnOrder([buildCombatant({ name: 'Ogre' })]);
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        component['enemyForm'].setValue({ name: 'ogre', count: 1, initiative: 3 });

        // Act
        component['addEnemies']();

        // Assert
        const action = dispatchSpy.mock.calls[0][0] as ReturnType<typeof CombatActions.combatantsAdded>;
        expect(action.combatants[0].name).toBe('ogre 2');
    });

    it('should clear the submitted state after adding through the form', () => {
        // Arrange
        fixture.detectChanges();
        component['enemyForm'].setValue({ name: 'Ogre', count: 1, initiative: 8 });
        const form = fixture.nativeElement.querySelector('.cdx-combat-form') as HTMLFormElement;

        // Act
        form.dispatchEvent(new Event('submit'));
        fixture.detectChanges();

        // Assert
        expect(component['enemyFormDirective']()?.submitted).toBe(false);
        expect(component['enemyForm'].controls.name.value).toBe('');
    });

    it('should not add an enemy without a name', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        component['enemyForm'].controls.name.setValue('   ');

        // Act
        component['addEnemies']();

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
        expect(component['enemyForm'].controls.name.touched).toBe(true);
    });

    it('should update the initiative only when it changed', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const goblin = buildCombatant();

        // Act
        component['changeInitiative'](goblin, changeEvent('12'));
        component['changeInitiative'](goblin, changeEvent('17.6'));

        // Assert
        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        expect(dispatchSpy).toHaveBeenCalledWith(
            CombatActions.combatantUpdated({ id: 'goblin-1', changes: { initiative: 17 } })
        );
    });

    it('should treat an unreadable initiative as 0', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['changeInitiative'](buildCombatant(), changeEvent('abc'));

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CombatActions.combatantUpdated({ id: 'goblin-1', changes: { initiative: 0 } })
        );
    });

    it('should update the initiative nudge only when it changed', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const goblin = buildCombatant();

        // Act
        component['changeInitiativeNudge'](goblin, changeEvent('0'));
        component['changeInitiativeNudge'](goblin, changeEvent('2.4'));
        component['changeInitiativeNudge'](goblin, changeEvent('abc'));

        // Assert
        expect(dispatchSpy).toHaveBeenCalledTimes(1);
        expect(dispatchSpy).toHaveBeenCalledWith(
            CombatActions.combatantUpdated({ id: 'goblin-1', changes: { initiativeNudge: 2 } })
        );
    });

    it('should rename a combatant with a trimmed name', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['changeName'](buildCombatant(), changeEvent('  Goblin Boss  '));

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CombatActions.combatantUpdated({ id: 'goblin-1', changes: { name: 'Goblin Boss' } })
        );
    });

    it('should not rename a combatant when the name is unchanged', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['changeName'](buildCombatant(), changeEvent(' Goblin 1 '));

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should restore the current name when the field is cleared', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const input = inputWithValue('   ');

        // Act
        component['changeName'](buildCombatant(), { target: input } as unknown as Event);

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
        expect(input.value).toBe('Goblin 1');
    });

    it('should store a picked colour in lower case', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['changeColor'](buildCombatant(), changeEvent('#AA00CC'));

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CombatActions.combatantUpdated({ id: 'goblin-1', changes: { color: '#aa00cc' } })
        );
    });

    it('should store null when the default colour for the kind is picked', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const goblin = buildCombatant({ color: '#aa00cc' });

        // Act
        component['changeColor'](goblin, changeEvent(DEFAULT_COMBATANT_COLORS[CombatantKind.Enemy]));

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CombatActions.combatantUpdated({ id: 'goblin-1', changes: { color: null } })
        );
    });

    it('should not update the colour when it is unchanged', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['changeColor'](buildCombatant(), changeEvent(DEFAULT_COMBATANT_COLORS[CombatantKind.Enemy]));
        component['changeColor'](buildCombatant({ color: '#aa00cc' }), changeEvent('#aa00cc'));

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should colour each row with its own colour or the default for its kind', () => {
        // Arrange
        setTurnOrder([buildPlayerCombatant(), buildCombatant({ color: '#aa00cc' })]);

        // Act
        fixture.detectChanges();
        const rows = fixture.nativeElement.querySelectorAll('.cdx-combat-row') as NodeListOf<HTMLElement>;
        const pickers = fixture.nativeElement.querySelectorAll('.cdx-combat-color') as NodeListOf<HTMLInputElement>;

        // Assert
        expect(rows[0].style.getPropertyValue('--cdx-combatant-color')).toBe(
            DEFAULT_COMBATANT_COLORS[CombatantKind.Player]
        );
        expect(rows[1].style.getPropertyValue('--cdx-combatant-color')).toBe('#aa00cc');
        expect(pickers[1].value).toBe('#aa00cc');
    });

    it('should render the name, nudge and colour fields for the DM', () => {
        // Arrange
        setTurnOrder([buildCombatant({ initiativeNudge: 3 })]);

        // Act
        fixture.detectChanges();
        const row = fixture.nativeElement.querySelector('.cdx-combat-row') as HTMLElement;
        const nudge = row.querySelector('[aria-label="Goblin 1 initiative nudge"]') as HTMLInputElement;

        // Assert
        expect(nudge.value).toBe('3');
        expect(row.querySelector('[aria-label="Goblin 1 name"]') !== null).toBe(true);
        expect(row.querySelector('[aria-label="Goblin 1 colour"]') !== null).toBe(true);
    });

    it('should show the name as text without nudge or colour fields in player view', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        setPlayerMode(true);
        fixture.detectChanges();
        const row = fixture.nativeElement.querySelector('.cdx-combat-row') as HTMLElement;

        // Assert
        expect(textOf('.cdx-combat-name')).toBe('Tessaly Oakhand');
        expect(row.querySelector('.cdx-combat-name-input') === null).toBe(true);
        expect(row.querySelector('.cdx-combat-nudge') === null).toBe(true);
        expect(row.querySelector('.cdx-combat-color') === null).toBe(true);
    });

    it('should add the condition chosen in the modal', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const condition = { name: 'Poisoned', rounds: 3 };
        modalService.addCondition.mockReturnValue(of(condition));

        // Act
        component['addCondition'](buildCombatant());

        // Assert
        expect(modalService.addCondition).toHaveBeenCalledWith({
            title: 'Add condition to Goblin 1',
            suggestions: COMBAT_CONDITIONS
        });
        expect(dispatchSpy).toHaveBeenCalledWith(CombatActions.conditionAdded({ id: 'goblin-1', condition }));
    });

    it('should not add a condition when the modal is dismissed', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        modalService.addCondition.mockReturnValue(of(null));

        // Act
        component['addCondition'](buildCombatant());

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should update a condition edited in the modal', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const condition = { name: 'Poisoned', rounds: 3 };
        const edited = { name: 'Poisoned', rounds: 1, description: 'Disadvantage on attacks.' };
        modalService.editCondition.mockReturnValue(of(edited));

        // Act
        component['editCondition'](buildCombatant(), condition);

        // Assert
        expect(modalService.editCondition).toHaveBeenCalledWith({
            title: 'Edit Poisoned on Goblin 1',
            suggestions: COMBAT_CONDITIONS,
            condition
        });
        expect(dispatchSpy).toHaveBeenCalledWith(
            CombatActions.conditionUpdated({ id: 'goblin-1', name: 'Poisoned', condition: edited })
        );
    });

    it('should not update a condition when the edit modal is dismissed', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        modalService.editCondition.mockReturnValue(of(null));

        // Act
        component['editCondition'](buildCombatant(), { name: 'Prone', rounds: null });

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should open the edit modal when a condition is clicked', () => {
        // Arrange
        const condition = { name: 'Prone', rounds: null };
        setTurnOrder([buildCombatant({ conditions: [condition] })]);
        modalService.editCondition.mockReturnValue(of(null));
        fixture.detectChanges();
        const edit = fixture.nativeElement.querySelector('[aria-label="Edit Prone"]') as HTMLButtonElement;

        // Act
        edit.click();

        // Assert
        expect(modalService.editCondition).toHaveBeenCalledWith(expect.objectContaining({ condition }));
    });

    it('should not allow editing conditions in player view', () => {
        // Arrange
        setTurnOrder([buildCombatant({ conditions: [{ name: 'Prone', rounds: null }] })]);
        setPlayerMode(true);

        // Act
        fixture.detectChanges();
        const edit = fixture.nativeElement.querySelector('.cdx-combat-condition-edit') as HTMLButtonElement;

        // Assert
        expect(edit.disabled).toBe(true);
        expect(edit.hasAttribute('aria-label')).toBe(false);
    });

    it('should render conditions with their remaining rounds', () => {
        // Arrange
        setTurnOrder([
            buildCombatant({
                conditions: [
                    { name: 'Prone', rounds: null },
                    { name: 'Frightened', rounds: 2 }
                ]
            })
        ]);

        // Act
        fixture.detectChanges();
        const chips = fixture.nativeElement.querySelectorAll('.cdx-combat-condition') as NodeListOf<HTMLElement>;

        // Assert
        expect(chips.length).toBe(2);
        expect((chips[0].textContent ?? '').includes('Prone')).toBe(true);
        expect((chips[1].textContent ?? '').includes('2r')).toBe(true);
    });

    it('should show a condition description as a tooltip with an info icon', () => {
        // Arrange
        setTurnOrder([
            buildCombatant({
                conditions: [
                    { name: 'Marked', rounds: null, description: 'Next hit deals +1d6.' },
                    { name: 'Prone', rounds: null }
                ]
            })
        ]);

        // Act
        fixture.detectChanges();
        const chips = fixture.debugElement.queryAll(By.css('.cdx-combat-condition'));
        const described = chips[0].injector.get(MatTooltip);
        const plain = chips[1].injector.get(MatTooltip);

        // Assert
        expect(described.message).toBe('Next hit deals +1d6.');
        expect(plain.message).toBe('');
        expect(chips[0].nativeElement.getAttribute('aria-description')).toBe('Next hit deals +1d6.');
        expect(chips[0].nativeElement.querySelector('.cdx-combat-condition-info') !== null).toBe(true);
        expect(chips[1].nativeElement.querySelector('.cdx-combat-condition-info') === null).toBe(true);
        expect(chips[1].nativeElement.hasAttribute('aria-description')).toBe(false);
    });

    it('should remove a condition', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['removeCondition'](buildCombatant(), { name: 'Prone', rounds: null });

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CombatActions.conditionRemoved({ id: 'goblin-1', name: 'Prone' }));
    });

    it('should remove a combatant', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['removeCombatant'](buildCombatant());

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CombatActions.combatantRemoved({ id: 'goblin-1' }));
    });

    it('should start combat from the start button', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const startButton = fixture.nativeElement.querySelector('.cdx-combat-start') as HTMLButtonElement;

        // Act
        startButton.click();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CombatActions.combatStarted());
    });

    it('should disable the start button with nobody in the turn order', () => {
        // Arrange
        setTurnOrder([]);

        // Act
        fixture.detectChanges();
        const startButton = fixture.nativeElement.querySelector('.cdx-combat-start') as HTMLButtonElement;

        // Assert
        expect(startButton.disabled).toBe(true);
    });

    it('should advance and revert the turn', () => {
        // Arrange
        fixture.detectChanges();
        setInProgress(2, 'tessaly');
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const nextButton = fixture.nativeElement.querySelector('.cdx-combat-next') as HTMLButtonElement;

        // Act
        nextButton.click();
        component['previousTurn']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CombatActions.turnAdvanced());
        expect(dispatchSpy).toHaveBeenCalledWith(CombatActions.turnReverted());
    });

    it('should allow stepping back except on the first turn of round 1', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        setInProgress(1, 'tessaly');
        const atStart = component['canRevert']();
        setInProgress(1, 'goblin-1');
        const laterInRound = component['canRevert']();
        setInProgress(2, 'tessaly');
        const laterRound = component['canRevert']();

        // Assert
        expect(atStart).toBe(false);
        expect(laterInRound).toBe(true);
        expect(laterRound).toBe(true);
    });

    it('should end combat once confirmed', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        modalService.confirm.mockReturnValue(of(true));

        // Act
        component['endCombat']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(CombatActions.combatEnded());
    });

    it('should keep combat running when ending is cancelled', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        modalService.confirm.mockReturnValue(of(false));

        // Act
        component['endCombat']();

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should hide the controls in player view', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        setPlayerMode(true);
        fixture.detectChanges();
        const rows = fixture.nativeElement.querySelectorAll('.cdx-combat-row') as NodeListOf<HTMLElement>;

        // Assert
        expect(fixture.nativeElement.querySelector('.cdx-combat-controls') === null).toBe(true);
        expect(fixture.nativeElement.querySelector('.cdx-combat-form') === null).toBe(true);
        expect(rows[1].querySelector('[aria-label="Remove from combat"]') === null).toBe(true);
    });

    it('should not show hit points or armour class for any combatant', () => {
        // Arrange
        setTurnOrder([buildPlayerCombatant({ hp: 0 }), buildCombatant()]);

        // Act
        fixture.detectChanges();
        const order = fixture.nativeElement.querySelector('.cdx-combat-order') as HTMLElement;

        // Assert
        expect(order.querySelector('[aria-label="Tessaly Oakhand current HP"]') === null).toBe(true);
        expect(order.querySelector('[aria-label="Tessaly Oakhand armour class"]') === null).toBe(true);
        expect(order.querySelector('[aria-label="Damage"]') === null).toBe(true);
        expect(order.querySelector('[aria-label="Heal"]') === null).toBe(true);
        expect((order.textContent ?? '').includes('Down')).toBe(false);
    });

    it('should list each available player in the add menu without a whole party option', () => {
        // Arrange
        setTurnOrder([]);
        fixture.detectChanges();
        const addButton = Array.from(
            fixture.nativeElement.querySelectorAll('.cdx-combat-controls button') as NodeListOf<HTMLButtonElement>
        ).find((button) => (button.textContent ?? '').includes('Add player')) as HTMLButtonElement;

        // Act
        addButton.click();
        fixture.detectChanges();
        const items = Array.from(document.querySelectorAll('.mat-mdc-menu-item')).map((item) =>
            (item.textContent ?? '').trim()
        );

        // Assert
        expect(items).toEqual(['Tessaly Oakhand', 'Serrik Vane']);
    });

    it('should not offer HP or AC fields when adding an enemy', () => {
        // Act
        fixture.detectChanges();
        const form = fixture.nativeElement.querySelector('.cdx-combat-form') as HTMLFormElement;

        // Assert
        expect(form.querySelector('[formcontrolname="hp"]') === null).toBe(true);
        expect(form.querySelector('[formcontrolname="ac"]') === null).toBe(true);
        expect(Object.keys(component['enemyForm'].controls)).toEqual(['name', 'count', 'initiative']);
    });

    it('should re-render when the turn order changes', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        setTurnOrder([buildCombatant()]);
        fixture.detectChanges();
        const rows = fixture.nativeElement.querySelectorAll('.cdx-combat-row') as NodeListOf<HTMLElement>;

        // Assert
        expect(rows.length).toBe(1);
    });
});
