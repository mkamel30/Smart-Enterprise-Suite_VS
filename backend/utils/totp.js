const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');

const ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY || process.env.JWT_SECRET;

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
	throw new Error('MFA_ENCRYPTION_KEY or JWT_SECRET must be at least 32 characters long for MFA encryption');
}

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt a string using AES-256-GCM
 * @param {string} text - Text to encrypt
 * @returns {string} - Encrypted text (base64)
 */
function encrypt(text) {
	if (!text) return null;
	
	const iv = crypto.randomBytes(16);
	const salt = crypto.randomBytes(64);
	const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha512');
	const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
	
	const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
	const authTag = cipher.getAuthTag();
	
	const result = Buffer.concat([salt, iv, authTag, encrypted]);
	return result.toString('base64');
}

/**
 * Decrypt a string using AES-256-GCM
 * @param {string} encryptedText - Encrypted text (base64)
 * @returns {string} - Decrypted text
 */
function decrypt(encryptedText) {
	if (!encryptedText) return null;
	
	try {
		const buffer = Buffer.from(encryptedText, 'base64');
		const salt = buffer.subarray(0, 64);
		const iv = buffer.subarray(64, 80);
		const authTag = buffer.subarray(80, 96);
		const encrypted = buffer.subarray(96);
		
		const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 100000, 32, 'sha512');
		const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
		decipher.setAuthTag(authTag);
		
		const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
		return decrypted.toString('utf8');
	} catch (error) {
		throw new Error('Failed to decrypt MFA secret: ' + error.message);
	}
}

/**
 * Generate a new TOTP secret for a user
 * @param {string} userId - User ID
 * @param {string} email - User email for the QR code
 * @returns {Object} - Secret and OTPAuth URL
 */
function generateSecret(userId, email) {
	const secret = speakeasy.generateSecret({
		length: 32,
		name: `SmartEnterprise:${email}`,
		issuer: 'Smart Enterprise Suite'
	});
	
	return {
		base32: secret.base32,
		otpauth_url: secret.otpauth_url,
		hex: secret.hex
	};
}

/**
 * Generate QR code data URL from OTPAuth URL
 * @param {string} otpauthUrl - OTPAuth URL
 * @returns {Promise<string>} - QR code data URL
 */
async function generateQRCode(otpauthUrl) {
	try {
		const dataUrl = await QRCode.toDataURL(otpauthUrl, {
			width: 400,
			margin: 2,
			color: {
				dark: '#000000',
				light: '#FFFFFF'
			}
		});
		return dataUrl;
	} catch (error) {
		throw new Error('Failed to generate QR code: ' + error.message);
	}
}

/**
 * Verify a TOTP token
 * @param {string} token - User provided token
 * @param {string} secret - Base32 secret (encrypted or plain)
 * @param {boolean} isEncrypted - Whether the secret is encrypted
 * @returns {boolean} - Whether token is valid
 */
function verifyToken(token, secret, isEncrypted = false) {
	if (!token || !secret) return false;
	
	const decryptedSecret = isEncrypted ? decrypt(secret) : secret;
	if (!decryptedSecret) return false;
	
	// Allow 1 step before/after current time for time drift (3 minutes total window)
	return speakeasy.totp.verify({
		secret: decryptedSecret,
		encoding: 'base32',
		token: token,
		window: 1
	});
}

/**
 * Generate backup codes for account recovery
 * @param {number} count - Number of codes to generate (default: 10)
 * @returns {Array} - Array of backup code objects { code, used }
 */
function generateBackupCodes(count = 10) {
	const codes = [];
	for (let i = 0; i < count; i++) {
		// Generate 8 character alphanumeric code
		const code = crypto.randomBytes(6).toString('base64url').substring(0, 8).toUpperCase();
		codes.push({
			code: code,
			used: false,
			createdAt: new Date().toISOString()
		});
	}
	return codes;
}

/**
 * Encrypt backup codes for storage
 * @param {Array} codes - Array of backup code objects
 * @returns {string} - Encrypted JSON string
 */
function encryptBackupCodes(codes) {
	return encrypt(JSON.stringify(codes));
}

/**
 * Decrypt backup codes from storage
 * @param {string} encryptedCodes - Encrypted codes
 * @returns {Array} - Array of backup code objects
 */
function decryptBackupCodes(encryptedCodes) {
	if (!encryptedCodes) return [];
	try {
		const decrypted = decrypt(encryptedCodes);
		return JSON.parse(decrypted);
	} catch (error) {
		return [];
	}
}

/**
 * Validate a backup code
 * @param {string} code - Code to validate
 * @param {string} encryptedCodes - Encrypted backup codes from database
 * @returns {Object} - { valid: boolean, codes: Array } - Updated codes if valid
 */
function validateBackupCode(code, encryptedCodes) {
	if (!code || !encryptedCodes) {
		return { valid: false, codes: null };
	}
	
	const codes = decryptBackupCodes(encryptedCodes);
	const upperCode = code.toUpperCase();
	
	const codeIndex = codes.findIndex(c => c.code === upperCode && !c.used);
	
	if (codeIndex === -1) {
		return { valid: false, codes: null };
	}
	
	// Mark code as used
	codes[codeIndex].used = true;
	codes[codeIndex].usedAt = new Date().toISOString();
	
	return { valid: true, codes };
}

/**
 * Generate a time-based token (for testing)
 * @param {string} secret - Base32 secret
 * @returns {string} - Current TOTP token
 */
function generateToken(secret) {
	return speakeasy.totp({
		secret: secret,
		encoding: 'base32'
	});
}

module.exports = {
	generateSecret,
	generateQRCode,
	verifyToken,
	generateBackupCodes,
	encryptBackupCodes,
	decryptBackupCodes,
	validateBackupCode,
	encrypt,
	decrypt,
	generateToken
};
