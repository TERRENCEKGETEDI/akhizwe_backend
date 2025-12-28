const pool = require('../db');

/**
 * Helper function to fetch fresh user data from database
 * Use this instead of trusting JWT data for financial information
 * 
 * @param {string} email - User email
 * @returns {Object} Fresh user data from database
 */
async function getFreshUserData(email) {
  try {
    const result = await pool.query(
      'SELECT email, full_name, phone, role, wallet_balance, airtime_balance, data_balance, daily_airtime_limit, is_blocked FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    return result.rows[0];
  } catch (error) {
    console.error('Error fetching fresh user data:', error);
    throw error;
  }
}

module.exports = { getFreshUserData };