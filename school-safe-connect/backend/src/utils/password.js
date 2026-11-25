/**
 * Password Hashing and Comparison Utility
 * Utilizes bcryptjs with cost factor 12.
 */

const bcrypt = require("bcryptjs");

const SALT_ROUNDS = 12;

/**
 * Hashes a plaintext password
 * @param {string} password
 * @returns {Promise<string>}
 */
const hashPassword = async (password) => {
  return await bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Compares plaintext password against hashed password
 * @param {string} plaintext
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
const comparePassword = async (plaintext, hash) => {
  if (!plaintext || !hash) {return false;}
  return await bcrypt.compare(plaintext, hash);
};

module.exports = {
  hashPassword,
  comparePassword
};
