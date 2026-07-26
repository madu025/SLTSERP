export interface SMSOptions {
    to: string;
    message: string;
    channel?: 'SMS' | 'WHATSAPP';
}

export class SMSService {
    /**
     * Send transactional SMS or WhatsApp message to Field Engineer/Contractor
     */
    static async send(options: SMSOptions): Promise<{ success: boolean; messageId: string }> {
        const { to, message, channel = 'SMS' } = options;

        const twilioSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_PHONE_NUMBER || '+18005550199';

        // 1. If Twilio credentials present, use real API
        if (twilioSid && twilioAuth) {
            try {
                const endpoint = channel === 'WHATSAPP'
                    ? `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`
                    : `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;

                const bodyData = new URLSearchParams({
                    To: channel === 'WHATSAPP' ? `whatsapp:${to}` : to,
                    From: channel === 'WHATSAPP' ? `whatsapp:${fromNumber}` : fromNumber,
                    Body: message
                });

                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Basic ' + Buffer.from(`${twilioSid}:${twilioAuth}`).toString('base64'),
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: bodyData.toString()
                });

                const data = await res.json();
                if (res.ok) {
                    console.log(`[SMS-SERVICE-SUCCESS] ${channel} sent to ${to}: ${data.sid}`);
                    return { success: true, messageId: data.sid };
                } else {
                    console.error(`[SMS-SERVICE-ERROR] ${channel} failed:`, data.message);
                }
            } catch (err) {
                console.error(`[SMS-SERVICE-CRASH] ${channel} request failed:`, err);
            }
        }

        // 2. Fallback Logger (Dev/Staging mode)
        const mockId = `mock-sms-${Date.now()}`;
        console.log(`[SMS-DEV-LOGGER] Channel: ${channel} | To: ${to} | Content: "${message}" (ID: ${mockId})`);
        return { success: true, messageId: mockId };
    }
}
