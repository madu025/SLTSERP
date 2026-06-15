"use client";

import { Layers, BookOpen, HelpCircle, FileSpreadsheet, Warehouse, Zap, FileText, FolderTree, Package, Lock, Settings, Clock, Users, Car, Calculator } from "lucide-react";
import Slide1 from "./Slide1";
import Slide2 from "./Slide2";
import Slide3 from "./Slide3";
import Slide4 from "./Slide4";
import Slide5 from "./Slide5";
import Slide6 from "./Slide6";
import Slide7 from "./Slide7";
import Slide8 from "./Slide8";
import Slide9 from "./Slide9";
import Slide10 from "./Slide10";
import Slide11 from "./Slide11";
import Slide12 from "./Slide12";
import Slide13 from "./Slide13";
import Slide14 from "./Slide14";
import Slide15 from "./Slide15";
import Slide16 from "./Slide16";
import Slide17 from "./Slide17";
import Slide18 from "./Slide18";
import Slide19 from "./Slide19";
import Slide20 from "./Slide20";
import Slide21 from "./Slide21";
import Slide22 from "./Slide22";
import Slide23 from "./Slide23";
import Slide24 from "./Slide24";
import Slide25 from "./Slide25";
import Slide26 from "./Slide26";
import Slide27 from "./Slide27";
import Slide28 from "./Slide28";
import Slide29 from "./Slide29";
import Slide30 from "./Slide30";

export interface SlideMeta {
    id: number;
    chapter: string;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    component: React.ComponentType;
}

export const SLIDES: SlideMeta[] = [
    {
        id: 1,
        chapter: "Welcome to SLTSERP",
        title: "SLTS Workflow Management",
        subtitle: "End-to-End Telecom Operations Management Platform",
        icon: Layers,
        component: Slide1
    },
    {
        id: 2,
        chapter: "Introduction",
        title: "Five Core Modules",
        subtitle: "Each module connects seamlessly to power the full telecom workflow",
        icon: BookOpen,
        component: Slide2
    },
    {
        id: 3,
        chapter: "Introduction",
        title: "Before & After",
        subtitle: "Transitioning SLTS connection logs to high-speed digital tracks",
        icon: HelpCircle,
        component: Slide3
    },
    {
        id: 4,
        chapter: "Service Order Details (SOD)",
        title: "The SOD module is the operational heart of SLTSERP",
        subtitle: "Operational center for SLT provisioning and coordination",
        icon: Layers,
        component: Slide4
    },
    {
        id: 5,
        chapter: "Service Order Details (SOD)",
        title: "Sheet Mode",
        subtitle: "Click any cell to edit directly — tab to move between fields",
        icon: FileSpreadsheet,
        component: Slide5
    },
    {
        id: 6,
        chapter: "Service Order Details (SOD)",
        title: "Completion Wizard",
        subtitle: "Three guided steps to close any service order",
        icon: Layers,
        component: Slide6
    },
    {
        id: 7,
        chapter: "Service Order Details (SOD)",
        title: "Preventing material leakage",
        subtitle: "Deductions and sourcing control for contractor materials",
        icon: Layers,
        component: Slide7
    },
    {
        id: 8,
        chapter: "DEDUCTED",
        title: "Material Sourcing Split",
        subtitle: "Materials from SLT store, cost deducted from monthly invoice",
        icon: Warehouse,
        component: Slide8
    },
    {
        id: 9,
        chapter: "Service Order Details (SOD)",
        title: "Excel Import",
        subtitle: "Upload bulk excel spreadsheets to sync orders instantly",
        icon: Zap,
        component: Slide9
    },
    {
        id: 10,
        chapter: "Service Order Details (SOD)",
        title: "Invoicing",
        subtitle: "Automated invoicing with configurable payment splits. Generate, review, and export invoices in one workflow.",
        icon: FileText,
        component: Slide10
    },
    {
        id: 11,
        chapter: "OSP Project Management",
        title: "Organize OSP projects into hierarchical Work Breakdown Structures",
        subtitle: "Structuring long-running plant maintenance workflows",
        icon: Layers,
        component: Slide11
    },
    {
        id: 12,
        chapter: "OSP Project Management",
        title: "WBS Progress Tracking",
        subtitle: "Tracks parent-child task completion rates and duration logs",
        icon: FolderTree,
        component: Slide12
    },
    {
        id: 13,
        chapter: "OSP Project Management",
        title: "Change Orders & Procurement",
        subtitle: "Manage project scope changes with full traceability and financial impact tracking.",
        icon: Package,
        component: Slide13
    },
    {
        id: 14,
        chapter: "OSP Project Management",
        title: "Closures & Retention",
        subtitle: "Systematic project closure ensures all deliverables are verified and formally handed over with complete documentation.",
        icon: Lock,
        component: Slide14
    },
    {
        id: 15,
        chapter: "Warehouse & Stock Control",
        title: "Full inventory lifecycle from goods receipt to issue",
        subtitle: "Real-time transactional ledger for all telecom materials",
        icon: Warehouse,
        component: Slide15
    },
    {
        id: 16,
        chapter: "Warehouse & Stock Control",
        title: "Stock Ledger & GRN",
        subtitle: "Review stock logs, check receipts, and inspect balances",
        icon: BookOpen,
        component: Slide16
    },
    {
        id: 17,
        chapter: "Warehouse & Stock Control",
        title: "Safety Stock & Alerts",
        subtitle: "Prevent stock-outs with configurable minimum thresholds that trigger automatic alerts and procurement suggestions.",
        icon: Warehouse,
        component: Slide17
    },
    {
        id: 18,
        chapter: "Warehouse & Stock Control",
        title: "PDF Exports",
        subtitle: "Generate professional, sign-off-ready documents that meet compliance requirements and streamline warehouse operations.",
        icon: Warehouse,
        component: Slide18
    },
    {
        id: 19,
        chapter: "System Architecture",
        title: "Technical Architecture",
        subtitle: "Clean service-repository pattern with Next.js and Tailwind",
        icon: Layers,
        component: Slide19
    },
    {
        id: 20,
        chapter: "Managerial Insights",
        title: "Analytics — KPI Dashboard",
        subtitle: "Real-time executive metrics — auto-compiled from operational data",
        icon: Layers,
        component: Slide20
    },
    {
        id: 21,
        chapter: "Managerial Insights",
        title: "Analytics — Reports & Rankings",
        subtitle: "Compare contractor efficiency and regional performance",
        icon: Layers,
        component: Slide21
    },
    {
        id: 22,
        chapter: "Security & Utilities",
        title: "Contractor Verification & Ledger",
        subtitle: "A centralized registry of all registered contractors, their teams, and historical performance data.",
        icon: BookOpen,
        component: Slide22
    },
    {
        id: 23,
        chapter: "Security & Utilities",
        title: "Notifications & Preferences",
        subtitle: "Multi-tier notification engine delivering targeted alerts based on severity and role.",
        icon: Settings,
        component: Slide23
    },
    {
        id: 24,
        chapter: "Security & Utilities",
        title: "SLA Alarms & Appointment Alerts",
        subtitle: "Time-sensitive SLA alerts keep teams on schedule. Appointments trigger escalating reminders, and login dashboards surface the most urgent items immediately.",
        icon: Clock,
        component: Slide24
    },
    {
        id: 25,
        chapter: "Vehicle Management",
        title: "QR-Code Scan Vehicle Logs",
        subtitle: "Driver-facing mobile interface for error-free check-ins and mileage entry.",
        icon: Car,
        component: Slide29
    },
    {
        id: 26,
        chapter: "Vehicle Management",
        title: "Monthly Rental Payment Summary",
        subtitle: "Automated aggregation, audit calculator, and multi-level approval pipeline.",
        icon: Calculator,
        component: Slide30
    },
    {
        id: 27,
        chapter: "Business Value",
        title: "Before vs. After — Benefits",
        subtitle: "Quantitative benefits of transition to centralization",
        icon: Layers,
        component: Slide25
    },
    {
        id: 28,
        chapter: "Business Value",
        title: "ROI & Business Impact",
        subtitle: "Estimated improvements based on operational benchmarks",
        icon: Layers,
        component: Slide26
    },
    {
        id: 29,
        chapter: "Future Roadmap",
        title: "Upcoming Upgrades & Enhancements",
        subtitle: "Proposed modules for the next phase of development",
        icon: Layers,
        component: Slide27
    },
    {
        id: 30,
        chapter: "Conclusion",
        title: "System Ready for Deployment",
        subtitle: "By centering all workflows around a single web platform, SLTSERP reduces administrative delays, eliminates data discrepancies, and optimizes regional field work.",
        icon: Layers,
        component: Slide28
    },
];
