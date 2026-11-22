import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    ElementRef,
    inject,
    OnInit,
    signal,
    viewChild
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';

import { ApiCallStatus, IInvitePreview } from '@core/models';
import { GoogleSignInService } from '@core/services/google-sign-in.service';
import { formatEuropeanDateTime } from '@core/utils/date-format.util';
import * as AuthActions from '@store/auth/auth.actions';
import {
    selectAuthChecked,
    selectAuthError,
    selectAuthErrorStatus,
    selectAuthPending,
    selectAuthenticated,
    selectCampaigns,
    selectConfig
} from '@store/auth/auth.selectors';
import * as CampaignMembersActions from '@store/campaign-members/campaign-members.actions';
import {
    selectCampaignMembersError,
    selectCampaignMembersErrorStatus,
    selectCampaignMembersLoading,
    selectCampaignMembersStatus,
    selectInvitePreview
} from '@store/campaign-members/campaign-members.selectors';

const INVALID_INVITE_STATUS = 404;
const EXPIRED_INVITE_STATUS = 410;
const ACCOUNT_EXISTS_STATUS = 409;

@Component({
    selector: 'cdx-invite-accept',
    standalone: true,
    imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, RouterLink],
    templateUrl: './invite-accept.component.html',
    styleUrl: './invite-accept.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class InviteAcceptComponent implements OnInit {
    private readonly store = inject(Store);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly googleSignIn = inject(GoogleSignInService);

    protected readonly token = this.route.snapshot.paramMap.get('token') ?? '';
    protected readonly checked = toSignal(this.store.select(selectAuthChecked), { initialValue: false });
    protected readonly authenticated = toSignal(this.store.select(selectAuthenticated), { initialValue: false });
    protected readonly campaigns = toSignal(this.store.select(selectCampaigns), { initialValue: [] });
    protected readonly preview = toSignal(this.store.select(selectInvitePreview), { initialValue: null });
    protected readonly previewStatus = toSignal(this.store.select(selectCampaignMembersStatus), {
        initialValue: ApiCallStatus.Idle
    });
    protected readonly previewError = toSignal(this.store.select(selectCampaignMembersError), { initialValue: null });
    protected readonly previewErrorStatus = toSignal(this.store.select(selectCampaignMembersErrorStatus), {
        initialValue: null
    });
    protected readonly accepting = toSignal(this.store.select(selectCampaignMembersLoading), { initialValue: false });
    protected readonly pending = toSignal(this.store.select(selectAuthPending), { initialValue: false });
    protected readonly authError = toSignal(this.store.select(selectAuthError), { initialValue: null });
    protected readonly authErrorStatus = toSignal(this.store.select(selectAuthErrorStatus), { initialValue: null });
    protected readonly googleError = signal<string | null>(null);
    protected readonly mismatch = signal(false);

    protected readonly displayNameControl = new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required, Validators.maxLength(80)]
    });
    protected readonly emailControl = new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email]
    });
    protected readonly passwordControl = new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)]
    });
    protected readonly confirmControl = new FormControl<string>('', {
        nonNullable: true,
        validators: [Validators.required]
    });

    private readonly config = toSignal(this.store.select(selectConfig), {
        initialValue: { googleClientId: null }
    });
    protected readonly googleClientId = computed(() => this.config().googleClientId);
    private readonly googleButton = viewChild<ElementRef<HTMLElement>>('googleButton');
    private renderedClientId: string | null = null;

    protected readonly previewLoading = computed(
        () => this.preview() === null && this.previewStatus() !== ApiCallStatus.Failed
    );
    protected readonly invalidInvite = computed(
        () =>
            this.preview() === null &&
            this.previewStatus() === ApiCallStatus.Failed &&
            this.previewErrorStatus() === INVALID_INVITE_STATUS
    );
    protected readonly expiredInvite = computed(
        () =>
            this.preview() === null &&
            this.previewStatus() === ApiCallStatus.Failed &&
            this.previewErrorStatus() === EXPIRED_INVITE_STATUS
    );
    protected readonly failedInvite = computed(
        () =>
            this.preview() === null &&
            this.previewStatus() === ApiCallStatus.Failed &&
            this.previewErrorStatus() !== INVALID_INVITE_STATUS &&
            this.previewErrorStatus() !== EXPIRED_INVITE_STATUS
    );
    protected readonly isMember = computed(() => {
        const preview = this.preview();
        return preview !== null && this.campaigns().some((campaign) => campaign.slug === preview.campaignSlug);
    });
    protected readonly acceptError = computed(() =>
        this.preview() !== null && this.previewStatus() === ApiCallStatus.Failed ? this.previewError() : null
    );
    protected readonly accountExists = computed(() => this.authErrorStatus() === ACCOUNT_EXISTS_STATUS);
    protected readonly showGoogle = computed(
        () => this.checked() && !this.authenticated() && this.preview() !== null && this.googleClientId() !== null
    );
    protected readonly returnToInvite = `/invite/${encodeURIComponent(this.token)}`;

    constructor() {
        effect(() => {
            const clientId = this.googleClientId();
            const element = this.googleButton()?.nativeElement;
            if (!this.showGoogle() || clientId === null || element === undefined || this.renderedClientId === clientId) {
                return;
            }

            this.renderedClientId = clientId;
            void this.googleSignIn
                .renderButton(element, clientId, (credential) => {
                    this.store.dispatch(
                        AuthActions.googleRegisterViaInvite.request({ token: this.token, credential })
                    );
                })
                .catch(() => {
                    this.renderedClientId = null;
                    this.googleError.set('Google sign-in is unavailable. Create an account with your email instead.');
                });
        });
    }

    ngOnInit(): void {
        if (!this.checked()) {
            this.store.dispatch(AuthActions.checkSession.request({}));
        }

        if (this.token !== '') {
            this.store.dispatch(CampaignMembersActions.loadInvitePreview.request({ token: this.token }));
        }
    }

    protected expiry(preview: IInvitePreview): string {
        return formatEuropeanDateTime(preview.expiresAt);
    }

    protected submitRegistration(): void {
        const password = this.passwordControl.value;
        const confirm = this.confirmControl.value;

        if (
            this.displayNameControl.invalid ||
            this.emailControl.invalid ||
            this.passwordControl.invalid ||
            this.confirmControl.invalid ||
            password !== confirm
        ) {
            this.displayNameControl.markAsTouched();
            this.emailControl.markAsTouched();
            this.passwordControl.markAsTouched();
            this.confirmControl.markAsTouched();
            this.mismatch.set(password !== confirm);
            return;
        }

        this.mismatch.set(false);
        this.store.dispatch(
            AuthActions.registerViaInvite.request({
                token: this.token,
                displayName: this.displayNameControl.value.trim(),
                email: this.emailControl.value.trim(),
                password
            })
        );
    }

    protected join(): void {
        this.store.dispatch(CampaignMembersActions.acceptInvite.request({ token: this.token }));
    }

    protected openCampaign(): void {
        const preview = this.preview();
        if (preview !== null) {
            void this.router.navigate(['/campaigns', preview.campaignSlug, 'npcs']);
        }
    }

    protected retry(): void {
        this.store.dispatch(CampaignMembersActions.loadInvitePreview.request({ token: this.token }));
    }
}
