const express = require('express');
const router = express.Router();
const prisma = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const admin = await prisma.adminUser.findUnique({ where: { username } });
        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, admin.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: admin.id, username: admin.username, role: admin.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            admin: {
                id: admin.id,
                username: admin.username,
                name: admin.name,
                role: admin.role
            }
        });
    } catch (error) {
        console.error('Login failed:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Forgot Password - Validate Recovery Key or Username
router.post('/forgot-password', async (req, res) => {
    try {
        const { username, recoveryKey } = req.body;
        
        const admin = await prisma.adminUser.findFirst({
            where: { 
                username,
                recoveryKey: recoveryKey.toUpperCase()
            }
        });

        if (!admin) {
            return res.status(401).json({ error: 'الاسم أو مفتاح الاسترداد غير صحيح' });
        }

        // Generate temporary reset token
        const token = Math.random().toString(36).substring(7);
        await prisma.adminUser.update({
            where: { id: admin.id },
            data: {
                resetPasswordToken: token,
                resetPasswordExpires: new Date(Date.now() + 15 * 60 * 1000) // 15 mins
            }
        });

        res.json({ token, message: 'مفتاح الاسترداد صحيح. يمكنك الآن تعيين كلمة مرور جديدة.' });
    } catch (error) {
        res.status(500).json({ error: 'عذراً، فشلت العملية' });
    }
});

// Reset Password Completion
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        
        const admin = await prisma.adminUser.findFirst({
            where: {
                resetPasswordToken: token,
                resetPasswordExpires: { gt: new Date() }
            }
        });

        if (!admin) {
            return res.status(400).json({ error: 'انتهت صلاحية الجلسة أو الكود غير صالح' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.adminUser.update({
            where: { id: admin.id },
            data: {
                passwordHash: hashedPassword,
                resetPasswordToken: null,
                resetPasswordExpires: null
            }
        });

        res.json({ message: 'تم تغيير كلمة المرور بنجاح' });
    } catch (error) {
        res.status(500).json({ error: 'فشل تحديث كلمة المرور' });
    }
});

module.exports = router;
