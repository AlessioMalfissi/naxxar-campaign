import nodemailer from 'nodemailer';

export const createMailer = ({ smtpUrl = null, mailFrom, nodeEnv = 'development' }) => {
    const transport = smtpUrl === null || smtpUrl === '' ? null : nodemailer.createTransport(smtpUrl);

    return {
        async sendPasswordReset({ to, resetUrl }) {
            if (transport === null) {
                if (nodeEnv === 'production') {
                    throw new Error('SMTP is not configured.');
                }

                console.info(`[dev] Password reset link for ${to}: ${resetUrl}`);
                return;
            }

            await transport.sendMail({
                from: mailFrom,
                to,
                subject: 'Reset your Naxxar password',
                text: `Someone asked to reset the Naxxar password for this address. Open the link below within an hour to choose a new one:\n\n${resetUrl}\n\nIf this was not you, you can ignore this message.`
            });
        }
    };
};
