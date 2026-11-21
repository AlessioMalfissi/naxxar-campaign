import { rateLimit } from 'express-rate-limit';

const passThrough = (req, res, next) => next();

// Single-instance, in-memory limits. Tests inject their own limiters so no suite has to sleep.
export const createRateLimiters = () => {
    const fifteenMinutes = 15 * 60 * 1000;

    return {
        login: rateLimit({
            windowMs: fifteenMinutes,
            limit: 10,
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            message: { error: 'Too many attempts. Try again later.' }
        }),
        googleLogin: rateLimit({
            windowMs: fifteenMinutes,
            limit: 10,
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            message: { error: 'Too many attempts. Try again later.' }
        }),
        passwordReset: rateLimit({
            windowMs: fifteenMinutes,
            limit: 5,
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            message: { error: 'Too many attempts. Try again later.' }
        }),
        invite: rateLimit({
            windowMs: fifteenMinutes,
            limit: 20,
            standardHeaders: 'draft-7',
            legacyHeaders: false,
            message: { error: 'Too many attempts. Try again later.' }
        })
    };
};

export const passThroughRateLimiters = {
    login: passThrough,
    googleLogin: passThrough,
    passwordReset: passThrough,
    invite: passThrough
};
