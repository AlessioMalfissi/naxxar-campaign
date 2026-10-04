import { DOCUMENT } from '@angular/common';
import { afterNextRender, ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { NavigationStart, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { filter, fromEvent } from 'rxjs';

import { findHelpCategoryDefinition, HELP_CATEGORY_DEFINITIONS, HelpCategory, IHelpTopic } from '@core/models';
import { resolveHelpPage } from '@core/utils/help-page.util';
import * as CodexActions from '@store/codex/codex.actions';
import { HELP_PAGE_LABELS, helpTopicsFor } from './help-topics';

// Dots sit on the top-right corner of their element, nudged inwards so they stay on screen.
const DOT_INSET_PX = 4;
const DOT_EDGE_MARGIN_PX = 14;
const CARD_WIDTH_PX = 300;
const CARD_GAP_PX = 18;
const CARD_ESTIMATED_HEIGHT_PX = 220;
const VIEWPORT_MARGIN_PX = 16;

export interface IHelpRect {
    top: number;
    left: number;
    width: number;
    height: number;
}

export interface IHelpMarker {
    topic: IHelpTopic;
    step: number;
    color: string;
    dotTop: number;
    dotLeft: number;
    target: IHelpRect;
}

export interface IHelpCardPosition {
    left: number;
    width: number;
    top: number | null;
    bottom: number | null;
}

interface IViewport {
    width: number;
    height: number;
}

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);

@Component({
    selector: 'cdx-help-overlay',
    standalone: true,
    imports: [MatButtonModule, MatIconModule],
    templateUrl: './help-overlay.component.html',
    styleUrl: './help-overlay.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        '(window:resize)': 'measure()',
        '(document:keydown.escape)': 'close()',
        '(document:keydown.arrowright)': 'next()',
        '(document:keydown.arrowleft)': 'previous()'
    }
})
export class HelpOverlayComponent {
    private readonly store = inject(Store);
    private readonly router = inject(Router);
    private readonly document = inject(DOCUMENT);

    protected readonly categories = HELP_CATEGORY_DEFINITIONS;
    protected readonly markers = signal<IHelpMarker[]>([]);
    protected readonly activeIndex = signal<number | null>(null);

    protected readonly pageLabel = computed<string>(() => {
        const page = this.page();
        return page === null ? 'Campaign' : HELP_PAGE_LABELS[page];
    });

    protected readonly activeMarker = computed<IHelpMarker | null>(() => {
        const index = this.activeIndex();
        return index === null ? null : (this.markers()[index] ?? null);
    });

    protected readonly isLast = computed<boolean>(() => this.activeIndex() === this.markers().length - 1);

    protected readonly cardPosition = computed<IHelpCardPosition | null>(() => {
        const marker = this.activeMarker();
        if (marker === null) {
            return null;
        }

        const { width, height } = this.viewport();
        const cardWidth = Math.min(CARD_WIDTH_PX, width - VIEWPORT_MARGIN_PX * 2);
        const left = clamp(
            marker.dotLeft - cardWidth / 2,
            VIEWPORT_MARGIN_PX,
            width - VIEWPORT_MARGIN_PX - cardWidth
        );
        const below = marker.dotTop + CARD_GAP_PX;
        const fitsBelow = below + CARD_ESTIMATED_HEIGHT_PX <= height - VIEWPORT_MARGIN_PX;

        // Anchored by `bottom` when above the dot, so the card's real height doesn't matter.
        return fitsBelow
            ? { left, width: cardWidth, top: below, bottom: null }
            : { left, width: cardWidth, top: null, bottom: height - marker.dotTop + CARD_GAP_PX };
    });

    private readonly page = signal(resolveHelpPage(this.router.url));
    private readonly viewport = signal<IViewport>({ width: 0, height: 0 });

    constructor() {
        afterNextRender(() => this.measure());

        // The dots belong to the page they were opened on, so leaving it closes the overlay.
        this.router.events
            .pipe(
                filter((event) => event instanceof NavigationStart),
                takeUntilDestroyed()
            )
            .subscribe(() => this.close());

        // Scroll events don't bubble, so listen in the capture phase to catch scrolling panes too.
        fromEvent(this.document, 'scroll', { capture: true })
            .pipe(takeUntilDestroyed())
            .subscribe(() => this.measure());
    }

    protected measure(): void {
        const view = this.document.defaultView;
        const viewport: IViewport = { width: view?.innerWidth ?? 0, height: view?.innerHeight ?? 0 };

        const markers = helpTopicsFor(this.page())
            .map((topic) => ({ topic, rect: this.findAnchor(topic.id)?.getBoundingClientRect() ?? null }))
            .filter(
                (item): item is { topic: IHelpTopic; rect: DOMRect } =>
                    item.rect !== null && (item.rect.width > 0 || item.rect.height > 0)
            )
            .map(({ topic, rect }, index) => ({
                topic,
                step: index + 1,
                color: this.colorFor(topic.category),
                dotTop: clamp(rect.top + DOT_INSET_PX, DOT_EDGE_MARGIN_PX, viewport.height - DOT_EDGE_MARGIN_PX),
                dotLeft: clamp(rect.right - DOT_INSET_PX, DOT_EDGE_MARGIN_PX, viewport.width - DOT_EDGE_MARGIN_PX),
                target: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
            }));

        this.viewport.set(viewport);
        this.markers.set(markers);

        const index = this.activeIndex();
        if (index !== null && index >= markers.length) {
            this.activeIndex.set(null);
        }
    }

    protected select(index: number): void {
        const marker = this.markers()[index];
        if (marker === undefined) {
            return;
        }

        this.activeIndex.set(index);
        this.revealTarget(marker);
    }

    protected next(): void {
        const index = this.activeIndex();
        this.select(index === null ? 0 : index + 1);
    }

    protected previous(): void {
        const index = this.activeIndex();
        if (index !== null && index > 0) {
            this.select(index - 1);
        }
    }

    protected close(): void {
        this.store.dispatch(CodexActions.helpClosed());
    }

    protected colorFor(category: HelpCategory): string {
        return findHelpCategoryDefinition(category).color;
    }

    protected labelFor(category: HelpCategory): string {
        return findHelpCategoryDefinition(category).label;
    }

    private findAnchor(id: string): HTMLElement | null {
        return this.document.querySelector<HTMLElement>(`[data-help="${id}"]`);
    }

    // Scrolls an off-screen target into view; the scroll listener then moves the dots along.
    private revealTarget(marker: IHelpMarker): void {
        const { width, height } = this.viewport();
        const { top, left, height: targetHeight, width: targetWidth } = marker.target;
        const visible = top >= 0 && left >= 0 && top + targetHeight <= height && left + targetWidth <= width;
        if (!visible) {
            this.findAnchor(marker.topic.id)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }
}
