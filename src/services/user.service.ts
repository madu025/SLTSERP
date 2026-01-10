import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { signJWT } from '@/lib/auth';

interface LoginCredentials {
    username: string;
    password?: string;
}

export class UserService {
    /**
     * Authenticates a user and returns a token and user details.
     * Throws errors for invalid credentials or missing inputs.
     */
    static async login({ username, password }: LoginCredentials) {
        if (!username || !password) {
            throw new Error('USERNAME_PASSWORD_REQUIRED');
        }

        const user = await prisma.user.findUnique({
            where: { username: username.toLowerCase() },
            include: { accessibleOpmcs: { select: { id: true, name: true } } }
        });

        if (!user) {
            throw new Error('INVALID_CREDENTIALS');
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            throw new Error('INVALID_CREDENTIALS');
        }

        // Generate JWT Token
        const token = await signJWT({
            id: user.id,
            username: user.username,
            role: user.role,
        });

        return {
            token,
            user: {
                id: user.id,
                username: user.username,
                name: user.name,
                role: user.role,
                accessibleOpmcs: user.accessibleOpmcs
            }
        };
    }
}
