'use server';

import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/server-utils';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { revalidatePath } from 'next/cache';

export async function createOPMC(data: {
    name: string;
    rtom: string;
    region: string;
    province: string;
    storeId?: string | null;
}) {
    await requirePermission(RBAC_PERMISSIONS.ADMIN_RBAC);

    try {
        const opmc = await prisma.oPMC.create({
            data: {
                name: data.name,
                rtom: data.rtom,
                region: data.region,
                province: data.province,
                storeId: data.storeId || null
            }
        });

        revalidatePath('/admin/opmcs');
        return { success: true, data: opmc };
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2002') {
            return { success: false, error: 'OPMC RTOM already exists' };
        }
        return { success: false, error: 'Error creating OPMC' };
    }
}

export async function updateOPMC(data: {
    id: string;
    name: string;
    rtom: string;
    region: string;
    province: string;
    storeId?: string | null;
}) {
    await requirePermission(RBAC_PERMISSIONS.ADMIN_RBAC);

    try {
        const opmc = await prisma.oPMC.update({
            where: { id: data.id },
            data: {
                name: data.name,
                rtom: data.rtom,
                region: data.region,
                province: data.province,
                storeId: data.storeId || null
            }
        });

        revalidatePath('/admin/opmcs');
        return { success: true, data: opmc };
    } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2002') {
            return { success: false, error: 'RTOM already exists' };
        }
        return { success: false, error: 'Error updating OPMC' };
    }
}

export async function deleteOPMC(id: string) {
    await requirePermission(RBAC_PERMISSIONS.ADMIN_SUPER);

    try {
        await prisma.oPMC.delete({
            where: { id }
        });

        revalidatePath('/admin/opmcs');
        return { success: true, message: 'OPMC deleted successfully' };
    } catch {
        return { success: false, error: 'Error deleting OPMC' };
    }
}
