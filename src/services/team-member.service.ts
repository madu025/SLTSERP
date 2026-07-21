import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';

export interface UpdateTeamMemberProfileInput {
  shoeSize?: string | null;
  tshirtSize?: string | null;
  photoUrl?: string | null;
  passportPhotoUrl?: string | null;
  nicUrl?: string | null;
  policeReportUrl?: string | null;
  gramaCertUrl?: string | null;
}

export class TeamMemberService {
  /**
   * Generates public document upload link for a team member
   */
  static async generateUploadLink(memberId: string) {
    const token = Math.random().toString(36).substring(2, 12).toUpperCase();
    const expiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await prisma.teamMember.update({
      where: { id: memberId },
      data: {
        uploadToken: token,
        uploadTokenExpiry: expiry
      }
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    return `${appUrl}/team-upload/${token}`;
  }

  /**
   * Verify upload token and fetch member details
   */
  static async verifyUploadToken(token: string) {
    const member = await prisma.teamMember.findUnique({
      where: { uploadToken: token },
      select: {
        id: true,
        name: true,
        uploadTokenExpiry: true,
        shoeSize: true,
        tshirtSize: true,
        photoUrl: true,
        nicUrl: true,
        policeReportUrl: true,
        gramaCertUrl: true,
        passportPhotoUrl: true
      }
    });

    if (!member) {
      throw AppError.badRequest('INVALID_TOKEN');
    }

    if (member.uploadTokenExpiry && new Date() > member.uploadTokenExpiry) {
      throw AppError.badRequest('TOKEN_EXPIRED');
    }

    return member;
  }

  /**
   * Update profile fields via upload token
   */
  static async updateProfileByToken(token: string, data: UpdateTeamMemberProfileInput) {
    const member = await prisma.teamMember.findUnique({
      where: { uploadToken: token }
    });

    if (!member) {
      throw AppError.badRequest('INVALID_TOKEN');
    }

    if (member.uploadTokenExpiry && new Date() > member.uploadTokenExpiry) {
      throw AppError.badRequest('TOKEN_EXPIRED');
    }

    await prisma.teamMember.update({
      where: { id: member.id },
      data: {
        shoeSize: data.shoeSize,
        tshirtSize: data.tshirtSize,
        photoUrl: data.photoUrl,
        passportPhotoUrl: data.passportPhotoUrl,
        nicUrl: data.nicUrl,
        policeReportUrl: data.policeReportUrl,
        gramaCertUrl: data.gramaCertUrl
      }
    });

    return { success: true };
  }
}
