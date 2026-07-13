"use client";

import { 
    Layers, 
    BookOpen, 
    FileSpreadsheet, 
    FolderTree, 
    TrendingUp, 
    Map, 
    Award, 
    Warehouse, 
    Truck, 
    BellRing, 
    Settings, 
    Zap 
} from "lucide-react";

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
        chapter: "Welcome to SLTS Nexus",
        title: "🚀 SLTS Nexus: Workflow Management System",
        subtitle: "Centralized operational framework for Sri Lanka Telecom (SLT) services",
        icon: Layers,
        component: Slide1
    },
    {
        id: 2,
        chapter: "Introduction",
        title: "⚡ Before vs. After: The Digital Leap",
        subtitle: "Replacing manual spreadsheets and fragmented emails with a unified real-time ledger",
        icon: BookOpen,
        component: Slide2
    },
    {
        id: 3,
        chapter: "Service Order Details",
        title: "📋 SOD: Operational Core",
        subtitle: "The heart of connection jobs and customer installations",
        icon: FileSpreadsheet,
        component: Slide3
    },
    {
        id: 4,
        chapter: "Service Order Details",
        title: "📊 SOD: Sheet Mode & Bulk Import",
        subtitle: "Interactive grid views and drag-and-drop Excel loaders for faster data entry",
        icon: FileSpreadsheet,
        component: Slide4
    },
    {
        id: 5,
        chapter: "Service Order Details",
        title: "💰 SOD: Completion Wizard & Payouts",
        subtitle: "Guided 3-step technician logs with automatic sourcing splits and deductions",
        icon: FileSpreadsheet,
        component: Slide5
    },
    {
        id: 6,
        chapter: "OSP Project Management",
        title: "🏗️ OSP: WBS & Stage Builder",
        subtitle: "Hierarchical task tracking with automatic completion sync",
        icon: FolderTree,
        component: Slide6
    },
    {
        id: 7,
        chapter: "OSP Project Management",
        title: "🔒 OSP: Quality Gates & Closures",
        subtitle: "Mandatory coordinate, document, and photo verification checklists",
        icon: FolderTree,
        component: Slide7
    },
    {
        id: 8,
        chapter: "OSP Inner Modules",
        title: "💵 Financials: Budget & Cost Tracking",
        subtitle: "Live actual cost comparisons against estimated allocations",
        icon: TrendingUp,
        component: Slide8
    },
    {
        id: 9,
        chapter: "OSP Inner Modules",
        title: "🗺️ Operations: Change Requests & GIS Map",
        subtitle: "Auditing field route deviations via coordinated GIS mapping",
        icon: Map,
        component: Slide9
    },
    {
        id: 10,
        chapter: "OSP Inner Modules",
        title: "🏆 Quality: As-Built & Contractor KPIs",
        subtitle: "Validating CAD blueprints and logging speed & quality scores",
        icon: Award,
        component: Slide10
    },
    {
        id: 11,
        chapter: "Warehouse & Stock Control",
        title: "📦 Precision Stock Management",
        subtitle: "Material Requisition Notes and safety thresholds preventing shortage",
        icon: Warehouse,
        component: Slide11
    },
    {
        id: 12,
        chapter: "Utility Modules",
        title: "🚛 Vehicle Logs & Rental Calculations",
        subtitle: "QR cabin check-ins tracking odometer values and automated lease costs",
        icon: Truck,
        component: Slide12
    },
    {
        id: 13,
        chapter: "Manager Analytics",
        title: "🔔 Reporting & Live SLA Alarms",
        subtitle: "Breach warnings and direct notification alarms to hub leads",
        icon: BellRing,
        component: Slide13
    },
    {
        id: 14,
        chapter: "System Architecture",
        title: "🛡️ Robust Next-Gen Tech Stack",
        subtitle: "Decoupled Service-Repository pattern with PostgreSQL and role security",
        icon: Settings,
        component: Slide14
    },
    {
        id: 15,
        chapter: "System Architecture",
        title: "🌐 Deployment & Infrastructure Costing",
        subtitle: "Cost-efficient hosting options tailored for Sri Lanka Telecom regional hubs",
        icon: Layers,
        component: Slide16
    },
    {
        id: 16,
        chapter: "Conclusion",
        title: "🎯 SLTS Nexus Pilot Deployment & Roadmap",
        subtitle: "Pilot-ready core, native offline apps, and automated scheduling",
        icon: Zap,
        component: Slide15
    }
];
