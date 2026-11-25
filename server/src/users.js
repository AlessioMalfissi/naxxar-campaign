import { randomUUID } from 'node:crypto';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const MAX_DISPLAY_NAME_LENGTH = 80;

export const normalizeEmail = (value) => (typeof value === 'string' ? value.trim().toLowerCase() : '');

export const isValidEmail = (value) => typeof value === 'string' && EMAIL_PATTERN.test(value.trim());

export const isValidDisplayName = (value) =>
    typeof value === 'string' && value.trim().length >= 1 && value.trim().length <= MAX_DISPLAY_NAME_LENGTH;

export const toPublicUser = (user) => ({
    id: user._id,
    email: user.email,
    displayName: user.displayName,
    // Omit the flag for normal accounts so existing auth payloads keep their shape.
    ...(user.isSuperAdmin === true ? { isSuperAdmin: true } : {})
});

export const findUserByEmail = (users, email) => users.findOne({ emailNormalized: normalizeEmail(email) });

export const findUserById = (users, id) => users.findOne({ _id: id });

export const createUser = async (
    users,
    { email, displayName, passwordHash = null, googleSub = null, now = new Date().toISOString() }
) => {
    const user = {
        _id: randomUUID(),
        email: email.trim(),
        emailNormalized: normalizeEmail(email),
        displayName: displayName.trim(),
        passwordHash,
        googleSub,
        createdAt: now,
        updatedAt: now
    };

    await users.insertOne(user);
    return user;
};

export const setGoogleSub = async (users, user, googleSub) => {
    const updated = { ...user, googleSub, updatedAt: new Date().toISOString() };
    await users.replaceOne({ _id: user._id }, updated);
    return updated;
};

export const setPasswordHash = async (users, user, passwordHash) => {
    const updated = { ...user, passwordHash, updatedAt: new Date().toISOString() };
    await users.replaceOne({ _id: user._id }, updated);
    return updated;
};
