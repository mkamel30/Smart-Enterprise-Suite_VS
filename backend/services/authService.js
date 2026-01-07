const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { logAction } = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;

function ApiError(message, status = 500) {
    const e = new Error(message);
    e.status = status;
    return e;
}

async function getProfile(userId) {
    const user = await db.user.findUnique({ where: { id: userId }, include: { branch: true } });
    if (!user) throw ApiError('User not found', 404);
    return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        branchId: user.branchId,
        branchType: user.branch?.type,
        theme: user.theme,
        fontFamily: user.fontFamily
    };
}

async function updatePreferences(userId, { theme, fontFamily }) {
    const user = await db.user.update({ where: { id: userId }, data: { theme: theme || undefined, fontFamily: fontFamily || undefined } });
    return { theme: user.theme, fontFamily: user.fontFamily };
}

async function changePassword(userId, currentPassword, newPassword) {
    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) throw ApiError('User not found', 404);

    let validPassword = false;
    if (user.password) {
        validPassword = await bcrypt.compare(currentPassword, user.password);
    } else {
        validPassword = currentPassword === '123456';
        if (validPassword) {
            const hashedPassword = await bcrypt.hash(currentPassword, 10);
            await db.user.update({ where: { id: user.id }, data: { password: hashedPassword } });
        }
    }

    if (!validPassword) throw ApiError('Current password is incorrect', 400);

    const hashed = await bcrypt.hash(newPassword, 10);
    await db.user.update({ where: { id: userId }, data: { password: hashed } });
    return { message: 'طھظ… طھط؛ظٹظٹط± ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± ط¨ظ†ط¬ط§ط­' };
}

async function login({ identifier, password, branchId: requestedBranchId }) {
    if (!JWT_SECRET) throw ApiError('JWT secret not configured', 500);

    const user = await db.user.findFirst({ where: { OR: [{ email: identifier }, { uid: identifier }] }, include: { branch: true } });
    if (!user) {
        console.log(`Login failed: User not found for identifier: ${identifier}`);
        throw ApiError('المستخدم غير موجود', 401);
    }

    let validPassword = false;
    if (user.password) {
        validPassword = await bcrypt.compare(password, user.password);
    } else {
        validPassword = password === '123456';
        if (validPassword) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await db.user.update({ where: { id: user.id }, data: { password: hashedPassword } });
        }
    }

    if (!validPassword) {
        console.log(`Login failed: Invalid password for user: ${user.email}`);
        throw ApiError('البريد الإلكتروني أو كلمة المرور غير صحيحة', 401);
    }

    let sessionBranchId = user.branchId;
    if (!sessionBranchId && requestedBranchId) sessionBranchId = requestedBranchId;

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role, displayName: user.displayName, branchId: sessionBranchId }, JWT_SECRET, { expiresIn: '24h' });

    await logAction({ entityType: 'USER', entityId: user.id, action: 'LOGIN', details: `User logged in to ${sessionBranchId ? 'branch ' + sessionBranchId : 'Global'}`, userId: user.id, performedBy: user.displayName, branchId: sessionBranchId });

    const resultUser = {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        name: user.displayName,
        branchId: sessionBranchId,
        branchType: user.branch?.type,
        theme: user.theme,
        fontFamily: user.fontFamily
    };

    return { token, user: resultUser };
}

module.exports = { getProfile, updatePreferences, changePassword, login };
