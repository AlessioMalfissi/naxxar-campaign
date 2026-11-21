import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

// OWASP's recommended Argon2id parameters (19 MiB, 2 iterations, 1 lane).
export const ARGON2_OPTIONS = {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1
};

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export const hashPassword = (password) => argon2.hash(password, ARGON2_OPTIONS);

// A malformed or missing hash reads as "does not match" rather than throwing, so a corrupt row cannot
// turn a login attempt into a 500.
export const verifyPassword = async (hash, password) => {
    if (typeof hash !== 'string' || hash === '' || typeof password !== 'string') {
        return false;
    }

    try {
        return await argon2.verify(hash, password);
    } catch {
        return false;
    }
};

export const isValidPassword = (value) =>
    typeof value === 'string' && value.length >= MIN_PASSWORD_LENGTH && value.length <= MAX_PASSWORD_LENGTH;

export const createPasswordService = () => {
    // Hash a random value once so an unknown email costs the same as a real one. The plaintext is
    // discarded; only the hash is retained.
    const dummyHash = argon2.hash(randomBytes(24).toString('base64url'), ARGON2_OPTIONS);

    return {
        hash: hashPassword,
        verify: verifyPassword,
        verifyDummy: async () => {
            await argon2.verify(await dummyHash, 'not-the-dummy-password').catch(() => false);
            return false;
        },
        isValidPassword
    };
};
