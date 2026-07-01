import { NextResponse } from 'next/server';
import { UserService } from '@/services/user.service';

export async function GET(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const user = await UserService.getProfile(userId);
        return NextResponse.json(user);
    } catch (error: unknown) {
        console.error('Profile Fetch Error:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'USER_NOT_FOUND') {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        return NextResponse.json({ message: 'Error fetching profile' }, { status: 500 });
    }
}
