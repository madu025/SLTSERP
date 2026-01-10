# Password Reset Implementation Guide

## 🔐 Current Implementation: Security Questions

**Status:** ✅ Implemented (Basic)
**Files:**
- `/forgot-password/page.tsx`
- `/api/auth/forgot-password/verify/route.ts`
- `/api/auth/forgot-password/verify-answer/route.ts`
- `/api/auth/forgot-password/reset/route.ts`

**Database Fields:**
- `securityQuestion`
- `securityAnswer`
- `employeeId`

---

## 📱 Recommended Implementation: Mobile OTP

### **Why OTP is Better:**
✅ More secure
✅ User-friendly
✅ Industry standard
✅ No need to remember security answers
✅ Real-time verification

### **Implementation Steps:**

#### 1. **Database Schema Update**
```prisma
model User {
  // ... existing fields
  mobileNumber      String?  @unique
  mobileVerified    Boolean  @default(false)
}

model OTPVerification {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  otp           String   // Hashed
  purpose       String   // 'PASSWORD_RESET', 'REGISTRATION', etc.
  expiresAt     DateTime
  verified      Boolean  @default(false)
  attempts      Int      @default(0)
  createdAt     DateTime @default(now())
  
  @@index([userId, purpose])
}
```

#### 2. **SMS Gateway Integration**

**Option A: Dialog Ideamart (Recommended for SL)**
```typescript
// lib/sms.service.ts
import axios from 'axios';

const IDEAMART_API_URL = 'https://api.dialog.lk/sms/send';
const IDEAMART_APP_ID = process.env.IDEAMART_APP_ID;
const IDEAMART_PASSWORD = process.env.IDEAMART_PASSWORD;

export async function sendOTP(mobileNumber: string, otp: string) {
  try {
    const response = await axios.post(IDEAMART_API_URL, {
      applicationId: IDEAMART_APP_ID,
      password: IDEAMART_PASSWORD,
      message: `Your SLTSERP password reset OTP is: ${otp}. Valid for 5 minutes.`,
      destinationAddresses: [mobileNumber]
    });
    return response.data;
  } catch (error) {
    console.error('SMS send error:', error);
    throw error;
  }
}
```

**Option B: Twilio (International)**
```typescript
import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function sendOTP(mobileNumber: string, otp: string) {
  await client.messages.create({
    body: `Your SLTSERP OTP: ${otp}. Valid for 5 minutes.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: mobileNumber
  });
}
```

#### 3. **OTP Generation & Storage**
```typescript
// lib/otp.service.ts
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export function generateOTP(length: number = 6): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function createOTPRecord(
  userId: string,
  purpose: string
): Promise<string> {
  const otp = generateOTP();
  const hashedOTP = await bcrypt.hash(otp, 10);
  
  await prisma.oTPVerification.create({
    data: {
      userId,
      otp: hashedOTP,
      purpose,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    }
  });
  
  return otp; // Return plain OTP to send via SMS
}

export async function verifyOTP(
  userId: string,
  otp: string,
  purpose: string
): Promise<boolean> {
  const record = await prisma.oTPVerification.findFirst({
    where: {
      userId,
      purpose,
      verified: false,
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (!record) return false;

  // Check attempts
  if (record.attempts >= 3) {
    throw new Error('Too many attempts. Please request a new OTP.');
  }

  // Verify OTP
  const isValid = await bcrypt.compare(otp, record.otp);

  if (!isValid) {
    await prisma.oTPVerification.update({
      where: { id: record.id },
      data: { attempts: record.attempts + 1 }
    });
    return false;
  }

  // Mark as verified
  await prisma.oTPVerification.update({
    where: { id: record.id },
    data: { verified: true }
  });

  return true;
}
```

#### 4. **API Endpoints**

**a. Request OTP**
```typescript
// /api/auth/forgot-password/request-otp/route.ts
export async function POST(request: Request) {
  const { username, mobileNumber } = await request.json();
  
  // Verify user
  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, mobileNumber: true }
  });
  
  if (!user || user.mobileNumber !== mobileNumber) {
    return NextResponse.json(
      { message: 'Invalid credentials' },
      { status: 401 }
    );
  }
  
  // Generate & send OTP
  const otp = await createOTPRecord(user.id, 'PASSWORD_RESET');
  await sendOTP(mobileNumber, otp);
  
  return NextResponse.json({
    message: 'OTP sent successfully',
    expiresIn: 300 // 5 minutes
  });
}
```

**b. Verify OTP**
```typescript
// /api/auth/forgot-password/verify-otp/route.ts
export async function POST(request: Request) {
  const { username, otp } = await request.json();
  
  const user = await prisma.user.findUnique({
    where: { username }
  });
  
  if (!user) {
    return NextResponse.json(
      { message: 'User not found' },
      { status: 404 }
    );
  }
  
  const isValid = await verifyOTP(user.id, otp, 'PASSWORD_RESET');
  
  if (!isValid) {
    return NextResponse.json(
      { message: 'Invalid or expired OTP' },
      { status: 401 }
    );
  }
  
  // Generate reset token
  const resetToken = sign(
    { userId: user.id, purpose: 'PASSWORD_RESET' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
  
  return NextResponse.json({ resetToken });
}
```

#### 5. **Frontend Flow**
```typescript
// Step 1: Request OTP
const handleRequestOTP = async () => {
  const res = await fetch('/api/auth/forgot-password/request-otp', {
    method: 'POST',
    body: JSON.stringify({ username, mobileNumber })
  });
  
  if (res.ok) {
    setStep(2); // Show OTP input
    startCountdown(300); // 5 minute countdown
  }
};

// Step 2: Verify OTP
const handleVerifyOTP = async () => {
  const res = await fetch('/api/auth/forgot-password/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ username, otp })
  });
  
  if (res.ok) {
    const { resetToken } = await res.json();
    setResetToken(resetToken);
    setStep(3); // Show password reset form
  }
};

// Step 3: Reset Password (same as current implementation)
```

---

## 🔧 Implementation Checklist

### **Phase 1: Setup**
- [ ] Choose SMS gateway (Dialog Ideamart recommended)
- [ ] Get API credentials
- [ ] Add to `.env`:
  ```
  IDEAMART_APP_ID=your_app_id
  IDEAMART_PASSWORD=your_password
  ```

### **Phase 2: Database**
- [ ] Add `mobileNumber` to User model
- [ ] Create `OTPVerification` model
- [ ] Run `npx prisma db push`

### **Phase 3: Backend**
- [ ] Create `lib/sms.service.ts`
- [ ] Create `lib/otp.service.ts`
- [ ] Create API endpoints:
  - `/api/auth/forgot-password/request-otp`
  - `/api/auth/forgot-password/verify-otp`
  - `/api/auth/forgot-password/reset` (update existing)

### **Phase 4: Frontend**
- [ ] Update forgot password page
- [ ] Add mobile number input
- [ ] Add OTP input with countdown timer
- [ ] Add resend OTP functionality

### **Phase 5: Testing**
- [ ] Test OTP generation
- [ ] Test SMS delivery
- [ ] Test OTP verification
- [ ] Test password reset
- [ ] Test rate limiting
- [ ] Test expiry

---

## 💰 Cost Estimation (Dialog Ideamart)

- **Setup Fee:** ~LKR 5,000 (one-time)
- **Per SMS:** ~LKR 0.25 - 0.50
- **Monthly:** Depends on usage

**Example:**
- 100 password resets/month = ~LKR 50

---

## 🚀 Quick Start (When Ready)

1. **Get Dialog Ideamart Account:**
   - Visit: https://www.ideamart.io/
   - Register as developer
   - Create SMS app
   - Get credentials

2. **Install Dependencies:**
   ```bash
   npm install axios
   ```

3. **Update Schema & Generate:**
   ```bash
   npx prisma db push
   npx prisma generate
   ```

4. **Implement Services & APIs**

5. **Test with Test Numbers**

---

## 📝 Notes

- Current security question implementation can remain as **fallback**
- OTP should be **primary** method
- Keep OTP validity short (5 minutes)
- Limit attempts (3 max)
- Log all OTP requests for security audit
- Consider rate limiting (max 3 OTP requests per hour per user)

---

**Status:** 📋 Ready for implementation when SMS gateway is available
**Estimated Time:** 4-6 hours
**Priority:** High (Security feature)
