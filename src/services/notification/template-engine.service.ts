import { prisma } from '@/lib/prisma';

interface RenderedEmailTemplate {
    subject: string;
    html: string;
    text: string;
}

export class NotificationTemplateEngineService {
    /**
     * Renders a dynamic title and message template substituting placeholders like {{orderNo}}, {{user}}, {{amount}}.
     */
    static renderTemplate(
        templateStr: string, 
        variables: Record<string, string | number | boolean | undefined>
    ): string {
        if (!templateStr) return '';
        return templateStr.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
            const val = variables[key];
            return val !== undefined && val !== null ? String(val) : match;
        });
    }

    /**
     * Fetches template by code and renders subject + HTML body for email dispatch.
     * Returns null if template not found or inactive.
     */
    static async renderEmailByCode(
        code: string,
        variables: Record<string, string | number | boolean | undefined>
    ): Promise<RenderedEmailTemplate | null> {
        const template = await prisma.notificationTemplate.findUnique({
            where: { code, isActive: true }
        });

        if (!template) return null;

        const subject = this.renderTemplate(template.subject || template.title, variables);
        const html = this.renderTemplate(template.htmlBody || template.message, variables);
        const text = this.renderTemplate(template.message, variables);

        return { subject, html, text };
    }

    /**
     * Fetches template by code and compiles title and message with variables.
     */
    static async renderByCode(
        code: string, 
        variables: Record<string, string | number | boolean | undefined>
    ): Promise<{ title: string; message: string; channels: string[] } | null> {
        const template = await prisma.notificationTemplate.findUnique({
            where: { code }
        });

        if (!template) return null;

        return {
            title: this.renderTemplate(template.title, variables),
            message: this.renderTemplate(template.message, variables),
            channels: template.channels || ['IN_APP']
        };
    }
}
