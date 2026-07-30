import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';

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

    /**
     * Send a production-ready transactional email
     */
    static async sendMail(options: {
        to: string;
        subject: string;
        text: string;
        html?: string;
    }) {
        const { transporter, config } = await this.getTransporter();

        if (!transporter || !config) {
            console.warn(`[EMAIL-SERVICE-WARN] SMTP credentials are not configured. Logging email instead:
To: ${options.to}
Subject: ${options.subject}
Body: ${options.text}`);
            return null;
        }

        try {
            const info = await transporter.sendMail({
                from: config.from,
                to: options.to,
                subject: options.subject,
                text: options.text,
                html: options.html
            });
            console.log(`[EMAIL-SERVICE-SUCCESS] Email sent successfully: ${info.messageId}`);
            return info;
        } catch (error) {
            console.error(`[EMAIL-SERVICE-ERROR] Failed to send email to ${options.to}:`, error);
            throw error;
        }
    }
}
