/**
 * Cryptographically Secure OTP Utility
 */

const crypto = require("crypto");

/**
 * Generates a 6-digit numeric OTP using crypto.randomInt
 * @returns {string} 6-digit OTP string
 */
const generateSixDigitOtp = () => {
  return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Hashes an OTP with SHA-256 before storage
 * @param {string} otp
 * @returns {string} Hex encoded hash
 */
const hashOtp = (otp) => {
  return crypto.createHash("sha256").update(String(otp).trim()).digest("hex");
};

/**
 * Verifies a candidate OTP against stored hash
 * @param {string} candidateOtp
 * @param {string} storedHash
 * @returns {boolean}
 */
const verifyOtpHash = (candidateOtp, storedHash) => {
  if (!candidateOtp || !storedHash) {return false;}
  const candidateHash = hashOtp(candidateOtp);
  return crypto.timingSafeEqual(Buffer.from(candidateHash, "hex"), Buffer.from(storedHash, "hex"));
};

module.exports = {
  generateSixDigitOtp,
  hashOtp,
  verifyOtpHash
};
