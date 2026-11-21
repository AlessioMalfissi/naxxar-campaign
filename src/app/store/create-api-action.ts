import { Action, ActionCreator, createAction, props } from '@ngrx/store';

export type ApiActionCreator<TProps extends object> = ActionCreator<string, (props: TProps) => TProps & Action<string>>;

export interface IApiActionGroup<TRequest extends object, TSuccess extends object> {
    key: string;
    request: ApiActionCreator<TRequest>;
    success: ApiActionCreator<TSuccess>;
    // `status` carries the HTTP status when it is known, so callers can branch on 404/409/410.
    failure: ApiActionCreator<{ error: string; status?: number }>;
}

/*
 * NgRx guards props() with an internal NotAllowedCheck type that cannot be resolved against an
 * unbound generic, so the creator is built with a concrete props shape and narrowed once here.
 * Every call site stays strongly typed through IApiActionGroup.
 */
const createTypedAction = <TProps extends object>(type: string): ApiActionCreator<TProps> =>
    createAction(type, props<Record<string, unknown>>()) as unknown as ApiActionCreator<TProps>;

export const createApiAction = <TRequest extends object, TSuccess extends object>(
    source: string,
    name: string
): IApiActionGroup<TRequest, TSuccess> => ({
    key: `${source}:${name}`,
    request: createTypedAction<TRequest>(`[${source}] ${name}`),
    success: createTypedAction<TSuccess>(`[${source}] ${name} success`),
    failure: createTypedAction<{ error: string; status?: number }>(`[${source}] ${name} failure`)
});
