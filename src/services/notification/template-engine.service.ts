import { prisma } from '@/lib/prisma';

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
     * Fetches template by code (e.g. SO_APPROVED) and compiles title and message with variables.
     */
    static async renderByCode(
        code: string, 
        variables: Record<string, string | number | boolean | undefined>
    ): Promise<{ title: string; message: string; channels: string[] } | null> {
        interface NotificationTemplateClient {
            notificationTemplate: {
                findUnique: (args: { where: { code: string } }) => Promise<{
                    id: string;
                    code: string;
                    title: string;
                    message: string;
                    channels: string[];
                } | null>;
            };
        }
        const template = await (prisma as unknown as NotificationTemplateClient).notificationTemplate.findUnique({
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
