import { OAuth2Client } from 'google-auth-library';

// Thin, injectable wrapper so tests can fake Google verification without network access.
export const createGoogleVerifier = ({ clientId }) => {
    const client = new OAuth2Client(clientId);

    return {
        async verify(credential) {
            const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
            const payload = ticket.getPayload();
            if (payload === undefined) {
                throw new Error('Google token had no payload.');
            }

            return {
                sub: payload.sub,
                email: payload.email ?? '',
                emailVerified: payload.email_verified === true,
                name: typeof payload.name === 'string' ? payload.name : null
            };
        }
    };
};
