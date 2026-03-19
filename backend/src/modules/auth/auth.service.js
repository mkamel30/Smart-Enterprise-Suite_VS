const db = require('../../../db');
const jwt = require('jsonwebtoken');
const { logAction } = require('../../../utils/logger');
const passwordPolicy = require('../../../utils/passwordPolicy');

const getJwtSecret = () => process.env.JWT_SECRET;
const getRefreshSecret = () => process.env.JWT_REFRESH_SECRET || (getJwtSecret() + '_refresh');

function ApiError(message, status = 500) {
    const e = new Error(message);
    e.statusCode = status;
    return e;
}

async function getProfile(userId) {
    // RULE 1: Must include branchId filter
    const user = await db.user.findFirst({
        where: { id: userId },
        include: { branch: true }
    });
    if (!user) throw ApiError('User not found', 404);

    // Support hierarchy
    let authorizedBranchIds = [];
    if (user.branchId) {
        authorizedBranchIds.push(user.branchId);
        const children = await db.branch.findMany({
            where: { parentBranchId: user.branchId },
            select: { id: true }
        });
        authorizedBranchIds.push(...(children || []).map(c => c.id));
    }

    // Check password expiration status
    const passwordStatus = {
        isExpired: passwordPolicy.isPasswordExpired(user.passwordChangedAt),
        daysUntilExpiration: passwordPolicy.getDaysUntilExpiration(user.passwordChangedAt),
        mustChange: user.mustChangePassword
    };

    return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        branchId: user.branchId,
        branchType: user.branch?.type,
        authorizedBranchIds,
        theme: user.theme,
        fontFamily: user.fontFamily,
        passwordStatus
    };
}

async function updatePreferences(userId, { theme, fontFamily }) {
    // RULE 1: Use updateMany with branchId filter, then fetch result
    await db.user.update({
        where: { id: userId },
        data: { theme: theme || undefined, fontFamily: fontFamily || undefined }
    });
    const user = await db.user.findUnique({ where: { id: userId } });
    return { theme: user?.theme, fontFamily: user?.fontFamily };
}

async function changePassword(userId, currentPassword, newPassword) {
    // RULE 1: Must include branchId filter
    const user = await db.user.findUnique({
        where: { id: userId }
    });
    if (!user) throw ApiError('User not found', 404);

    // Validate current password
    let validPassword = false;
    if (user.password) {
        validPassword = await passwordPolicy.verifyPassword(currentPassword, user.password);
    } else {
        // Legacy users with default password
        validPassword = currentPassword === '123456';
        if (validPassword) {
            const hashedPassword = await passwordPolicy.hashPassword(currentPassword);
            await db.user.updateMany({
                where: { id: user.id, branchId: { not: null } },
                data: { password: hashedPassword, passwordChangedAt: new Date() }
            });
        }
    }

    if (!validPassword) throw ApiError('Current password is incorrect', 400);

    // Validate new password against policy
    const validation = passwordPolicy.validatePasswordStrength(newPassword);
    if (!validation.isValid) {
        throw ApiError(`Password does not meet security requirements: ${validation.errors.join(', ')}`, 400);
    }

    // Check if password was used before (prevent reuse)
    const isReused = await passwordPolicy.isPasswordInHistory(userId, newPassword);
    if (isReused) {
        throw ApiError('Cannot reuse a previous password. Please choose a different password.', 400);
    }

    // Hash and save new password
    const hashed = await passwordPolicy.hashPassword(newPassword);
    await db.user.updateMany({
        where: { id: userId, branchId: { not: null } },
        data: {
            password: hashed,
            passwordChangedAt: new Date(),
            mustChangePassword: false
        }
    });

    // Save to password history
    await passwordPolicy.savePasswordToHistory(userId, hashed);

    // Log password change
    await logAction({
        entityType: 'USER',
        entityId: user.id,
        action: 'PASSWORD_CHANGE',
        details: 'User changed their password',
        userId: user.id,
        performedBy: user.displayName,
        branchId: user.branchId
    });

    return {
        message: 'تم تغيير كلمة المرور بنجاح',
        strength: validation.strength,
        strengthLabel: passwordPolicy.getPasswordStrengthLabel(validation.strength)
    };
}

async function login({ identifier, password, branchId: requestedBranchId, mfaToken = null }) {
    if (!getJwtSecret()) throw ApiError('JWT secret not configured', 500);

    // RULE 1: Must include branchId filter for login lookup
    const user = await db.user.findFirst({
        where: {
            OR: [{ email: identifier }, { uid: identifier }, { username: identifier }]
        },
        include: { branch: true }
    });
    if (!user) {
        throw ApiError('المستخدم غير موجود', 401);
    }

    // Check if user is active
    if (user.isActive === false) {
        throw ApiError('الحساب معطل. يرجى التواصل مع مسؤول النظام.', 403);
    }

    // Check account lockout status
    const lockoutStatus = await passwordPolicy.checkAccountLockout(user.id);
    if (lockoutStatus.isLocked) {
        const lockedUntil = new Date(lockoutStatus.lockedUntil);
        const minutesRemaining = Math.ceil((lockedUntil - new Date()) / (1000 * 60));
        throw ApiError(
            `Account is locked due to too many failed attempts. Try again in ${minutesRemaining} minutes.`,
            403
        );
    }

    // Validate password
    let validPassword = false;
    if (user.password) {
        validPassword = await passwordPolicy.verifyPassword(password, user.password);
    } else {
        // Legacy users with default password
        validPassword = password === '123456';
        if (validPassword) {
            const hashedPassword = await passwordPolicy.hashPassword(password);
            await db.user.updateMany({
                where: { id: user.id, branchId: { not: null } },
                data: { password: hashedPassword, passwordChangedAt: new Date() }
            });
        }
    }

    if (!validPassword) {
        // Record failed attempt
        const attemptStatus = await passwordPolicy.recordFailedAttempt(user.id);

        if (attemptStatus.isLocked) {
            throw ApiError(
                `Account locked due to too many failed attempts. Try again in ${PASSWORD_POLICY.lockoutDurationMinutes} minutes.`,
                403
            );
        }

        throw ApiError(
            `البريد الإلكتروني أو كلمة المرور غير صحيحة. ${attemptStatus.remainingAttempts} attempts remaining.`,
            401
        );
    }

    let sessionBranchId = user.branchId;
    if (!sessionBranchId && requestedBranchId) sessionBranchId = requestedBranchId;

    // Check password expiration
    const isPasswordExpired = passwordPolicy.isPasswordExpired(user.passwordChangedAt);
    const daysUntilExpiration = passwordPolicy.getDaysUntilExpiration(user.passwordChangedAt);

    // MFA Check - if MFA is enabled, require MFA verification
    if (user.mfaEnabled) {
        // If no MFA token provided, return partial auth requiring MFA
        if (!mfaToken) {
            // Generate a temporary token for MFA verification (short-lived)
            const mfaTempToken = jwt.sign({
                id: user.id,
                email: user.email,
                role: user.role,
                displayName: user.displayName,
                branchId: sessionBranchId,
                mfaRequired: true,
                mfaVerified: false
            }, getJwtSecret(), { expiresIn: '5m' });

            return {
                mfaRequired: true,
                mfaTempToken,
                user: {
                    id: user.id,
                    email: user.email,
                    displayName: user.displayName,
                    mfaEnabled: true
                },
                message: 'Please provide MFA code to complete login'
            };
        }

        // MFA token provided - verify it using mfaService
        const { verifyMFALogin } = require('./mfa.service.js');
        const mfaResult = await verifyMFALogin(user.id, mfaToken);

        if (!mfaResult.verified) {
            throw ApiError('Invalid MFA code', 401);
        }
    }

    // Reset failed attempts on successful login
    await passwordPolicy.resetFailedAttempts(user.id);

    // Update login tracking
    await db.user.updateMany({
        where: { id: user.id },
        data: {
            lastLoginAt: new Date(),
            loginCount: { increment: 1 }
        }
    });

    const token = jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
        displayName: user.displayName,
        branchId: sessionBranchId,
        mfaVerified: user.mfaEnabled || false
    }, getJwtSecret(), { expiresIn: '1h' }); // Short-lived access token

    // Generate Refresh Token
    const refreshToken = jwt.sign({ id: user.id }, getRefreshSecret(), { expiresIn: '7d' });

    // Save refresh token to DB
    await db.refreshToken.create({
        data: {
            token: refreshToken,
            userId: user.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        }
    });

    // Support hierarchy
    let authorizedBranchIds = [];
    if (sessionBranchId) {
        authorizedBranchIds.push(sessionBranchId);
        const children = await db.branch.findMany({
            where: { parentBranchId: sessionBranchId },
            select: { id: true }
        });
        authorizedBranchIds.push(...(children || []).map(c => c.id));
    }

    await logAction({
        entityType: 'USER',
        entityId: user.id,
        action: 'LOGIN',
        details: `User logged in to ${sessionBranchId ? 'branch ' + sessionBranchId : 'Global'}`,
        userId: user.id,
        performedBy: user.displayName,
        branchId: sessionBranchId
    });

    const resultUser = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        name: user.displayName,
        branchId: sessionBranchId,
        branchType: user.branch?.type,
        authorizedBranchIds,
        theme: user.theme,
        fontFamily: user.fontFamily,
        mfaEnabled: user.mfaEnabled || false,
        passwordStatus: {
            isExpired: isPasswordExpired,
            daysUntilExpiration: daysUntilExpiration,
            mustChange: user.mustChangePassword || isPasswordExpired
        }
    };

    return {
        token,
        refreshToken,
        user: resultUser,
        mfaRequired: false,
        warnings: isPasswordExpired ? ['Your password has expired. Please change it immediately.'] :
            daysUntilExpiration <= 7 ? [`Your password will expire in ${daysUntilExpiration} days. Please change it soon.`] : []
    };
}

/**
 * Refresh access token using a valid refresh token
 */
async function refreshAccessToken(refreshToken) {
    if (!refreshToken) throw ApiError('Refresh token required', 401);

    try {
        const decoded = jwt.verify(refreshToken, getRefreshSecret());

        // Verify token exists in DB
        const savedToken = await db.refreshToken.findUnique({
            where: { token: refreshToken },
            include: { user: { include: { branch: true } } }
        });

        if (!savedToken || savedToken.expiresAt < new Date()) {
            if (savedToken) await db.refreshToken.delete({ where: { id: savedToken.id } });
            throw ApiError('Invalid or expired refresh token', 401);
        }

        const user = savedToken.user;
        const sessionBranchId = user.branchId;

        const token = jwt.sign({
            id: user.id,
            email: user.email,
            role: user.role,
            displayName: user.displayName,
            branchId: sessionBranchId,
            mfaVerified: user.mfaEnabled || false
        }, getJwtSecret(), { expiresIn: '1h' });

        return { token, user: { id: user.id, email: user.email, role: user.role, displayName: user.displayName, branchId: sessionBranchId } };
    } catch (error) {
        throw ApiError('Invalid refresh token', 401);
    }
}

/**
 * Admin function to force password change for a user
 * @param {string} adminUserId - Admin user ID performing the action
 * @param {string} targetUserId - User ID to force password change
 * @returns {Promise<Object>} - Result
 */
async function forcePasswordChange(adminUserId, targetUserId) {
    const admin = await db.user.findFirst({
        where: { id: adminUserId, branchId: { not: null } }
    });

    if (!admin || !['ADMIN', 'SUPER_ADMIN'].includes(admin.role)) {
        throw ApiError('Admin access required', 403);
    }

    const targetUser = await db.user.findFirst({
        where: { id: targetUserId, branchId: { not: null } }
    });

    if (!targetUser) {
        throw ApiError('Target user not found', 404);
    }

    await db.user.updateMany({
        where: { id: targetUserId },
        data: { mustChangePassword: true }
    });

    await logAction({
        entityType: 'USER',
        entityId: targetUserId,
        action: 'FORCE_PASSWORD_CHANGE',
        details: `Admin forced password change for user ${targetUser.email}`,
        userId: adminUserId,
        performedBy: admin.displayName,
        branchId: admin.branchId
    });

    return {
        message: 'User must change password on next login',
        userId: targetUserId,
        userEmail: targetUser.email
    };
}

/**
 * Admin function to unlock a locked account
 * @param {string} adminUserId - Admin user ID performing the action
 * @param {string} targetUserId - User ID to unlock
 * @returns {Promise<Object>} - Result
 */
async function unlockAccount(adminUserId, targetUserId) {
    const admin = await db.user.findFirst({
        where: { id: adminUserId, branchId: { not: null } }
    });

    if (!admin || !['ADMIN', 'SUPER_ADMIN'].includes(admin.role)) {
        throw ApiError('Admin access required', 403);
    }

    const targetUser = await db.user.findFirst({
        where: { id: targetUserId, branchId: { not: null } }
    });

    if (!targetUser) {
        throw ApiError('Target user not found', 404);
    }

    await passwordPolicy.resetFailedAttempts(targetUserId);

    await logAction({
        entityType: 'USER',
        entityId: targetUserId,
        action: 'ACCOUNT_UNLOCK',
        details: `Admin unlocked account for user ${targetUser.email}`,
        userId: adminUserId,
        performedBy: admin.displayName,
        branchId: admin.branchId
    });

    return {
        message: 'Account unlocked successfully',
        userId: targetUserId,
        userEmail: targetUser.email
    };
}

/**
 * Request a password reset token
 * In this system, since it's likely internal, we log the token for the admin
 * @param {string} identifier - Email, username or UID
 */
async function requestPasswordReset(identifier) {
    const user = await db.user.findFirst({
        where: {
            OR: [{ email: identifier }, { username: identifier }, { uid: identifier }]
        }
    });

    if (!user) {
        // Return success even if user not found for security (timing attacks)
        return { message: 'If an account exists, a reset token has been generated.' };
    }

    // Generate a 6-digit numeric token for ease of use
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 mins

    await db.user.update({
        where: { id: user.id },
        data: {
            resetPasswordToken: token,
            resetPasswordExpires: expires
        }
    });

    // LOG THE TOKEN - In an internal system, the admin can find this in the logs
    // and provide it to the user if no email is configured.
    logAction({
        entityType: 'USER',
        entityId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
        details: `Reset token generated: ${token} (Expires: ${expires})`,
        userId: user.id,
        performedBy: 'SYSTEM'
    });

    console.log(`[AUTH] Password Reset Token for ${user.email}: ${token}`);

    return { 
        message: 'تم إنشاء كود إعادة التعيين. يرجى التواصل مع مسؤول النظام للحصول عليه أو التحقق من بريدك الإلكتروني.',
        token: process.env.NODE_ENV === 'development' ? token : undefined 
    };
}

/**
 * Reset password using a valid token
 */
async function resetPassword(token, newPassword) {
    const user = await db.user.findFirst({
        where: {
            resetPasswordToken: token,
            resetPasswordExpires: { gt: new Date() }
        }
    });

    if (!user) {
        throw ApiError('كود إعادة التعيين غير صالح أو منتهي الصلاحية', 400);
    }

    // Hash and update
    const hashedPassword = await passwordPolicy.hashPassword(newPassword);
    
    await db.user.update({
        where: { id: user.id },
        data: {
            password: hashedPassword,
            resetPasswordToken: null,
            resetPasswordExpires: null,
            passwordChangedAt: new Date(),
            mustChangePassword: false
        }
    });

    await logAction({
        entityType: 'USER',
        entityId: user.id,
        action: 'PASSWORD_RESET_COMPLETED',
        details: 'User successfully reset their password via token',
        userId: user.id,
        performedBy: user.displayName
    });

    return { message: 'تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.' };
}

module.exports = {
    getProfile,
    updatePreferences,
    changePassword,
    login,
    forcePasswordChange,
    unlockAccount,
    refreshAccessToken,
    requestPasswordReset,
    resetPassword
};
