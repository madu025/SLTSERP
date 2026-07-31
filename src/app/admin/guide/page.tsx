"use client";

import React, { useState, useMemo } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import RoleGuard from '@/components/RoleGuard';
import { ROLE_GROUPS } from '@/config/roles';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Users,
    HardHat,
    Shield,
    RefreshCw,
    Receipt,
    Settings,
    Search,
    HelpCircle,
    Printer,
    ExternalLink,
    CheckCircle2,
    AlertTriangle,
    Mail,
    Layers,
    Sparkles,
    Wrench,
    Warehouse,
    ChevronRight,
    Check
} from "lucide-react";
import Link from 'next/link';

interface Step {
    num: number;
    title: string;
    description: string;
}

interface QAItem {
    id: string;
    category: string;
    categoryLabel: string;
    categoryColor: string;
    questionSi: string;
    questionEn: string;
    summary: string;
    steps: Step[];
    outcomes: string[];
    importantNote?: string;
    codeSnippet?: string;
    tags: string[];
    actionRoute?: string;
    actionLabel?: string;
}

export default function AdminGuidePage() {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [selectedTrouble, setSelectedTrouble] = useState<string | null>(null);

    // Deep Comprehensive Q&A Dataset with Step-by-Step Instructions & System Outcomes
    const qaDatabase: QAItem[] = useMemo(() => [
        // CATEGORY 1: FSM & Process Gates Engine
        {
            id: 'qa-1',
            category: 'process-gates',
            categoryLabel: 'Workflow & Process Gates',
            categoryColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
            questionSi: 'SLTSERP හි Zero-Hardcoding FSM Workflow Engine එක ක්‍රියාත්මක වන්නේ කෙසේද?',
            questionEn: 'How does the Zero-Hardcoding FSM Workflow Engine operate across SLTSERP?',
            summary: 'පද්ධතියේ Workflow Transitions සියල්ල Code එකේ if/else මගින් නොව Database එකෙහි ProcessGatePolicy table එක මගින් Zero-Hardcoding ක්‍රමවේදයට පාලනය වේ.',
            steps: [
                { num: 1, title: 'Request Submission', description: 'පරිශීලකයා Material Request, Service Order, හෝ Invoice එකක් Submit කරයි.' },
                { num: 2, title: 'Dynamic Policy Fetch', description: 'FSM Engine එක මගින් ProcessGatePolicy table එකෙන් අදාළ Entity Type සහ Current Stage එකට ගැළපෙන Active Gate Policy එක DB එකෙන් කියවයි.' },
                { num: 3, title: 'Rules Engine Evaluation', description: 'JSON Condition Criteria (උදා: amount >= 500,000) පරීක්ෂා කර අදාළ Approval Path එක තීරණය කරයි.' },
                { num: 4, title: 'Sequential Approval Execution', description: 'Level 1, Level 2, Level 3 ලෙස නියමිත නිලධාරීන්ගෙන් අනුමැතිය (Approvals) ලබාගනී.' },
                { num: 5, title: 'Atomic Domain Action Dispatch', description: 'අවසාන අනුමැතිය ලැබුණු පසු prisma.$transaction() එකක් ඇතුළත Stock Deduction හෝ GL Entry එක Atomic ලෙස සිදු කෙරේ.' }
            ],
            outcomes: [
                'System Re-deploy කිරීමකින් තොරව UI එකෙන්ම Approvals වෙනස් කිරීමේ හැකියාව ලැබීම.',
                'Domain Action එකක් fail වුවහොත් Saga Rollback මගින් FSM State එක ස්වයංක්‍රීයව පස්සට යාම.',
                'සෑම Transition එකක්ම SHA-256 Audit Trail එකක සටහන් වීම.'
            ],
            codeSnippet: `{ "field": "totalValue", "operator": ">=", "value": 500000 }`,
            importantNote: 'Code එක වෙනස් නොකර UI එකෙන් පමණක් Approval Rules වෙනස් කිරීමට Process Gates Engine (/admin/settings/process-gates) භාවිතා කරන්න.',
            tags: ['fsm', 'workflow', 'process gates', 'zero hardcoding', 'policy', 'engine'],
            actionRoute: '/admin/settings/process-gates',
            actionLabel: 'Process Gates UI විවෘත කරන්න'
        },
        {
            id: 'qa-2',
            category: 'process-gates',
            categoryLabel: 'Workflow & Process Gates',
            categoryColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
            questionSi: 'Multi-Level Approvals (Level 1, Level 2, Level 3) සකස් කරන්නේ කෙසේද?',
            questionEn: 'How to configure multi-stage approvals (Level 1, 2, 3) for requests?',
            summary: 'අදියර කිහිපයකින් (Multi-level) සිදු වන අනුමැතීන් Process Gates Admin UI එකෙන් පියවරෙන් පියවර සකසන ආකාරය.',
            steps: [
                { num: 1, title: 'Process Gates UI එකට පිවිසීම', description: '/admin/settings/process-gates පිටුවට යන්න.' },
                { num: 2, title: 'Entity Type තේරීම', description: 'MATERIAL_REQUEST, SERVICE_ORDER, හෝ INVOICE එක තෝරන්න.' },
                { num: 3, title: 'Transition Gate තේරීම', description: 'Visual Tree View එකේ සංස්කරණය කළ යුතු Gate එක මත Click කර Edit Policy drawer එක ගන්න.' },
                { num: 4, title: 'Approval Roles / Users පැවරීම', description: 'Level 1: OSP_MANAGER, Level 2: STORES_MANAGER, Level 3: FINANCE_MANAGER ලෙස තෝරන්න.' },
                { num: 5, title: 'Multi-Approval Modality සැකසීම', description: 'සියලු දෙනාගේම අනුමැතිය අවශ්‍ය නම් requireAll: true ලෙසත්, එක් අයෙකුගේ අනුමැතිය ප්‍රමාණවත් නම් requireAll: false ලෙසත් තෝරන්න.' },
                { num: 6, title: 'Policy එක සුරැකීම', description: 'Save Policy බටන් එක ඔබා Configuration එක Database එකට Save කරන්න.' }
            ],
            outcomes: [
                'Request එකක් සබ්මිට් කළ විට එය පළමුව Level 1 Approver වෙත පමණක් යොමු වීම.',
                'Level 1 අනුමත වූ පසු ස්වයංක්‍රීයව Level 2 Approver ගේ Queue එකට මාරු වීම.',
                'සියලු අදියර අවසන් වන තෙක් Status එක PENDING_APPROVAL ලෙස පවතිමින් අවසානයේ APPROVED වීම.'
            ],
            importantNote: 'නිශ්චිත පරිශීලකයෙකුට පමණක් අනුමැතිය දීමට specificUserId Option එක භාවිත කළ හැක.',
            tags: ['approval levels', 'multi level', 'level 1', 'level 2', 'level 3', 'roles'],
            actionRoute: '/admin/settings/process-gates',
            actionLabel: 'Gate Policies කළමනාකරණය'
        },
        {
            id: 'qa-3',
            category: 'process-gates',
            categoryLabel: 'Workflow & Process Gates',
            categoryColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
            questionSi: 'Rules Engine එක මගින් වටිනාකම (Monetary Thresholds) අනුව Approvals වෙනස් කරන්නේ කෙසේද?',
            questionEn: 'How to route approvals based on monetary thresholds using the Rules Engine?',
            summary: 'මුදල් වටිනාකම අනුව (උදා: ලක්ෂ 5 ට වැඩි / අඩු) වෙනස් අනුමැති පාරවල් (Routing Paths) සකසන පියවර.',
            steps: [
                { num: 1, title: 'Process Gate Policy එක open කිරීම', description: '/admin/settings/process-gates වෙත ගොස් අදාළ Gate එක Edit කරන්න.' },
                { num: 2, title: 'Condition Rules Toggle සක්‍රීය කිරීම', description: 'Enable Rules Engine Toggle එක ON කරන්න.' },
                { num: 3, title: 'JSON Criteria සකස් කිරීම', description: '{"field": "totalValue", "operator": ">=", "value": 500000} ලෙස JSON Rule එක ඇතුළත් කරන්න.' },
                { num: 4, title: 'High-Level & Low-Level Paths වෙන් කිරීම', description: 'Condition එක TRUE වුවහොත් යන Path එකත්, FALSE වුවහොත් යන Fast-Track Path එකත් තෝරන්න.' },
                { num: 5, title: 'Save කර Test කිරීම', description: 'Policy එක Save කර අගයන් මාරු කරමින් Material Request එකක් සබ්මිට් කර පරීක්ෂා කරන්න.' }
            ],
            outcomes: [
                'රු. 500,000 ට අඩු Requests සරල 1-Step Approval එකකින් ඉක්මනින් පාස් වීම.',
                'රු. 500,000 ට වැඩි Requests සුවිශේෂී High-Level Governance Gate එකක් වෙත රවුට් වීම.',
                'මූල්‍ය අවදානම් පාලනය වීම සහ අනවශ්‍ය ප්‍රමාදයන් වැළකීම.'
            ],
            codeSnippet: `{
  "field": "totalValue",
  "operator": ">=",
  "value": 500000,
  "truePath": "GATE_GOVERNANCE_BOARD",
  "falsePath": "GATE_FAST_TRACK"
}`,
            tags: ['rules engine', 'condition', 'threshold', 'json rule', 'amount'],
            actionRoute: '/admin/settings/process-gates',
            actionLabel: 'Rules Engine පරීක්ෂා කරන්න'
        },
        {
            id: 'qa-4',
            category: 'process-gates',
            categoryLabel: 'Workflow & Process Gates',
            categoryColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
            questionSi: 'Standard Industrial Presets (SAP/Oracle Chains) එක ක්ලික් එකෙන් Load කරන්නේ කෙසේද?',
            questionEn: 'How to apply 1-click standard SAP/Oracle industrial workflow presets?',
            summary: 'සංකීර්ණ Workflow Chains තනි තනිව නොහදා Enterprise Presets මගින් ක්ෂණිකව සකසන ආකාරය.',
            steps: [
                { num: 1, title: 'Process Gates Management විවෘත කිරීම', description: '/admin/settings/process-gates පිටුවට යන්න.' },
                { num: 2, title: 'Load Presets ਬටන් එක ක්ලික් කිරීම', description: 'ඉහළින් ඇති "Load Industrial Presets" බටන් එක ඔබන්න.' },
                { num: 3, title: 'Preset Template එක තේරීම', description: '"Standard SAP Telecom 4-Tier Approval" හෝ "Fast-Track Field Ops" තෝරන්න.' },
                { num: 4, title: 'Confirmation එක ලබාදීම', description: 'පවතින Policies Overwrite කිරීමට එකඟතාව පළ කර Confirm කරන්න.' }
            ],
            outcomes: [
                'තත්පර කිහිපයක් ඇතුළත සමස්ත ERP පද්ධතියටම Standard Enterprise Approval Logic ලැබීම.',
                'අතින් සිදුවන වැරදි (Human Setup Errors) 100% ක් වැළකීම.'
            ],
            tags: ['presets', 'sap', 'oracle', 'industrial preset', 'workflow chain'],
            actionRoute: '/admin/settings/process-gates',
            actionLabel: 'Industrial Presets Load කරන්න'
        },
        {
            id: 'qa-4-upgrade',
            category: 'process-gates',
            categoryLabel: 'Workflow & Process Gates',
            categoryColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
            questionSi: 'Process Gate Policy වල Latest Upgrade එකක් කරන විට පවතින Architectural Gaps මොනවාද?',
            questionEn: 'What architectural gaps exist in current Process Gate Policies for next-gen upgrading?',
            summary: 'SAP/Oracle/ServiceNow තත්ත්වයේ Next-Gen Process Gate Engine එකක් සඳහා පවතින ප්‍රධාන Gaps 8 සහ ඒවා නිරාකරණය කරන ආකාරය.',
            steps: [
                { num: 1, title: 'Multi-Level Chain Linkage Gap', description: 'UniversalApprovalInstance හි policyId & levelIndex ලින්ක් කර නොමැති වීම නිසා Level 1 අවසන් වූ පසු Level 2 නොයෑමේ අවදානම.' },
                { num: 2, title: 'Rejection Workflow Gap', description: 'Rejection එකකදී Permanent Cancel වෙනවාද නැත්නම් Rework සඳහා ආපසු Maker ට යවනවාද (Rework Loop) යන්න තේරීමට නොහැකි වීම.' },
                { num: 3, title: 'ServiceOrder & Invoice SoD Gap', description: 'SoD Check එක Material Requests වලට පමණක් සීමා වී තිබීම (SOD සහ Invoice සඳහා createdById Mapping එක එකතු කිරීම).' },
                { num: 4, title: 'SLA Timeout & Auto-Escalation Gap', description: 'Approver පැය 24ක් ප්‍රමාද කළහොත් ඉබේම Supervisor (reportsToId) වෙත Escalate වීමේ Cron Job එක.' },
                { num: 5, title: 'Visual Testing Simulator Sandbox', description: 'Admin හට Actual Record නොසාදා JSON sample එකක් දී Policy එක Select වෙන හැටි Test කිරීමට Visual Sandbox එකක් නැතිකම.' }
            ],
            outcomes: [
                'Process Gate Engine එක Global Enterprise Tier (SAP/Oracle Level) 100% Reliability එකට ළඟා වීම.',
                'Approvals ප්‍රමාදයන් බිංදුවට බැසීම සහ SoD Fraud 100% වැළකීම.'
            ],
            importantNote: 'මෙම Gaps නිරාකරණය කිරීමෙන් Process Gate Engine එක enterprise-wide universal workflow system එකක් බවට පත්වේ.',
            tags: ['process gate gaps', 'upgrade gaps', 'fsm architectural gaps', 'sod', 'sla timeout'],
            actionRoute: '/admin/settings/process-gates',
            actionLabel: 'Process Gates Engine Inspect කරන්න'
        },

        // CATEGORY 2: Users, Roles & Access Control
        {
            id: 'qa-5',
            category: 'users-roles',
            categoryLabel: 'User & Access Control',
            categoryColor: 'bg-blue-100 text-blue-800 border-blue-200',
            questionSi: 'අලුත් පරිශීලකයෙකු එකතු කර Accessible OPMCs සකස් කරන්නේ කෙසේද?',
            questionEn: 'How to register new users and restrict them to Accessible OPMC boundaries?',
            summary: 'නවතම User Account එකක් සාදා ඔහුට අදාළ OPMC/RTOM ප්‍රදේශවල බෞද්ධික සීමාවන් (Regional Boundaries) පනවන පියවර.',
            steps: [
                { num: 1, title: 'User Management වෙත පිවිසීම', description: '/admin/users පිටුවට යන්න.' },
                { num: 2, title: 'Add New User ක්ලික් කිරීම', description: 'ඉහළ දකුණු කෙළවරේ ඇති "Add New User" බටන් එක ඔබන්න.' },
                { num: 3, title: 'මූලික තොරතුරු ඇතුළත් කිරීම', description: 'Full Name, Email, Password, Mobile Phone Number සහ Job Title ඇතුළත් කරන්න.' },
                { num: 4, title: 'Primary Role එක තේරීම', description: 'SUPER_ADMIN, OSP_MANAGER, STORES_MANAGER, ENGINEER, හෝ FINANCE_MANAGER එකක් තෝරන්න.' },
                { num: 5, title: 'Accessible OPMCs පැවරීම', description: 'Accessible OPMCs ලැයිස්තුවෙන් පරිශීලකයාට අදාළ OPMCs (උදා: OPMC Colombo South, OPMC Gampaha) තෝරා tick කරන්න.' },
                { num: 6, title: 'Account එක Create කිරීම', description: 'Save User බටන් එක ඔබා පරිශීලක ගිණුම සක්‍රීය කරන්න.' }
            ],
            outcomes: [
                'පරිශීලකයාට SLTSERP වෙත ප්‍රවේශ වීමට Login Credentials ලැබීම.',
                'පරිශීලකයා Log වූ පසු ඔහුට දර්ශනය වන්නේ තමන්ට Assign කළ OPMCs වල Service Orders, SODs සහ Stores පමණක් වීම (Data Isolation).',
                'වෙනත් OPMC වල Data වෙනස් කිරීමට හෝ බැලීමට නොහැකි වන සේ Regional Lock එක ක්‍රියාත්මක වීම.'
            ],
            importantNote: 'පරිශීලකයා OSP Manager කෙනෙකු නම් Accessible OPMCs අවම වශයෙන් එකක්වත් තේරීම අනිවාර්ය වේ.',
            tags: ['users', 'add user', 'opmc boundary', 'accessible opmc', 'rtom'],
            actionRoute: '/admin/users',
            actionLabel: 'User Management වෙත යන්න'
        },
        {
            id: 'qa-6',
            category: 'users-roles',
            categoryLabel: 'User & Access Control',
            categoryColor: 'bg-blue-100 text-blue-800 border-blue-200',
            questionSi: 'Segregation of Duties (SoD) / Maker-Checker Rule එක පද්ධතිය ක්‍රියාත්මක කරන්නේ කෙසේද?',
            questionEn: 'How does Segregation of Duties (SoD) prevent self-approval frauds?',
            summary: 'Request එකක් සෑදූ තැනැත්තාට (Maker) එය තමන් විසින්ම Approve කිරීමට (Checker) නොදී පද්ධතිය වළක්වන ආකාරය.',
            steps: [
                { num: 1, title: 'Request එක නිර්මාණය (Maker)', description: 'User A විසින් Material Request එකක් සෑදූ විට DB එකේ creatorId = UserA.id ලෙස සටහන් වේ.' },
                { num: 2, title: 'Self-Approval උත්සාහ කිරීම', description: 'User A විසින්ම එම Request එක Approve කිරීමට "Approve" බටන් එක ඔබයි.' },
                { num: 3, title: 'Process Gate SoD Check එක', description: 'Engine එක මගින් creatorId === currentUserId ද යන්න පරීක්ෂා කරයි.' },
                { num: 4, title: 'Action Blocking & Violation Logging', description: 'ක්‍රියාව block කර SEGREGATION_OF_DUTIES_VIOLATION Error එක පෙන්වන අතර System Audit Log එකේ attempt එක සටහන් වේ.' },
                { num: 5, title: 'Valid Checker Approval', description: 'වෙනත් බලයලත් User B කෙනෙකු ලොග් වී Approve කළ විට පමණක් Request එක APPROVED වේ.' }
            ],
            outcomes: [
                'ස්වයං අනුමැති (Self-Approval) මගින් සිදුවිය හැකි මූල්‍ය හා ද්‍රව්‍යමය වංචා 100% ක් වැළකීම.',
                'සෑම අනුමැතියකටම දෙදෙනෙකුගේ (Maker & Checker) වගවීම තහවුරු වීම.'
            ],
            importantNote: 'Super Admin වරයෙකුට වුවද SoD Rule එක bypass කළ නොහැක.',
            tags: ['sod', 'maker checker', 'self approval', 'security', 'violation'],
            actionRoute: '/admin/audit-logs',
            actionLabel: 'Audit Logs පරීක්ෂා කරන්න'
        },
        {
            id: 'qa-7',
            category: 'users-roles',
            categoryLabel: 'User & Access Control',
            categoryColor: 'bg-blue-100 text-blue-800 border-blue-200',
            questionSi: 'නිලධාරියෙකු නිවාඩු ගිය විට Out-of-Office (OOO) Auto Delegation සකසන්නේ කෙසේද?',
            questionEn: 'How to configure Out-of-Office (OOO) auto-delegation for approvals?',
            summary: 'නිලධාරියෙකු නිවාඩු ලබා සිටින විට ඔහු වෙත එන Approvals වැඩබලන නිලධාරියා වෙත ස්වයංක්‍රීයව යොමු කරන ආකාරය.',
            steps: [
                { num: 1, title: 'User Management වෙත යාම', description: '/admin/users වෙත ගොස් නිවාඩු යන නිලධාරියා Search කරන්න.' },
                { num: 2, title: 'Edit User Profile', description: 'පරිශීලකයාගේ Edit Profile Drawer එක විවෘත කරන්න.' },
                { num: 3, title: 'Is OOO Toggle එක ON කිරීම', description: 'Out of Office (isOOO) Toggle එක ACTIVE කරන්න.' },
                { num: 4, title: 'Delegated User තේරීම', description: 'Delegated Approver ලෙස වැඩබලන අනෙක් නිලධාරියා (delegatedUserId) තෝරන්න.' },
                { num: 5, title: 'Save කිරීම', description: 'Profile එක Save කරන්න.' }
            ],
            outcomes: [
                'නිවාඩු ගිය නිලධාරියා වෙත එන සියලුම Approval Task Notifications ස්වයංක්‍රීයව වැඩබලන නිලධාරියාගේ Queue එකට වැටීම.',
                'ව්‍යාපෘති හෝ ද්‍රව්‍ය නිකුත් කිරීම් නිවාඩු නිසා රඳවා තබා ගැනීම වැළකීම.',
                'නිවාඩුවෙන් පසු isOOO = false කළ සැනින් බලතල නැවත මුල් නිලධාරියාට ලැබීම.'
            ],
            tags: ['ooo', 'out of office', 'delegation', 'delegated user', 'leave'],
            actionRoute: '/admin/users',
            actionLabel: 'User Profile සංස්කරණය'
        },

        // CATEGORY 3: Stores & OPMC Hierarchy
        {
            id: 'qa-8',
            category: 'stores-opmcs',
            categoryLabel: 'Stores & OPMC Hierarchy',
            categoryColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            questionSi: 'නව RTOM / OPMC එකක් සාදා Stores Link කරන්නේ කෙසේද?',
            questionEn: 'How to setup new RTOM regions and connect Main/Sub Stores?',
            summary: 'නව ටෙලිකොම් මෙහෙයුම් කලාපයක් (OPMC/RTOM) ERP එකට ඇතුළත් කර ගබඩා සම්බන්ධ කරන ආකාරය.',
            steps: [
                { num: 1, title: 'OPMC Directory එකට යාම', description: '/projects/opmcs පිටුවට යන්න.' },
                { num: 2, title: 'Add OPMC ක්ලික් කිරීම', description: 'OPMC Code එක (උදා: OPMC-KURUNEGALA), Region Name, Address ඇතුළත් කර Save කරන්න.' },
                { num: 3, title: 'Store Management වෙත යාම', description: '/inventory/stores පිටුවට යන්න.' },
                { num: 4, title: 'Main Store & Sub Stores නිර්මාණය', description: 'අලුත් Store එකක් සාදා එහි Linked OPMC ලෙස OPMC-KURUNEGALA තෝරන්න.' },
                { num: 5, title: 'Store Keepers Assign කිරීම', description: 'Store Keeper ලැයිස්තුවට අදාළ නිලධාරීන් එකතු කර Save කරන්න.' }
            ],
            outcomes: [
                'කුරුණෑගල කලාපය සඳහා වෙන් වූ ද්‍රව්‍ය ගබඩා පද්ධතියක් ERP එක තුළ සක්‍රීය වීම.',
                'එම OPMC එකට අදාළ Material Stock Reports සහ Audit Cardex සූදානම් වීම.'
            ],
            tags: ['opmc', 'rtom', 'stores', 'main store', 'sub store', 'hierarchy'],
            actionRoute: '/projects/opmcs',
            actionLabel: 'RTOM Setup වෙත යන්න'
        },
        {
            id: 'qa-9',
            category: 'stores-opmcs',
            categoryLabel: 'Stores & OPMC Hierarchy',
            categoryColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            questionSi: 'Material Issue Note (MIN) සහ SHA-256 Inventory Ledger ක්‍රියා කරන්නේ කෙසේද?',
            questionEn: 'How does Material Issue Note (MIN) tracking and Immutable Inventory Ledger work?',
            tags: ['min', 'material issue note', 'inventory ledger', 'sha256', 'custody'],
            summary: 'ගබඩාවකින් බඩු නිකුත් කිරීමේදී MIN Reference එකක් සැදීම සහ වෙනස් කළ නොහැකි SHA-256 Ledger එකක් ලිවීමේ පියවර.',
            steps: [
                { num: 1, title: 'Material Issue Request එක open කිරීම', description: 'Store Keeper විසින් අනුමත වූ Material Request එකට අදාළව Stock Issue UI එක ගන්නවා.' },
                { num: 2, title: 'MIN Reference Generation', description: 'පද්ධතිය මගින් අද්විතීය අංකයක් (උදා: MIN-2026-07-0012) ස්වයංක්‍රීයව Generator කරයි.' },
                { num: 3, title: 'Stock Deduction in Transaction', description: 'Main Store Stock එකෙන් නිකුත් කළ ප්‍රමාණය අඩු කරයි.' },
                { num: 4, title: 'SHA-256 Ledger Entry Writing', description: 'InventoryLedger Table එකට Hash = SHA256(id + storeId + itemId + qtyAfter + timestamp) ලෙස Immutable record එකක් ලියයි.' },
                { num: 5, title: 'MIN Slip Printing', description: 'භෞතිකව අත්සන් කිරීමට හෝ Contractor Mobile App එකට Custody Transfer පණිවිඩය යවයි.' }
            ],
            outcomes: [
                'ද්‍රව්‍ය හිමිකාරිත්වය (Custody) ගබඩාවෙන් කොන්ත්‍රාත්කරුට මාරු වීම.',
                'SHA-256 Cryptographic Hash එක නිසා පසුකාලීනව Database එකට කෙළින්ම ලොග් වී දත්ත වෙනස් කළද Ledger Mismatch අසුවීම (Audit Fraud Protection).'
            ],
            actionRoute: '/inventory/issues',
            actionLabel: 'Stock Issue Log බලන්න'
        },

        // CATEGORY 4: Contractors & Rate Matrix
        {
            id: 'qa-10',
            category: 'contractors',
            categoryLabel: 'Contractors & Rate Matrix',
            categoryColor: 'bg-amber-100 text-amber-800 border-amber-200',
            questionSi: 'නව Contractor කෙනෙකු ලියාපදිංචි කර Rate Card සකසන්නේ කෙසේද?',
            questionEn: 'How to register new contractors and define work unit labor rates?',
            summary: 'පිටස්තර කොන්ත්‍රාත්කාර සමාගමක් ලියාපදිංචි කර ඔවුන්ට ගෙවන වැඩ අනුපාත (Rate Matrix) සැකසීම.',
            steps: [
                { num: 1, title: 'Contractor Directory එකට යාම', description: '/contractors/management වෙත ගොස් Register Contractor ක්ලික් කරන්න.' },
                { num: 2, title: 'සමාගම් විස්තර ඇතුළත් කිරීම', description: 'Company Name, Reg No, Bank Name, Account Number, Mobile, Email ඇතුළත් කරන්න.' },
                { num: 3, title: 'Assigned OPMCs තේරීම', description: 'මෙම කොන්ත්‍රාත්කරු වැඩ කරන OPMC Regions තෝරන්න.' },
                { num: 4, title: 'Rate Matrix Config එකට යාම', description: '/finance/rate-matrix පිටුවට යන්න.' },
                { num: 5, title: 'Labor Rates සැකසීම', description: 'Fiber Splicing (Per Joint = Rs. 1500), Cable Pole Drawing (Per Meter = Rs. 85) වැනි ගෙවීම් අනුපාත සකසා Save කරන්න.' }
            ],
            outcomes: [
                'කොන්ත්‍රාත්කරු ERP එක තුළ සක්‍රීය වීම.',
                'Service Orders නිම කළ පසු Contractor Claims ස්වයංක්‍රීයව මෙම Dynamic Rate Card එකෙන් පමණක් တွက်ချက် වීම.'
            ],
            tags: ['contractor', 'rate card', 'labor rate', 'pricing', 'rate matrix'],
            actionRoute: '/contractors/management',
            actionLabel: 'Contractor Directory'
        },
        {
            id: 'qa-11',
            category: 'contractors',
            categoryLabel: 'Contractors & Rate Matrix',
            categoryColor: 'bg-amber-100 text-amber-800 border-amber-200',
            questionSi: 'Contractor Mobile Portal Access සීමා කරන්නේ කෙසේද?',
            questionEn: 'How to configure isolated Contractor Mobile Field Portal accounts?',
            summary: 'කොන්ත්‍රාත්කරුවන්ට ERP එකේ අභ්‍යන්තර දත්ත නොපෙනෙන සේ Mobile Field Portal එක පමණක් ලබාදීම.',
            steps: [
                { num: 1, title: 'User Management වෙත යාම', description: '/admin/users වෙත ගොස් Add User ක්ලික් කරන්න.' },
                { num: 2, title: 'Contractor Role එක තේරීම', description: 'Role එක ලෙස CONTRACTOR_SUPERVISOR හෝ CONTRACTOR_TECHNICIAN තෝරන්න.' },
                { num: 3, title: 'Contractor Entity Link කිරීම', description: 'Contractor Company drop-down එකෙන් අදාළ කොන්ත්‍රාත් සමාගම තෝරා Save කරන්න.' }
            ],
            outcomes: [
                'කොන්ත්‍රාත්කරු Login වූ විට SLTSERP Internal Dashboard වැසී, සීමිත Contractor Field Portal (In-Hand Stock, Field SODs, Claims) පමණක් දර්ශනය වීම.',
                'ආයතනික දත්ත ආරක්ෂාව (Strict Data Isolation) තහවුරු වීම.'
            ],
            tags: ['contractor portal', 'field app', 'role isolation', 'technician'],
            actionRoute: '/admin/users',
            actionLabel: 'User Roles බලන්න'
        },

        // CATEGORY 5: Revenue & Billing Audit
        {
            id: 'qa-12',
            category: 'revenue-audit',
            categoryLabel: 'Revenue & Billing Audit',
            categoryColor: 'bg-teal-100 text-teal-800 border-teal-200',
            questionSi: 'Service Order (SOD) Base Revenue Prices සකසන්නේ කෙසේද?',
            questionEn: 'How to configure Service Order (SOD) Revenue Types and Base Prices?',
            summary: 'සෑම SOD အမျိုးအစားයක් (FTTH, Copper, Megoline) සඳහාම SLT එකෙන් ලැබෙන ආදායම හා Contractor share එක සැකසීම.',
            steps: [
                { num: 1, title: 'SOD Revenue Config එකට යාම', description: '/finance/sod-revenue පිටුවට යන්න.' },
                { num: 2, title: 'SOD Item Type තේරීම', description: 'FTTH_NEW_CONN, COPPER_REPAIR, හෝ MEGOLINE_INSTALL තෝරන්න.' },
                { num: 3, title: 'SLT Revenue Base Price ඇතුළත් කිරීම', description: 'SLT එකෙන් ලැබෙන සම්පූර්ණ අගය (උදා: රු. 18,500) ඇතුළත් කරන්න.' },
                { num: 4, title: 'Contractor Payout Share සැකසීම', description: 'කොන්ත්‍රාත්කරුට හිමි කොටස (උදා: රු. 6,500) ඇතුළත් කර Save කරන්න.' }
            ],
            outcomes: [
                'Service Order එක Completed වූ සැනින් Unbilled WIP Receivables ගිණුමට ආදායම සටහන් වීම.',
                'මූල්‍ය වාර්තා (P&L, Financial Dashboards) වල නිවැරදි Profit Margin එක တွက်ချက် වීම.'
            ],
            tags: ['sod revenue', 'base price', 'billing rates', 'revenue config'],
            actionRoute: '/finance/sod-revenue',
            actionLabel: 'SOD Revenue Config'
        },
        {
            id: 'qa-13',
            category: 'revenue-audit',
            categoryLabel: 'Revenue & Billing Audit',
            categoryColor: 'bg-teal-100 text-teal-800 border-teal-200',
            questionSi: 'SF Audit Division මගින් Contractor Invoice Pricing Audit එක සිදු කරන්නේ කෙසේද?',
            questionEn: 'How does SF Audit Division verify contractor invoice pricing against the dynamic rate matrix?',
            summary: 'කොන්ත්‍රාත්කරුවන් ඉදිරිපත් කරන බිල්පත් වල මුදල් අගයන් Dynamic Rate Matrix එක සමග සසඳා Audit කරන ආකාරය.',
            steps: [
                { num: 1, title: 'Pricing Audit Module එකට යාම', description: '/sf-audit/pricing-audit පිටුවට යන්න.' },
                { num: 2, title: 'Invoice එක තේරීම', description: 'Audit කළ යුතු Contractor Invoice එක Select කරන්න.' },
                { num: 3, title: 'System Auto-Variance Calculation', description: 'පද්ධතිය මගින් Billed Amount සහ Dynamic Rate Matrix එකෙන් ආ යුතු Expected Amount සසඳා Variance % එක පෙන්වයි.' },
                { num: 4, title: 'Auditor Approval / Flagging', description: 'වෙනසක් නැතිනම් "Approve Audit" ඔබන්න. වැඩිපුර බිල් කර ඇත්නම් "Flag Overcharge" කර Reject කරන්න.' }
            ],
            outcomes: [
                'වැරදි ලෙස වැඩිපුර අයකිරීම් (Overbilling) 100% ක් අසුවීම.',
                'අනුමත වූ නිවැරදි බිල්පත් පමණක් Finance Payment Vouchers සඳහා නිකුත් වීම.'
            ],
            tags: ['sf audit', 'pricing audit', 'invoice audit', 'variance'],
            actionRoute: '/sf-audit/pricing-audit',
            actionLabel: 'Pricing Audit Module'
        },

        // CATEGORY 6: Security & Audit Logs
        {
            id: 'qa-14',
            category: 'security-audit',
            categoryLabel: 'Security & System Audit',
            categoryColor: 'bg-rose-100 text-rose-800 border-rose-200',
            questionSi: 'System Audit Logs (/admin/audit-logs) මගින් සිදුවන නිරීක්ෂණ මොනවාද?',
            questionEn: 'What timeline events and payload diffs are captured in System Audit Logs?',
            summary: 'ERP එක ඇතුළේ වෙන හැමදේම (User actions, mutations, logins) IP address එකත් එක්ක පරීක්ෂා කරන ආකාරය.',
            steps: [
                { num: 1, title: 'Audit Logs UI එකට යාම', description: '/admin/audit-logs පිටුවට යන්න.' },
                { num: 2, title: 'Filter සකස් කිරීම', description: 'Date Range, Action (CREATE, UPDATE, DELETE, APPROVE), User ID, හෝ IP Address මගින් Filter කරන්න.' },
                { num: 3, title: 'Event Timeline පරීක්ෂාව', description: 'අදාළ Event එක මත Click කර Raw Payload Diff එක (Before vs After JSON) බලන්න.' }
            ],
            outcomes: [
                'පද්ධතිය තුළ සිදුවූ ඕනෑම වැරැද්දක් කළේ කවුද, කොයි වෙලාවෙද, කුමන IP එකකින්ද යන්න තත්පර කිහිපයකින් හොයාගැනීමට හැකිවීම.',
                'නීතිමය හා අභ්‍යන්තර විගණන (ISO/IEC Audit Compliance) තහවුරු වීම.'
            ],
            tags: ['audit log', 'event history', 'user tracking', 'security audit'],
            actionRoute: '/admin/audit-logs',
            actionLabel: 'System Audit Logs'
        },
        {
            id: 'qa-15',
            category: 'security-audit',
            categoryLabel: 'Security & System Audit',
            categoryColor: 'bg-rose-100 text-rose-800 border-rose-200',
            questionSi: 'Idempotency Engine එක මගින් Double Billing / Duplicate Submissions වළක්වන්නේ කෙසේද?',
            questionEn: 'How does the Idempotency Engine block duplicate requests during network delays?',
            summary: 'Network lag නිසා Submit බටන් එක දෙපාරක් click වුවද දෙපාරක් බඩු අඩු වීම හෝ Double Bill වීම වළක්වන ආකාරය.',
            steps: [
                { num: 1, title: 'Client Idempotency Key Generation', description: 'Request එක යවන විට Header එකේ unique x-idempotency-key එකක් යවයි.' },
                { num: 2, title: 'Engine Check', description: 'Idempotency Engine එක මගින් මෙම Key එක දැනටමත් Process වෙනවාදැයි පරීක්ෂා කරයි.' },
                { num: 3, title: 'Duplicate Blocking', description: 'දෙවනුව ආ Request එක IDEMPOTENCY_LOCK_ACTIVE ලෙස Block කර පළමු Request එකේ Result එකම ලබාදෙයි.' }
            ],
            outcomes: [
                'එකම බිල දෙපාරක් හැදීම (Double Billing) සම්පූර්ණයෙන්ම වැළකීම.',
                'එකම Stock එක දෙපාරක් කැපීම වැළකීම.'
            ],
            tags: ['idempotency', 'double billing', 'duplicate request', 'network timeout'],
            actionRoute: '/admin/test-extension',
            actionLabel: 'Diagnostics Monitor'
        },

        // CATEGORY 7: Settings & SMTP Integration
        {
            id: 'qa-16',
            category: 'settings-email',
            categoryLabel: 'Settings & SMTP Gateway',
            categoryColor: 'bg-slate-200 text-slate-800 border-slate-300',
            questionSi: 'SMTP Email Gateway Configure කර Process Gate Email Alerts සකසන්නේ කෙසේද?',
            questionEn: 'How to setup SMTP Mail Gateway and enable automated email alerts for approvals?',
            summary: 'Approvals එන විට නිලධාරීන්ගේ Inbox එකටම Mail එක යවන සේ SMTP Mail Gateway එක සකසන ਪියවර.',
            steps: [
                { num: 1, title: 'SMTP Settings වෙත යාම', description: '/admin/settings/smtp පිටුවට යන්න.' },
                { num: 2, title: 'Mail Server Config ඇතුළත් කිරීම', description: 'SMTP Host (mail.slts.lk), Port (587/465), Username, Password සහ Sender Email ඇතුළත් කරන්න.' },
                { num: 3, title: 'Send Test Email', description: '"Send Test Email" ඔබා පද්ධතියෙන් Mail එකක් Inbox එකට එනවාදැයි පරීක්ෂා කර Save කරන්න.' },
                { num: 4, title: 'Process Gate Policy එකේ Alerts ON කිරීම', description: '/admin/settings/process-gates වෙත ගොස් enableEmailAlerts = true කරන්න.' }
            ],
            outcomes: [
                'අනුමැතියක් අවශ්‍ය වූ සැනින් අදාළ Approver ගේ Email එකට 1-Click Direct Approval Link එකක් සහිත Email එකක් ලැබීම.',
                'පද්ධතියට ලොග් නොවී වුවද Email එකෙන් Approval තත්ත්වය දැනගැනීමට හැකිවීම.'
            ],
            tags: ['smtp', 'email alerts', 'mail config', 'notification'],
            actionRoute: '/admin/settings/smtp',
            actionLabel: 'SMTP Configuration'
        }
    ], []);

    // Filtered Q&A Items based on Search Query and Category
    const filteredQAs = useMemo(() => {
        return qaDatabase.filter((qa) => {
            const matchesCategory = activeTab === 'all' || qa.category === activeTab;
            const queryLower = searchQuery.toLowerCase().trim();
            if (!queryLower) return matchesCategory;

            const matchesText =
                qa.questionSi.toLowerCase().includes(queryLower) ||
                qa.questionEn.toLowerCase().includes(queryLower) ||
                qa.summary.toLowerCase().includes(queryLower) ||
                qa.tags.some(tag => tag.toLowerCase().includes(queryLower));

            return matchesCategory && matchesText;
        });
    }, [qaDatabase, activeTab, searchQuery]);

    // Categories list for tabs
    const categories = [
        { id: 'all', label: 'සියල්ල (All Q&As)', count: qaDatabase.length, icon: HelpCircle },
        { id: 'process-gates', label: '1. FSM & Process Gates', count: qaDatabase.filter(q => q.category === 'process-gates').length, icon: Settings },
        { id: 'users-roles', label: '2. Users & Access Control', count: qaDatabase.filter(q => q.category === 'users-roles').length, icon: Users },
        { id: 'stores-opmcs', label: '3. Stores & OPMC Setup', count: qaDatabase.filter(q => q.category === 'stores-opmcs').length, icon: Warehouse },
        { id: 'contractors', label: '4. Contractors & Rates', count: qaDatabase.filter(q => q.category === 'contractors').length, icon: HardHat },
        { id: 'revenue-audit', label: '5. Revenue & Billing Audit', count: qaDatabase.filter(q => q.category === 'revenue-audit').length, icon: Receipt },
        { id: 'security-audit', label: '6. Security & Audit Logs', count: qaDatabase.filter(q => q.category === 'security-audit').length, icon: Shield },
        { id: 'settings-email', label: '7. Settings & SMTP', count: qaDatabase.filter(q => q.category === 'settings-email').length, icon: Mail },
    ];

    // Detailed Error Troubleshooter
    const troubleShooterList = [
        {
            code: 'SEGREGATION_OF_DUTIES_VIOLATION',
            title: 'Segregation of Duties Violation (Self Approval Block)',
            cause: 'Request එක නිර්මාණය කළ පුද්ගලයාම (Maker) එය Approve කිරීමට (Checker) උත්සාහ කිරීම.',
            steps: [
                '1. Request එක සෑදූ පරිශීලකයාගෙන් ලොග් අවුට් වන්න.',
                '2. අදාළ OPMC එකට බලයලත් වෙනත් Approver (උදා: වෙනත් OSP Manager) කෙනෙකුගෙන් Log in වන්න.',
                '3. /inventory/requests වෙත ගොස් අනුමැතිය ලබාදෙන්න.'
            ]
        },
        {
            code: 'IDEMPOTENCY_LOCK_ACTIVE',
            title: 'Idempotency Lock Active (Duplicate Action Prevented)',
            cause: 'Network Lag එකක් නිසා එකම Submit button එක තත්පර කිහිපයක් ඇතුළත දෙපාරක් click වීම.',
            steps: [
                '1. තත්පර 30-60 ත් අතර කාලයක් රැඳී සිටින්න.',
                '2. Page එක Refresh (F5) කරන්න.',
                '3. පළමු Request එක සාර්ථකව Process වී ඇත්දැයි Status එකෙන් පරීක්ෂා කරන්න.'
            ]
        },
        {
            code: 'UNAUTHORIZED_OPMC_ACCESS',
            title: 'Unauthorized OPMC Access (Regional Boundary Violation)',
            cause: 'පරිශීලකයාට ප්‍රවේශ වීමට උත්සාහ කරන OPMC/RTOM Region එක ඔහුගේ Accessible OPMCs අතර නොතිබීම.',
            steps: [
                '1. Admin කෙනෙකු ලෙස /admin/users වෙත යන්න.',
                '2. අදාළ පරිශීලකයාගේ Profile Edit එක ගන්න.',
                '3. Accessible OPMCs ලැයිස්තුවෙන් මෙම Region එක Select කර Save කරන්න.'
            ]
        },
        {
            code: 'STORE_KEEPER_NOT_ASSIGNED',
            title: 'Store Keeper Not Assigned Error',
            cause: 'පරිශීලකයාට Stock Issue කිරීමට හෝ GRN කිරීමට අදාළ Store එක Assign කර නොතිබීම.',
            steps: [
                '1. /inventory/stores පිටුවට යන්න.',
                '2. අදාළ Main Store හෝ Sub Store එක Edit කරන්න.',
                '3. Assigned Store Keepers අතරට අදාළ පරිශීලකයා එකතු කර Save කරන්න.'
            ]
        },
        {
            code: 'SAGA_ROLLBACK_EXECUTED',
            title: 'Saga Transaction Rollback Executed',
            cause: 'Approval එක දෙන අතරතුර යටින් යන Stock Deduction හෝ Database query එකක් Fail වීම.',
            steps: [
                '1. Stock ශේෂය ප්‍රමාණවත්දැයි /inventory/stock වෙත ගොස් පරීක්ෂා කරන්න.',
                '2. Audit Logs (/admin/audit-logs) මගින් exact error payload එක පරීක්ෂා කරන්න.'
            ]
        },
        {
            code: 'PROCESS_GATE_POLICY_NOT_FOUND',
            title: 'Process Gate Policy Not Found',
            cause: 'මෙම Entity Type එක සහ Stage එක සඳහා Database එකේ Gate Policy එකක් සක්‍රීය කර නොතිබීම.',
            steps: [
                '1. /admin/settings/process-gates පිටුවට යන්න.',
                '2. "Load Industrial Presets" ඔබා Default Gate Policies Load කරගන්න.'
            ]
        }
    ];

    return (
        <RoleGuard allowedRoles={[...ROLE_GROUPS.ADMINS, ...ROLE_GROUPS.OFFICE_ADMINS]}>
            <div className="flex h-screen bg-slate-50 overflow-hidden">
                <Sidebar />
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <Header />
                    <main className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0 print:overflow-visible">
                        <div className="max-w-6xl mx-auto space-y-6">

                            {/* Top Header Banner */}
                            <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden print:bg-none print:text-black print:p-0">
                                <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="space-y-2 max-w-3xl">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-semibold backdrop-blur-md border border-indigo-500/30">
                                            <Sparkles className="w-3.5 h-3.5" /> Full Enterprise Step-by-Step System Administrator Guide
                                        </div>
                                        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-3">
                                            SLTSERP පරිපාලන සහායක සහ Q&A මාර්ගෝපදේශය
                                        </h1>
                                        <p className="text-slate-300 text-xs md:text-sm leading-relaxed">
                                            Admin Module එකට අදාළ සියලුම ක්‍රියාපටිපාටීන්, පියවරෙන් පියවර උපදෙස් (Step-by-Step Instructions), පද්ධතියෙන් ලැබෙන ප්‍රතිඵල (System Outcomes), සහ Error Troubleshooting සඳහා වූ සම්පූර්ණ මාර්ගෝපදේශ සංග්‍රහය.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 print:hidden">
                                        <Button
                                            onClick={() => window.print()}
                                            variant="outline"
                                            className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-md text-xs gap-2"
                                        >
                                            <Printer className="w-4 h-4" /> Print Manual
                                        </Button>
                                        <Link href="/admin/settings/process-gates">
                                            <Button className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs gap-2 shadow-lg shadow-indigo-600/30">
                                                <Settings className="w-4 h-4" /> Process Gates
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </div>

                            {/* Search & Category Filter Bar */}
                            <Card className="border-slate-200 shadow-sm print:hidden">
                                <CardContent className="p-4 space-y-4">
                                    <div className="relative">
                                        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <Input
                                            type="text"
                                            placeholder="සෙවුම / Search Q&A (e.g. Maker-Checker, OOO, MIN, Process Gate, RTOM, Idempotency)..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10 h-11 text-sm bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                                        />
                                        {searchQuery && (
                                            <button
                                                onClick={() => setSearchQuery('')}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full"
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>

                                    {/* Category Pill Filters */}
                                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                                        {categories.map((cat) => {
                                            const IconComponent = cat.icon;
                                            const isSelected = activeTab === cat.id;
                                            return (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => setActiveTab(cat.id)}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap border ${
                                                        isSelected
                                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                                                    }`}
                                                >
                                                    <IconComponent className="w-3.5 h-3.5" />
                                                    <span>{cat.label}</span>
                                                    <span className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                                                        {cat.count}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Detailed Instant Error Troubleshooter Card */}
                            <Card className="border-rose-200 bg-rose-50/20 shadow-sm print:hidden">
                                <CardHeader className="pb-3 border-b border-rose-100 bg-rose-50/50 rounded-t-xl">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-bold text-rose-950 flex items-center gap-2">
                                            <Wrench className="w-5 h-5 text-rose-600" /> 🚨 Instant Admin Error Troubleshooter (දෝෂ නිරාකරණ සහායක)
                                        </CardTitle>
                                        <Badge variant="outline" className="bg-rose-100 text-rose-800 border-rose-300 text-[10px]">
                                            Diagnostic Assistant
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-4 space-y-3">
                                    <p className="text-xs text-rose-900">
                                        පරිපාලන කටයුතු වලදී එන Error Codes සඳහා වන නිශ්චිත හේතුව සහ විසඳන පියවර (Steps):
                                    </p>
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {troubleShooterList.map((item) => (
                                            <div
                                                key={item.code}
                                                onClick={() => setSelectedTrouble(selectedTrouble === item.code ? null : item.code)}
                                                className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                                                    selectedTrouble === item.code
                                                        ? 'bg-white border-rose-400 shadow-md ring-1 ring-rose-400'
                                                        : 'bg-white/90 hover:bg-white border-rose-200 shadow-sm'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between font-mono font-bold text-rose-950 mb-1">
                                                    <span>{item.code}</span>
                                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                                                </div>
                                                <p className="font-semibold text-slate-800 text-[11px] mb-1">{item.title}</p>
                                                <p className="text-rose-700 text-[10px] mb-2"><strong>හේතුව:</strong> {item.cause}</p>
                                                
                                                {selectedTrouble === item.code && (
                                                    <div className="mt-2 pt-2 border-t border-rose-100 space-y-1 bg-rose-50/50 p-2 rounded text-[10px] text-slate-700">
                                                        <span className="font-bold text-rose-900 block mb-1">විසඳන පියවර (Resolution Steps):</span>
                                                        {item.steps.map((st, i) => (
                                                            <div key={i} className="flex items-start gap-1">
                                                                <ChevronRight className="w-3 h-3 text-rose-500 flex-shrink-0 mt-0.5" />
                                                                <span>{st}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                <span className="text-[9px] text-rose-500 font-semibold underline mt-1 block">
                                                    {selectedTrouble === item.code ? 'සඟවන්න' : 'විසඳන පියවර බලන්න (Click)'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Q&A Accordion List */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between px-1">
                                    <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                        <HelpCircle className="w-4 h-4 text-indigo-600" />
                                        ප්‍රශ්න, පියවර සහ ලැබෙන ප්‍රතිඵල (Full Q&A Guide)
                                    </h3>
                                    <span className="text-xs text-slate-500">
                                        පෙන්වන්නේ {filteredQAs.length} / {qaDatabase.length}
                                    </span>
                                </div>

                                {filteredQAs.length === 0 ? (
                                    <Card className="border-slate-200 text-center p-8">
                                        <CardContent className="space-y-3">
                                            <HelpCircle className="w-12 h-12 text-slate-300 mx-auto" />
                                            <h4 className="font-bold text-slate-700 text-sm">ප්‍රශ්න සොයාගත නොහැකි විය</h4>
                                            <p className="text-xs text-slate-500 max-w-sm mx-auto">
                                                ඔබ ලබාදුන් <code>&quot;{searchQuery}&quot;</code> සෙවුම් වචනයට අදාළ Q&A හමුවූයේ නැත.
                                            </p>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => { setSearchQuery(''); setActiveTab('all'); }}
                                                className="text-xs mt-2"
                                            >
                                                සියලු Q&As පෙන්වන්න
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <Accordion type="multiple" className="space-y-4">
                                        {filteredQAs.map((qa) => (
                                            <AccordionItem
                                                key={qa.id}
                                                value={qa.id}
                                                className="border border-slate-200 bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow px-4 py-2"
                                            >
                                                <AccordionTrigger className="hover:no-underline py-2">
                                                    <div className="flex flex-col text-left w-full gap-1.5 pr-2">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${qa.categoryColor}`}>
                                                                {qa.categoryLabel}
                                                            </span>
                                                        </div>
                                                        <h4 className="font-bold text-slate-900 text-base leading-snug">
                                                            {qa.questionSi}
                                                        </h4>
                                                        <p className="text-xs text-slate-400 font-medium">
                                                            {qa.questionEn}
                                                        </p>
                                                    </div>
                                                </AccordionTrigger>

                                                <AccordionContent className="pt-3 pb-4 border-t border-slate-100 mt-2 space-y-4">
                                                    {/* Summary */}
                                                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                                                        <span className="font-bold text-xs text-slate-900 block mb-1">සංක්ෂිප්තය (Summary):</span>
                                                        <p className="text-xs text-slate-700 leading-relaxed">{qa.summary}</p>
                                                    </div>

                                                    {/* Step-by-Step Procedure */}
                                                    <div className="space-y-2">
                                                        <h5 className="font-bold text-xs text-indigo-950 flex items-center gap-1.5">
                                                            <Layers className="w-4 h-4 text-indigo-600" />
                                                            සම්පූර්ණ ක්‍රියාපටිපාටිය (Step-by-Step Execution Guide):
                                                        </h5>
                                                        <div className="grid gap-2">
                                                            {qa.steps.map((st) => (
                                                                <div key={st.num} className="flex items-start gap-3 p-2.5 bg-indigo-50/30 rounded-lg border border-indigo-100/50">
                                                                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                                                                        {st.num}
                                                                    </span>
                                                                    <div className="space-y-0.5">
                                                                        <h6 className="font-bold text-xs text-indigo-950">{st.title}</h6>
                                                                        <p className="text-xs text-slate-600 leading-relaxed">{st.description}</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* System Outcomes (Labena Dewal) */}
                                                    <div className="space-y-2">
                                                        <h5 className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                                                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                                            පද්ධතියෙන් ලැබෙන ප්‍රතිඵල (System Consequences & State Changes):
                                                        </h5>
                                                        <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100 space-y-1.5">
                                                            {qa.outcomes.map((out, idx) => (
                                                                <div key={idx} className="flex items-start gap-2 text-xs text-emerald-900">
                                                                    <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                                                    <span>{out}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Optional Code/JSON Snippet */}
                                                    {qa.codeSnippet && (
                                                        <div className="space-y-1">
                                                            <span className="font-bold text-[11px] text-slate-700">JSON/Rule Configuration:</span>
                                                            <div className="bg-slate-950 text-slate-100 p-3 rounded-lg font-mono text-xs overflow-x-auto">
                                                                {qa.codeSnippet}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Important Warning/Note */}
                                                    {qa.importantNote && (
                                                        <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
                                                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                                            <div>
                                                                <strong className="block font-bold">වැදගත් සටහන:</strong>
                                                                <span>{qa.importantNote}</span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Action Shortcut Button */}
                                                    {qa.actionRoute && (
                                                        <div className="pt-2 flex items-center justify-end">
                                                            <Link href={qa.actionRoute}>
                                                                <Button size="sm" className="text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
                                                                    <span>{qa.actionLabel || 'අදාළ Module එක වෙත යන්න'}</span>
                                                                    <ExternalLink className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </Link>
                                                        </div>
                                                    )}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                )}
                            </div>

                            {/* Footer Status Banner */}
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3 print:hidden">
                                <RefreshCw className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-bold text-blue-950 text-sm flex items-center gap-2">
                                        SLTSERP Admin Architecture v2.4 Active
                                    </h4>
                                    <p className="text-xs text-blue-800 mt-1 leading-relaxed">
                                        මෙම උපදෙස් මාලාව FSM Workflow Engine, Process Gate Policy Engine, SHA-256 Audit Ledger, සහ Segregation of Duties (SoD) නීති මාලාවන් සමග සක්‍රීයව සම්බන්ධ වී ඇත.
                                    </p>
                                </div>
                            </div>

                        </div>
                    </main>
                </div>
            </div>
        </RoleGuard>
    );
}
