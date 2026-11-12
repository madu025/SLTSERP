import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUserId } from '@/lib/request-context';

/** Everything sent while testing goes to this one mailbox, whoever the real recipient would have been. */
export const TEST_MAIL_RECIPIENT = process.env.EMAIL_TEST_RECIPIENT || 'prasad@slts.lk';

/** Accounts that exist only for testing: mail caused by their actions is test mail, even on production. */
export const TEST_ACCOUNT_PATTERN = /^(qa3b_|qa_|rbac_qa_|prod_smoke_|testadmin$)/i;

interface SmtpConfig {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
}

export class EmailService {
    private static async getSmtpConfig(): Promise<SmtpConfig | null> {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const setting = await (prisma as any).systemSetting.findUnique({
                where: { key: 'SMTP_CONFIG' }
            });

            if (setting && setting.value) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const config = setting.value as any;
                if (config.host && config.user && config.pass) {
                    return {
                        host: config.host,
                        port: parseInt(config.port || '587', 10),
                        user: config.user,
                        pass: config.pass,
                        from: config.from || '"SLTS Nexus ERP" <noreply@slt.lk>'
                    };
                }
            }
        } catch (error) {
            console.error('[EMAIL-SERVICE-ERROR] Failed to fetch SMTP config from DB:', error);
        }

        // Fallback to .env
        const host = process.env.SMTP_HOST;
        const port = parseInt(process.env.SMTP_PORT || '587', 10);
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASSWORD;
        const from = process.env.SMTP_FROM || '"SLTS Nexus ERP" <noreply@slt.lk>';

        if (!host || !user || !pass) {
            return null;
        }

        return { host, port, user, pass, from };
    }

    private static async getTransporter() {
        const config = await this.getSmtpConfig();
        if (!config) return { transporter: null, config: null };

        const transporter = nodemailer.createTransport({
            host: config.host,
            port: config.port,
            secure: config.port === 465,
            auth: {
                user: config.user,
                pass: config.pass
            },
            tls: {
                // Do not fail on invalid certs (useful for corporate proxies intercepting SSL)
                rejectUnauthorized: false
            }
        });

        return { transporter, config };
    }

    /** True when the action that caused this mail was performed by a test account (see TEST_ACCOUNT_PATTERN). */
    private static async isTestActor(): Promise<boolean> {
        try {
            const userId = getAuthenticatedUserId();
            if (!userId) return false;
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
            return !!user?.username && TEST_ACCOUNT_PATTERN.test(user.username);
        } catch {
            return false;
        }
    }

    /**
     * Send a production-ready transactional email.
     * TEST MAIL RULE: mail is redirected to TEST_MAIL_RECIPIENT (prasad@slts.lk) whenever it is test traffic, i.e. when
     *  - the server is not running in production (local/dev runs), or
     *  - EMAIL_REDIRECT_ALL_TO is set, or
     *  - the user whose action triggered it is a test account (QA/smoke accounts), even on the production server.
     * The subject names the address the mail would really have gone to.
     */
    static async sendMail(options: {
        to: string;
        subject: string;
        text: string;
        html?: string;
    }) {
        const originalTo = options.to;
        const isDev = process.env.NODE_ENV !== 'production';
        const isTestMail = isDev || !!process.env.EMAIL_REDIRECT_ALL_TO || await this.isTestActor();
        if (isTestMail && originalTo.trim().toLowerCase() !== TEST_MAIL_RECIPIENT.toLowerCase()) {
            options.to = TEST_MAIL_RECIPIENT;
            options.subject = `[TEST - for ${originalTo}] ${options.subject}`;
        }
        
        const { transporter, config } = await this.getTransporter();

        if (!transporter || !config) {
            console.warn(`[EMAIL-SERVICE-WARN] SMTP credentials are not configured. Logging email instead:
To: ${options.to} (original: ${originalTo})
Subject: ${options.subject}
Body: ${options.text}`);
            return null;
        }

        try {
            const sender = isTestMail ? '"SLTS QMS" <sltsqms@gmail.com>' : (config.from || '"SLTS Nexus ERP" <noreply@slt.lk>');
            const info = await transporter.sendMail({
                from: sender,
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html
            });
            console.log(`[EMAIL-SERVICE-SUCCESS] Email sent to ${options.to} (original: ${originalTo}): ${info.messageId}`);
            return info;
        } catch (error) {
            console.error(`[EMAIL-SERVICE-ERROR] Failed to send email to ${options.to} (original: ${originalTo}):`, error);
            throw error;
        }
    }
}
