import nodemailer from 'nodemailer';

export class EmailService {
    private static getTransporter() {
        const host = process.env.SMTP_HOST;
        const port = parseInt(process.env.SMTP_PORT || '587', 10);
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASSWORD;

        if (!host || !user || !pass) {
            return null;
        }

        return nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: {
                user,
                pass
            }
        });
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
        const from = process.env.SMTP_FROM || '"SLTS Nexus ERP" <noreply@slt.lk>';
        const transporter = this.getTransporter();

        if (!transporter) {
            console.warn(`[EMAIL-SERVICE-WARN] SMTP credentials are not configured. Logging email instead:
To: ${options.to}
Subject: ${options.subject}
Body: ${options.text}`);
            return null;
        }

        try {
            const info = await transporter.sendMail({
                from,
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
