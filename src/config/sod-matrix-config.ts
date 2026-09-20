export type SODPresetId = 'STANDARD' | 'POLE_1' | 'POLE_2' | 'CLEAR';

export interface SODMatrixItemConfig {
    key: string;
    header: string;
    name: string;
    category: 'CABLES' | 'POLES' | 'HARDWARE' | 'TERMINATION';
    companyCode: string;
    sltCode: string;
    unit: string;
    usageType: 'USED' | 'USED_F1' | 'USED_G1' | 'WASTAGE';
    aliases?: string[];
    isPoleNumber?: boolean;
    isDropWire?: boolean;
    placeholder?: string;
    step?: string;
}

export const SOD_STANDARD_MATRIX_CONFIG: SODMatrixItemConfig[] = [
    // ── 1. CABLES & DROP WIRE ──
    {
        key: 'F1',
        header: 'F1',
        name: 'Drop Wire Outdoor (F1)',
        category: 'CABLES',
        companyCode: 'OSP-HC-CBL-DW',
        sltCode: 'OSPFTA003',
        unit: 'm',
        usageType: 'USED_F1',
        isDropWire: true,
        placeholder: '0',
        step: '1'
    },
    {
        key: 'G1',
        header: 'G1',
        name: 'Drop Wire Indoor (G1)',
        category: 'CABLES',
        companyCode: 'OSP-HC-CBL-DW',
        sltCode: 'OSPFTA003',
        unit: 'm',
        usageType: 'USED_G1',
        isDropWire: true,
        placeholder: '0',
        step: '1'
    },
    {
        key: 'FDW_WASTAGE',
        header: 'FDW WASTAGE',
        name: 'Drop Wire Wastage',
        category: 'CABLES',
        companyCode: 'OSP-HC-CBL-DW',
        sltCode: 'OSPFTA003',
        unit: 'm',
        usageType: 'WASTAGE',
        placeholder: '0',
        step: '1'
    },
    {
        key: 'DW_RT',
        header: 'DW-RT',
        name: 'Drop Wire Retainer',
        category: 'CABLES',
        companyCode: 'OSP-NC-ACC-DWRETNER',
        sltCode: 'OSPFTA005',
        unit: 'Nos',
        usageType: 'USED',
        placeholder: '0'
    },
    {
        key: 'IN_W_SINGLE_PAIR',
        header: 'IN-W SINGLE PAIR',
        name: 'Internal Wire 1-Pair',
        category: 'CABLES',
        companyCode: 'OSP-CC-CAB-INTNALTC-1X0.65MM',
        sltCode: 'OSPWIR011',
        unit: 'm',
        usageType: 'USED',
        placeholder: '0'
    },
    {
        key: 'CABLE_CAT5E',
        header: 'CABLE CAT5E',
        name: 'UTP Cat5e Cable',
        category: 'CABLES',
        companyCode: 'CAB-UTP-PRO-CBOX-C5E',
        sltCode: 'ITEACC046',
        unit: 'm',
        usageType: 'USED',
        placeholder: '0'
    },

    // ── 2. POLES & ERECTION ──
    {
        key: 'PLC_5_6_CE',
        header: 'PLC-5_6-CE',
        name: 'Concrete Pole 5.6m',
        category: 'POLES',
        companyCode: 'OSP-POLE-5.6LL',
        sltCode: 'OSPCPL008',
        unit: 'Nos',
        usageType: 'USED',
        placeholder: '0'
    },
    {
        key: 'PLC_6_7_CE',
        header: 'PLC-6_7-CE',
        name: 'Concrete Pole 6.7m',
        category: 'POLES',
        companyCode: 'OSP-POLE-6.7LL',
        sltCode: 'OSPCPL009',
        unit: 'Nos',
        usageType: 'USED',
        placeholder: '0'
    },
    {
        key: 'PLC_8',
        header: 'PLC-8',
        name: 'Concrete Pole 8.0m',
        category: 'POLES',
        companyCode: 'OSP-POLE-8MH',
        sltCode: 'OSPCPL004',
        unit: 'Nos',
        usageType: 'USED',
        placeholder: '0'
    },
    {
        key: 'PLC_CON',
        header: 'PLC-CON',
        name: 'Pole Concrete / Foundation',
        category: 'POLES',
        companyCode: 'HDB-HDW-CNAIL-1',
        sltCode: 'HDB-HDW-CNAIL-1',
        unit: 'Nos',
        usageType: 'USED',
        placeholder: '0'
    },
    {
        key: 'POLE_NUMBER',
        header: 'POLE NUMBER',
        name: 'Pole Serial / Tag #',
        category: 'POLES',
        companyCode: '',
        sltCode: '',
        unit: 'Text',
        usageType: 'USED',
        isPoleNumber: true,
        placeholder: 'e.g. KND-PL-0482'
    },

    // ── 3. HARDWARE & FITTINGS ──
    {
        key: 'L_HOOK',
        header: 'L-HOOK',
        name: 'Hook "L"',
        category: 'HARDWARE',
        companyCode: 'OSP-NC-MM-LHOOK',
        sltCode: 'OSPACC017',
        unit: 'Nos',
        usageType: 'USED',
        placeholder: '0'
    },
    {
        key: 'C_HOOK',
        header: 'C-HOOK',
        name: 'Hook "C"',
        category: 'HARDWARE',
        companyCode: 'OSP-NC-MM-CHOOK',
        sltCode: 'OSPACC018',
        unit: 'Nos',
        usageType: 'USED',
        placeholder: '0'
    },
    {
        key: 'TOP_BOLT',
        header: 'TOP BOLT',
        name: 'Bolts & Nuts 1/2x6.5"',
        category: 'HARDWARE',
        companyCode: 'OSP-NC-MM-NUT&B-1/2 x 61/2',
        sltCode: 'OSPACC011',
        unit: 'Nos',
        usageType: 'USED',
        placeholder: '0'
    },
    {
        key: 'U_CLIP',
        header: 'U CLIP',
        name: 'U Clip (4mm)',
        category: 'HARDWARE',
        companyCode: 'OSP-ACC-UCLIP-4M',
        sltCode: 'OSP-ACC-UCLIP-4M',
        unit: 'Nos',
        usageType: 'USED',
        placeholder: '0'
    },
    {
        key: 'CON_NAIL',
        header: 'CON-NAIL',
        name: 'Concrete Nail 1"',
        category: 'HARDWARE',
        companyCode: 'HDB-HDW-CNAIL-1',
        sltCode: 'HDB-HDW-CNAIL-1',
        unit: 'Nos',
        usageType: 'USED',
        placeholder: '0'
    },
    {
        key: 'CABLE_TIE',
        header: 'CABLE TIE (PCs)',
        name: 'Cable Tie 4"',
        category: 'HARDWARE',
        companyCode: 'HDB-HDW-CTIE-4',
        sltCode: 'HDB-HDW-CTIE-4',
        unit: 'Pcs',
        usageType: 'USED',
        placeholder: '0'
    },
    {
        key: 'CONDUIT_CLIPS',
        header: 'CONDUIT CLIPS',
        name: 'Conduit Clip 1/2"',
        category: 'HARDWARE',
        companyCode: 'HDB-HDW-ECON-CLIP-1/2',
        sltCode: 'HDB-HDW-ECON-CLIP-1/2',
        unit: 'Nos',
        usageType: 'USED',
        placeholder: '0'
    },

    // ── 4. TERMINATION & CONDUITS ──
    {
        key: 'E1_ROSSET',
        header: 'E 1- ROSSET',
        name: 'E1 Rosette Box',
        category: 'TERMINATION',
        companyCode: 'OSPFTA007',
        sltCode: 'OSPFTA007',
        unit: 'Nos',
        usageType: 'USED',
        placeholder: '0'
    },
    {
        key: 'SINGLE_ROSETTE',
        header: 'SINGLE ROSETTE',
        name: 'Single Rosette',
        category: 'TERMINATION',
        companyCode: 'HDB-HDW-ROSET-1',
        sltCode: 'HDB-HDW-ROSET-1',
        unit: 'Nos',
        usageType: 'USED',
        placeholder: '0'
    },
    {
        key: 'FAC_CONNECTORS',
        header: 'FAC CONNECTORS',
        name: 'FAC Connector E-6',
        category: 'TERMINATION',
        companyCode: 'OSP-HC-ACC-FAC',
        sltCode: 'OSPFTA002',
        unit: 'Nos',
        usageType: 'USED',
        placeholder: '0'
    },
    {
        key: 'TL_N',
        header: 'TL-N',
        name: 'Tension / Trunking Line',
        category: 'TERMINATION',
        companyCode: 'HDB-TRUNK-16x12.5',
        sltCode: 'HDB-TRUNK-16x12.5',
        unit: 'Nos',
        usageType: 'USED',
        placeholder: '0'
    },
    {
        key: 'CONNECTOR_RJ11',
        header: 'CONNECTOR  RJ11',
        name: 'RJ11 Connector',
        category: 'TERMINATION',
        companyCode: 'NWE-ACC-RJ11',
        sltCode: 'NWE-ACC-RJ11',
        unit: 'Nos',
        usageType: 'USED',
        placeholder: '0'
    },
    {
        key: 'CONDUIT_M',
        header: 'CONDUIT (m)',
        name: 'Conduit Pipe 1/2"',
        category: 'TERMINATION',
        companyCode: 'HDB-CON-PIPE-1/2',
        sltCode: 'HDB-CON-PIPE-1/2',
        unit: 'm',
        usageType: 'USED',
        placeholder: '0'
    },
    {
        key: 'FLEXIBLE',
        header: 'FLEXIBLE',
        name: 'Flexible Conduit 1/4"',
        category: 'TERMINATION',
        companyCode: 'HDB-FLEX-CON-1/4-W',
        sltCode: 'HDB-FLEX-CON-1/4-W',
        unit: 'm',
        usageType: 'USED',
        placeholder: '0'
    }
];

export const MATRIX_CATEGORIES: { id: SODMatrixItemConfig['category']; label: string; icon: string; borderClass: string; badgeClass: string }[] = [
    {
        id: 'CABLES',
        label: 'Drop Wire & Cables',
        icon: 'Cable',
        borderClass: 'border-blue-200 dark:border-blue-800/60',
        badgeClass: 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800'
    },
    {
        id: 'POLES',
        label: 'Poles & Erection',
        icon: 'UtilityPole',
        borderClass: 'border-emerald-200 dark:border-emerald-800/60',
        badgeClass: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
    },
    {
        id: 'HARDWARE',
        label: 'Hardware & Fittings',
        icon: 'Wrench',
        borderClass: 'border-amber-200 dark:border-amber-800/60',
        badgeClass: 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800'
    },
    {
        id: 'TERMINATION',
        label: 'Termination & Conduits',
        icon: 'Boxes',
        borderClass: 'border-purple-200 dark:border-purple-800/60',
        badgeClass: 'bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800'
    }
];

export interface QuickPresetDefinition {
    id: 'STANDARD' | 'POLE_1' | 'POLE_2' | 'CLEAR';
    label: string;
    icon: string;
    description: string;
    values: Record<string, string>;
}

export const SOD_QUICK_PRESETS: QuickPresetDefinition[] = [
    {
        id: 'STANDARD',
        label: 'Standard FTTH (0 Poles)',
        icon: 'Zap',
        description: 'Standard overhead installation with 2 retainers, 2 L-hooks, rosette and connectors',
        values: {
            DW_RT: '2',
            L_HOOK: '2',
            E1_ROSSET: '1',
            FAC_CONNECTORS: '2',
            CABLE_TIE: '6',
            U_CLIP: '10'
        }
    },
    {
        id: 'POLE_1',
        label: 'FTTH + 1 Pole (5.6m)',
        icon: 'PlusSquare',
        description: 'Includes 1x 5.6m Pole, Top bolt, Concrete and standard connection kit',
        values: {
            PLC_5_6_CE: '1',
            PLC_CON: '1',
            TOP_BOLT: '1',
            DW_RT: '2',
            L_HOOK: '3',
            E1_ROSSET: '1',
            FAC_CONNECTORS: '2',
            CABLE_TIE: '6',
            U_CLIP: '10'
        }
    },
    {
        id: 'POLE_2',
        label: 'FTTH + 2 Poles (5.6m)',
        icon: 'Layers',
        description: 'Includes 2x 5.6m Poles, 2 Top bolts, Concrete and hardware kit',
        values: {
            PLC_5_6_CE: '2',
            PLC_CON: '2',
            TOP_BOLT: '2',
            DW_RT: '3',
            L_HOOK: '4',
            E1_ROSSET: '1',
            FAC_CONNECTORS: '2',
            CABLE_TIE: '10',
            U_CLIP: '15'
        }
    }
];
