import { prisma } from '@/lib/prisma';
import { SystemMonitoringService } from './system-monitoring.service';

export interface ThreatAdvisory {
    id: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
    title: string;
    description: string;
    source: string;
    timestamp: Date;
    suggestedAction: string;
}

export interface SOCSecurityReport {
    securityScore: number;
    status: 'OPTIMAL' | 'ELEVATED_RISK' | 'CRITICAL_THREAT';
    tamperedLedgersCount: number;
    unresolvedErrorsCount: number;
    failedAuthCount: number;
    unauthorizedAccessCount: number;
    advisories: ThreatAdvisory[];
    ledgerIntegrity: {
        totalAudited: number;
        validCount: number;
        tamperedCount: number;
    };
    recommendedSOARActions: Array<{
        id: string;
        type: 'BLOCK_IP' | 'REVOKE_SESSIONS' | 'LEDGER_REPAIR' | 'ALERT_ADMIN';
        label: string;
        target?: string;
        severity: 'HIGH' | 'CRITICAL';
    }>;
}

export class SOCAnalystService {
    /**
     * Conduct full automated SOC Security Analysis & SIEM Threat Detection
     */
    static async generateSecurityReport(): Promise<SOCSecurityReport> {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        // 1. Audit Cryptographic Inventory Ledger Integrity
        const ledgerAudit = await SystemMonitoringService.runLedgerSecurityAudit();
        const tamperedCount = ledgerAudit.tamperedCount;

        // 2. Query Recent Security Error Logs (24h)
        const recentErrors = await prisma.systemErrorLog.findMany({
            where: { createdAt: { gte: twentyFourHoursAgo } },
            select: { statusCode: true, path: true, ipAddress: true, userId: true, resolved: true, errorCode: true, createdAt: true }
        });

        const unresolvedErrorsCount = recentErrors.filter(e => !e.resolved).length;
        const failedAuthCount = recentErrors.filter(e => e.statusCode === 401 || e.errorCode === 'UNAUTHORIZED').length;
        const unauthorizedAccessCount = recentErrors.filter(e => e.statusCode === 403 || e.errorCode === 'FORBIDDEN').length;

        // 3. Compute Security Score (0 - 100)
        let score = 100;
        if (tamperedCount > 0) score -= tamperedCount * 25;
        if (unauthorizedAccessCount > 10) score -= 15;
        if (failedAuthCount > 20) score -= 10;
        if (unresolvedErrorsCount > 15) score -= 10;
        score = Math.max(0, Math.min(100, score));

        // 4. Determine Overall Security Status
        let status: 'OPTIMAL' | 'ELEVATED_RISK' | 'CRITICAL_THREAT' = 'OPTIMAL';
        if (score < 60 || tamperedCount > 0) {
            status = 'CRITICAL_THREAT';
        } else if (score < 85 || unauthorizedAccessCount > 5 || unresolvedErrorsCount > 10) {
            status = 'ELEVATED_RISK';
        }

        // 5. Generate Threat Advisories
        const advisories: ThreatAdvisory[] = [];

        if (tamperedCount > 0) {
            advisories.push({
                id: 'THREAT-LEDGER-01',
                severity: 'CRITICAL',
                title: 'SHA-256 Ledger Integrity Violation Detected',
                description: `${tamperedCount} inventory ledger records failed SHA-256 cryptographic verification. Possible database tampering.`,
                source: 'CryptoLedgerAuditEngine',
                timestamp: new Date(),
                suggestedAction: 'Isolate tampered rows and verify database commit logs immediately.'
            });
        }

        if (unauthorizedAccessCount > 5) {
            advisories.push({
                id: 'THREAT-RBAC-02',
                severity: 'HIGH',
                title: 'Unauthorized RBAC Privilege Probing Detected',
                description: `${unauthorizedAccessCount} 403 Forbidden attempts recorded in the last 24 hours across sensitive admin routes.`,
                source: 'SIEMAccessMonitor',
                timestamp: new Date(),
                suggestedAction: 'Review user role group permissions and check IP origin logs.'
            });
        }

        if (failedAuthCount > 15) {
            advisories.push({
                id: 'THREAT-AUTH-03',
                severity: 'MEDIUM',
                title: 'Elevated Authentication Failure Rate',
                description: `${failedAuthCount} 401 Unauthorized attempts detected. Possible brute-force attack window.`,
                source: 'AuthRateLimiter',
                timestamp: new Date(),
                suggestedAction: 'Enable temporary CAPTCHA or enforce IP rate-limit block.'
            });
        }

        if (unresolvedErrorsCount > 10) {
            advisories.push({
                id: 'THREAT-LOG-04',
                severity: 'LOW',
                title: 'Unresolved System Error Backlog',
                description: `${unresolvedErrorsCount} unhandled system error logs remain unresolved in the telemetry queue.`,
                source: 'TelemetryLogAnalyzer',
                timestamp: new Date(),
                suggestedAction: 'Mark resolved or clear non-critical operational telemetry exceptions.'
            });
        }

        // 6. SOAR Recommended Automated Actions
        const recommendedSOARActions: SOCSecurityReport['recommendedSOARActions'] = [];

        if (tamperedCount > 0) {
            recommendedSOARActions.push({
                id: 'SOAR-ACT-01',
                type: 'LEDGER_REPAIR',
                label: 'Run SHA-256 Ledger Forensic Audit',
                severity: 'CRITICAL'
            });
        }

        if (unauthorizedAccessCount > 10) {
            recommendedSOARActions.push({
                id: 'SOAR-ACT-02',
                type: 'ALERT_ADMIN',
                label: 'Dispatch High-Priority SOC Security Alert to Admins',
                severity: 'HIGH'
            });
        }

        return {
            securityScore: score,
            status,
            tamperedLedgersCount: tamperedCount,
            unresolvedErrorsCount,
            failedAuthCount,
            unauthorizedAccessCount,
            advisories,
            ledgerIntegrity: {
                totalAudited: ledgerAudit.totalVerified || 0,
                validCount: Math.max(0, (ledgerAudit.totalVerified || 0) - tamperedCount),
                tamperedCount
            },
            recommendedSOARActions
        };
    }
}
