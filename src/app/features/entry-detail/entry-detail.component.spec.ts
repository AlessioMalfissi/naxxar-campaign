import { Component, input, output } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { BehaviorSubject, of } from 'rxjs';

import { CodexSection, EntryVisibility, SaveStatus, ViewMode } from '@core/models';
import { MarkdownCommand } from '@core/services/markdown-command.service';
import { MarkdownExportService } from '@core/services/markdown-export.service';
import { ICreateEntryResult } from '@shared/modal/i-modal';
import { ModalService } from '@shared/modal/modal.service';
import { buildEntry, buildSummary } from '@testing/entry.fixtures';
import * as CodexActions from '@store/codex/codex.actions';
import {
    selectEntryLoading,
    selectEntryTitles,
    selectOpenEntry,
    selectPlayerMode,
    selectReferencedEntries,
    selectReferencingEntries
} from '@store/codex/codex.selectors';
import * as EditorActions from '@store/editor/editor.actions';
import {
    selectDraftBody,
    selectIsDirty,
    selectLastSavedAt,
    selectLastSavedBy,
    selectSaveStatus,
    selectShowEditor,
    selectShowPreview,
    selectViewMode
} from '@store/editor/editor.selectors';
import { EntryDetailComponent } from './entry-detail.component';
import { MarkdownToolbarComponent } from './markdown-toolbar.component';

@Component({ selector: 'cdx-markdown-toolbar', standalone: true, template: '' })
class MarkdownToolbarMockComponent {
    readonly activeCommands = input<MarkdownCommand[]>([]);
    readonly viewMode = input<ViewMode>(ViewMode.Edit);
    readonly commandRequested = output<MarkdownCommand>();
    readonly viewModeRequested = output<ViewMode>();
}

describe('EntryDetailComponent', () => {
    let fixture: ComponentFixture<EntryDetailComponent>;
    let component: EntryDetailComponent;
    let store: MockStore;
    let paramMap$: BehaviorSubject<ParamMap>;
    let router: { navigate: jest.Mock };
    let modalService: { confirm: jest.Mock; prompt: jest.Mock; editEntry: jest.Mock };
    let exportService: { download: jest.Mock; toMarkdown: jest.Mock };

    beforeEach(async () => {
        // Arrange
        paramMap$ = new BehaviorSubject<ParamMap>(
            convertToParamMap({ section: CodexSection.Npcs, slug: 'vaelith-corrun' })
        );
        router = { navigate: jest.fn().mockResolvedValue(true) };
        modalService = {
            confirm: jest.fn().mockReturnValue(of(true)),
            prompt: jest.fn(),
            editEntry: jest.fn().mockReturnValue(of(null))
        };
        exportService = { download: jest.fn(), toMarkdown: jest.fn() };

        await TestBed.configureTestingModule({
            imports: [EntryDetailComponent, NoopAnimationsModule],
            providers: [
                provideMockStore({ initialState: {} }),
                { provide: ActivatedRoute, useValue: { paramMap: paramMap$.asObservable() } },
                { provide: Router, useValue: router },
                { provide: ModalService, useValue: modalService },
                { provide: MarkdownExportService, useValue: exportService }
            ]
        })
            .overrideComponent(EntryDetailComponent, {
                remove: { imports: [MarkdownToolbarComponent] },
                add: { imports: [MarkdownToolbarMockComponent] }
            })
            .compileComponents();

        store = TestBed.inject(MockStore);
        store.overrideSelector(
            selectOpenEntry,
            buildEntry({
                fields: { race: 'Half-elf', role: 'Broker', affiliation: 'organizations:silver-ledger' }
            })
        );
        store.overrideSelector(selectDraftBody, '# Who he is\n\nBroker of debts.');
        store.overrideSelector(selectSaveStatus, SaveStatus.Idle);
        store.overrideSelector(selectViewMode, ViewMode.Edit);
        store.overrideSelector(selectShowEditor, true);
        store.overrideSelector(selectShowPreview, false);
        store.overrideSelector(selectIsDirty, false);
        store.overrideSelector(selectPlayerMode, false);
        store.overrideSelector(selectEntryLoading, false);
        store.overrideSelector(selectLastSavedAt, new Date().toISOString());
        store.overrideSelector(selectLastSavedBy, 'DM');
        store.overrideSelector(selectEntryTitles, { 'organizations:silver-ledger': 'Silver ledger' });
        store.overrideSelector(selectReferencingEntries, []);
        store.overrideSelector(selectReferencedEntries, []);

        fixture = TestBed.createComponent(EntryDetailComponent);
        component = fixture.componentInstance;
    });

    it('should request the entry named in the route', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        paramMap$.next(convertToParamMap({ section: CodexSection.Places, slug: 'ashfall-city' }));
        fixture.detectChanges();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CodexActions.loadEntry.request({ id: 'places:ashfall-city' })
        );
    });

    it('should ignore an incomplete route', () => {
        // Arrange
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        dispatchSpy.mockClear();

        // Act
        paramMap$.next(convertToParamMap({ section: CodexSection.Npcs }));
        fixture.detectChanges();

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should render the title, status chip and section label', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        const title = fixture.nativeElement.querySelector('.cdx-entry-title') as HTMLElement;
        const breadcrumb = fixture.nativeElement.querySelector('.cdx-entry-breadcrumb') as HTMLElement;

        // Assert
        expect(title.textContent).toBe('Vaelith Corrun');
        expect((breadcrumb.textContent ?? '').includes('NPCs')).toBe(true);
    });

    it('should resolve a reference field to the target title', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        const affiliation = component['fields']().find((field) => field.label === 'Affiliation');

        // Assert
        expect(affiliation?.value).toBe('Silver ledger');
    });

    it('should fall back to the slug when the reference title is unknown', () => {
        // Arrange
        store.overrideSelector(selectEntryTitles, {});
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        expect(component['fields']().find((field) => field.label === 'Affiliation')?.value).toBe(
            'Silver Ledger'
        );
    });

    it('should leave a malformed reference untouched', () => {
        // Arrange
        store.overrideSelector(selectOpenEntry, buildEntry({ fields: { affiliation: 'not-an-id' } }));
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        expect(component['fields']().find((field) => field.label === 'Affiliation')?.value).toBe('not-an-id');
    });

    it('should render the draft body as html', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        const html = component['renderedHtml']();

        // Assert
        expect(html.includes('<h1')).toBe(true);
    });

    it('should dispatch the changed body', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['onBodyChanged']('# Edited');

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(EditorActions.bodyChanged({ body: '# Edited' }));
    });

    it('should forward a toolbar command to the editor', () => {
        // Arrange
        fixture.detectChanges();
        const editor = fixture.nativeElement.querySelector('.cdx-editor-input') as HTMLTextAreaElement;
        editor.setSelectionRange(2, 8);

        // Act
        component['onCommand']('bold');
        fixture.detectChanges();

        // Assert
        expect(editor.value.includes('**')).toBe(true);
    });

    it('should track the formatting under the caret as it moves', () => {
        // Arrange
        fixture.detectChanges();
        const editor = fixture.nativeElement.querySelector('.cdx-editor-input') as HTMLTextAreaElement;
        editor.value = '**Speaks**';
        editor.setSelectionRange(2, 8);

        // Act
        editor.dispatchEvent(new Event('keyup'));
        fixture.detectChanges();

        // Assert
        expect(component['activeCommands']().includes('bold')).toBe(true);
    });

    it('should clear the reported formatting when the caret leaves the markers', () => {
        // Arrange
        fixture.detectChanges();
        const editor = fixture.nativeElement.querySelector('.cdx-editor-input') as HTMLTextAreaElement;
        editor.value = '**Speaks** softly.';
        editor.setSelectionRange(12, 18);

        // Act
        editor.dispatchEvent(new Event('click'));
        fixture.detectChanges();

        // Assert
        expect(component['activeCommands']().length).toBe(0);
    });

    it('should dispatch a view mode change', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['onViewMode'](ViewMode.Split);

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(EditorActions.viewModeChanged({ viewMode: ViewMode.Split }));
    });

    it('should navigate when an entity link is activated', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        component['onEntryLink']('places:ashfall-city');

        // Assert
        expect(router.navigate).toHaveBeenCalledWith(['/campaign', 'places', 'ashfall-city']);
    });

    it('should ignore an entity link with a malformed id', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        component['onEntryLink']('nonsense');

        // Assert
        expect(router.navigate).not.toHaveBeenCalled();
    });

    it('should dispatch a save when the save button is pressed', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const saveButton = fixture.nativeElement.querySelector('.cdx-entry-save') as HTMLButtonElement;

        // Act
        saveButton.click();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(EditorActions.saveRequested());
    });

    it('should discard changes once the confirmation is accepted', () => {
        // Arrange
        store.overrideSelector(selectIsDirty, true);
        store.refreshState();
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['cancel']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(EditorActions.changesDiscarded());
    });

    it('should keep the draft when the discard is declined', () => {
        // Arrange
        store.overrideSelector(selectIsDirty, true);
        store.refreshState();
        modalService.confirm.mockReturnValue(of(false));
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['cancel']();

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalledWith(EditorActions.changesDiscarded());
    });

    it('should not prompt when there is nothing to discard', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        component['cancel']();

        // Assert
        expect(modalService.confirm).not.toHaveBeenCalled();
    });

    it('should toggle the favourite flag', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');
        const favouriteButton = fixture.nativeElement.querySelector(
            '[aria-label="Toggle favourite"]'
        ) as HTMLButtonElement;

        // Act
        favouriteButton.click();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CodexActions.favouriteToggled({ id: 'npcs:vaelith-corrun' })
        );
    });

    it('should save the entry with the newly picked status', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['onStatusChanged']('Dead');

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CodexActions.saveEntry.request({
                entry: {
                    ...buildEntry({
                        fields: { race: 'Half-elf', role: 'Broker', affiliation: 'organizations:silver-ledger' }
                    }),
                    status: 'Dead',
                    body: '# Who he is\n\nBroker of debts.'
                }
            })
        );
    });

    it('should ignore picking the status the entry already has', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['onStatusChanged']('Alive');

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should render the status as read-only in player mode', () => {
        // Arrange
        store.overrideSelector(selectPlayerMode, true);
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        expect(fixture.nativeElement.querySelector('.cdx-entry-status-trigger') === null).toBe(true);
        expect(fixture.nativeElement.querySelector('.cdx-entry-chip-status').textContent.trim()).toBe('Alive');
    });

    it('should open the edit modal prefilled with the current entry values', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        component['editEntry']();

        // Assert
        expect(modalService.editEntry).toHaveBeenCalledWith(
            expect.objectContaining({
                values: {
                    title: 'Vaelith Corrun',
                    status: 'Alive',
                    tags: ['ally', 'silver-ledger'],
                    visibility: EntryVisibility.Revealed,
                    fields: { race: 'Half-elf', role: 'Broker', affiliation: 'organizations:silver-ledger' }
                }
            })
        );
    });

    it('should save the entry with the edited details', () => {
        // Arrange
        const result: ICreateEntryResult = {
            title: 'Vaelith Corrunne',
            status: 'Dead',
            tags: ['ally'],
            visibility: EntryVisibility.Dm,
            fields: { race: 'Elf' }
        };
        modalService.editEntry.mockReturnValue(of(result));
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['editEntry']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CodexActions.saveEntry.request({
                entry: {
                    ...buildEntry({
                        fields: { race: 'Half-elf', role: 'Broker', affiliation: 'organizations:silver-ledger' }
                    }),
                    title: 'Vaelith Corrunne',
                    status: 'Dead',
                    tags: ['ally'],
                    visibility: EntryVisibility.Dm,
                    fields: { race: 'Elf' },
                    body: '# Who he is\n\nBroker of debts.'
                }
            })
        );
    });

    it('should ignore a dismissed edit modal', () => {
        // Arrange
        modalService.editEntry.mockReturnValue(of(null));
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['editEntry']();

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('should show the edit details action outside player mode', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        const menuTrigger = fixture.nativeElement.querySelector(
            '[aria-label="Entry actions"]'
        ) as HTMLButtonElement;
        menuTrigger.click();
        fixture.detectChanges();

        // Assert
        const items = Array.from(document.querySelectorAll('.mat-mdc-menu-item')) as HTMLElement[];
        expect(items.some((item) => (item.textContent ?? '').includes('Edit details'))).toBe(true);
    });

    it('should hide the edit details action in player mode', () => {
        // Arrange
        store.overrideSelector(selectPlayerMode, true);
        store.refreshState();
        fixture.detectChanges();

        // Act
        const menuTrigger = fixture.nativeElement.querySelector(
            '[aria-label="Entry actions"]'
        ) as HTMLButtonElement;
        menuTrigger.click();
        fixture.detectChanges();

        // Assert
        const items = Array.from(document.querySelectorAll('.mat-mdc-menu-item')) as HTMLElement[];
        expect(items.some((item) => (item.textContent ?? '').includes('Edit details'))).toBe(false);
    });

    it('should export the entry with the current draft body', () => {
        // Arrange
        fixture.detectChanges();

        // Act
        component['exportMarkdown']();

        // Assert
        expect(exportService.download).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'npcs:vaelith-corrun', body: '# Who he is\n\nBroker of debts.' })
        );
    });

    it('should delete the entry and leave for the section list', () => {
        // Arrange
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['deleteEntry']();

        // Assert
        expect(dispatchSpy).toHaveBeenCalledWith(
            CodexActions.deleteEntry.request({ id: 'npcs:vaelith-corrun' })
        );
        expect(router.navigate).toHaveBeenCalledWith(['/campaign', 'npcs']);
    });

    it('should keep the entry when the deletion is declined', () => {
        // Arrange
        modalService.confirm.mockReturnValue(of(false));
        fixture.detectChanges();
        const dispatchSpy = jest.spyOn(store, 'dispatch');

        // Act
        component['deleteEntry']();

        // Assert
        expect(dispatchSpy).not.toHaveBeenCalledWith(
            CodexActions.deleteEntry.request({ id: 'npcs:vaelith-corrun' })
        );
    });

    it('should badge a DM-only entry', () => {
        // Arrange
        store.overrideSelector(selectOpenEntry, buildEntry({ visibility: EntryVisibility.Dm }));
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        expect(fixture.nativeElement.querySelector('.cdx-entry-dm-badge') !== null).toBe(true);
    });

    it('should hide the toolbar and save row in player mode', () => {
        // Arrange
        store.overrideSelector(selectPlayerMode, true);
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        expect(fixture.nativeElement.querySelector('cdx-markdown-toolbar') === null).toBe(true);
        expect(fixture.nativeElement.querySelector('.cdx-entry-status-row') === null).toBe(true);
    });

    it('should list the entries that reference this one', () => {
        // Arrange
        store.overrideSelector(selectReferencingEntries, [
            buildSummary({ id: 'npcs:mother-ilsabeth', title: 'Mother Ilsabeth' })
        ]);
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        expect(fixture.nativeElement.querySelector('.cdx-entry-references') !== null).toBe(true);
    });

    it('should show a missing-entry message when nothing is open', () => {
        // Arrange
        store.overrideSelector(selectOpenEntry, null);
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        expect(fixture.nativeElement.querySelector('.cdx-entry-missing') !== null).toBe(true);
    });

    it('should mark the pane as loading', () => {
        // Arrange
        store.overrideSelector(selectEntryLoading, true);
        store.refreshState();

        // Act
        fixture.detectChanges();

        // Assert
        expect(fixture.nativeElement.querySelector('.pane-is-loading') !== null).toBe(true);
    });

    it('should describe the save time in words', () => {
        // Arrange
        const cases = [
            new Date().toISOString(),
            new Date(Date.now() - 5 * 60000).toISOString(),
            new Date(Date.now() - 3 * 3600000).toISOString(),
            new Date(Date.now() - 4 * 86400000).toISOString()
        ];
        fixture.detectChanges();

        // Act
        const labels = cases.map((savedAt) => {
            store.overrideSelector(selectLastSavedAt, savedAt);
            store.refreshState();
            fixture.detectChanges();
            return component['savedLabel']();
        });

        // Assert
        expect(labels[0]).toBe('Saved just now · edited by DM');
        expect(labels[1]).toBe('Saved 5 min ago · edited by DM');
        expect(labels[2]).toBe('Saved 3 h ago · edited by DM');
        expect(labels[3]).toBe('Saved 4 days ago · edited by DM');
    });

    it('should show no save label before the first save', () => {
        // Arrange
        store.overrideSelector(selectLastSavedAt, null);
        store.refreshState();
        fixture.detectChanges();

        // Act
        const label = component['savedLabel']();

        // Assert
        expect(label).toBe('');
    });
});
