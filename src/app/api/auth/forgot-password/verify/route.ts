import { NextResponse } from 'next/server';
import { UserService } from '@/services/user.service';

export async function POST(request: Request) {
    try {
        const { username, employeeId } = await request.json();

        if (!username || !employeeId) {
            return NextResponse.json(
                { message: 'Username and Employee ID are required' },
                { status: 400 }
            );
        }

        const result = await UserService.forgotPasswordVerify(username, employeeId);
        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error('Forgot password verify error:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'USER_NOT_FOUND') {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }
        if (errorMsg === 'EMPLOYEE_ID_MISMATCH') {
            return NextResponse.json({ message: 'Employee ID does not match' }, { status: 401 });
        }
        if (errorMsg === 'SECURITY_QUESTION_NOT_SET') {
            return NextResponse.json(
                { message: 'Security question not set. Please contact administrator.' },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}
