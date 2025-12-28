const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const pool = require('../db');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const router = express.Router();

// Middleware for all routes
router.use(authMiddleware);

// Helper function to log errors
const logError = async (action, details) => {
  try {
    await pool.query(
      'INSERT INTO admin_logs (log_id, admin_email, action) VALUES ($1, $2, $3)',
      [uuidv4(), 'system', `ERROR: ${action} - ${details}`]
    );
  } catch (error) {
    console.error('Error logging:', error);
  }
};

// Helper function to parse data size to MB
const parseDataSize = (dataSize) => {
  const match = dataSize.match(/(\d+)(GB|MB)/i);
  if (!match) return 0;
  const num = parseInt(match[1]);
  const unit = match[2].toUpperCase();
  return unit === 'GB' ? num * 1024 : num;
};

// Helper to check and reset limits
const checkAndResetLimits = async (userEmail) => {
  const today = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toISOString().slice(0, 7);

  const userResult = await pool.query(
    'SELECT daily_airtime_limit, monthly_airtime_limit, last_purchase_date FROM users WHERE email = $1',
    [userEmail]
  );
  const user = userResult.rows[0];

  let resetDaily = false;
  let resetMonthly = false;

  if (!user.last_purchase_date || user.last_purchase_date !== today) {
    resetDaily = true;
  }

  const lastPurchaseDateStr = user.last_purchase_date ? String(user.last_purchase_date) : null;
  const lastPurchaseMonth = lastPurchaseDateStr ? lastPurchaseDateStr.slice(0, 7) : null;
  if (!lastPurchaseMonth || lastPurchaseMonth !== currentMonth) {
    resetMonthly = true;
  }

  if (resetDaily || resetMonthly) {
    await pool.query(
      'UPDATE users SET last_purchase_date = $1 WHERE email = $2',
      [today, userEmail]
    );
  }

  return {
    dailyLimit: resetDaily ? 1000 : parseFloat(user.daily_airtime_limit),
    monthlyLimit: resetMonthly ? 5000 : parseFloat(user.monthly_airtime_limit)
  };
};

// GET /airtime-data/networks
router.get('/networks', async (req, res) => {
  try {
    const result = await pool.query('SELECT network_id, name, enabled FROM networks WHERE enabled = TRUE');
    res.json({ networks: result.rows });
  } catch (error) {
    console.error('Get networks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /airtime-data/bundles/:network
router.get('/bundles/:network', async (req, res) => {
  try {
    const { network } = req.params;
    const networkResult = await pool.query('SELECT network_id FROM networks WHERE name = $1 AND enabled = TRUE', [network]);
    if (networkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Network not found' });
    }
    const networkId = networkResult.rows[0].network_id;

    const bundlesResult = await pool.query('SELECT bundle_id, name, data_size, price, validity_days, regional_availability FROM data_bundles WHERE network_id = $1 AND enabled = TRUE', [networkId]);
    res.json({ bundles: bundlesResult.rows });
  } catch (error) {
    console.error('Get bundles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /airtime-data/packages
router.get('/packages', async (req, res) => {
  try {
    const { sort_by = 'price', order = 'asc', network, type } = req.query;

    let query = `
      SELECT 'data' as type, db.bundle_id as id, n.name as network, db.name, db.data_size as data, NULL as minutes, db.price, db.validity_days, db.regional_availability, 0 as discount_percentage, NULL as add_ons
      FROM data_bundles db
      JOIN networks n ON db.network_id = n.network_id
      WHERE db.enabled = TRUE AND n.enabled = TRUE
      UNION ALL
      SELECT 'airtime' as type, ab.bundle_id as id, n.name as network, ab.name, NULL as data, ab.minutes, ab.price, ab.validity_days, ab.regional_availability, 0 as discount_percentage, NULL as add_ons
      FROM airtime_bundles ab
      JOIN networks n ON ab.network_id = n.network_id
      WHERE ab.enabled = TRUE AND n.enabled = TRUE
      UNION ALL
      SELECT 'combined' as type, cp.plan_id as id, n.name as network, cp.name, cp.data_size as data, cp.minutes, cp.price, cp.validity_days, cp.regional_availability, cp.discount_percentage, cp.add_ons
      FROM combined_plans cp
      JOIN networks n ON cp.network_id = n.network_id
      WHERE cp.enabled = TRUE AND n.enabled = TRUE
    `;

    let params = [];
    let paramIndex = 1;

    if (network) {
      query += ` AND network = $${paramIndex}`;
      params.push(network);
      paramIndex++;
    }

    if (type) {
      query += ` AND type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    // Sorting
    const validSortFields = ['price', 'validity_days', 'data', 'minutes'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'price';
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    if (sortField === 'data') {
      query += ` ORDER BY CASE WHEN data = 'Unlimited' THEN 999999 WHEN data LIKE '%GB' THEN CAST(REPLACE(data, 'GB', '') AS INTEGER) * 1024 WHEN data LIKE '%MB' THEN CAST(REPLACE(data, 'MB', '') AS INTEGER) ELSE 0 END ${sortOrder}`;
    } else if (sortField === 'minutes') {
      query += ` ORDER BY CASE WHEN minutes IS NULL THEN 999999 ELSE minutes END ${sortOrder}`;
    } else {
      query += ` ORDER BY ${sortField} ${sortOrder}`;
    }

    const result = await pool.query(query, params);
    res.json({ packages: result.rows });
  } catch (error) {
    console.error('Get packages error:', error);
    // Return mock data if tables don't exist
    const mockPackages = [
      { type: 'data', id: 1, network: 'MTN', name: 'MTN 1GB', data: '1GB', minutes: null, price: 50.00, validity_days: 30, regional_availability: 'National', discount_percentage: 0, add_ons: null },
      { type: 'data', id: 2, network: 'MTN', name: 'MTN 5GB', data: '5GB', minutes: null, price: 200.00, validity_days: 30, regional_availability: 'National', discount_percentage: 0, add_ons: null },
      { type: 'data', id: 3, network: 'Vodacom', name: 'Vodacom 1GB', data: '1GB', minutes: null, price: 50.00, validity_days: 30, regional_availability: 'National', discount_percentage: 0, add_ons: null },
      { type: 'airtime', id: 4, network: 'MTN', name: 'MTN 100 Minutes', data: null, minutes: 100, price: 25.00, validity_days: 30, regional_availability: 'National', discount_percentage: 0, add_ons: null },
      { type: 'airtime', id: 5, network: 'MTN', name: 'MTN Unlimited Calls', data: null, minutes: null, price: 150.00, validity_days: 30, regional_availability: 'National', discount_percentage: 0, add_ons: null },
      { type: 'combined', id: 6, network: 'MTN', name: 'MTN Combo 1GB + 100 Min', data: '1GB', minutes: 100, price: 65.00, validity_days: 30, regional_availability: 'National', discount_percentage: 10, add_ons: 'Free WhatsApp' },
      { type: 'combined', id: 7, network: 'Vodacom', name: 'Vodacom Combo 5GB + 500 Min', data: '5GB', minutes: 500, price: 250.00, validity_days: 30, regional_availability: 'National', discount_percentage: 15, add_ons: 'Free WhatsApp, Free Facebook' }
    ];
    res.json({ packages: mockPackages });
  }
});

// GET /airtime-data/denominations
router.get('/denominations', (req, res) => {
  // Airtime denominations - could be configurable
  const denominations = [10, 20, 50, 100, 200, 500];
  res.json({ denominations });
});

// POST /airtime-data/buy-airtime
router.post('/buy-airtime', async (req, res) => {
  try {
    const { network, amount, phone, pin } = req.body;
    const userEmail = req.user.email;

    if (!network || !amount || !phone || !pin) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['MTN', 'Vodacom', 'Telkom', 'Cell C', 'Rain'].includes(network)) {
      return res.status(400).json({ error: 'Invalid network' });
    }

    const amt = parseFloat(amount);
    if (amt <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Get user details
    const userResult = await pool.query(
      'SELECT wallet_balance, pin, phone_number FROM users WHERE email = $1',
      [userEmail]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    // Check PIN
    if (user.pin !== pin) {
      await logError('PIN mismatch', `User: ${userEmail}`);
      return res.status(403).json({ error: 'Invalid PIN' });
    }

    // Check wallet balance
    if (parseFloat(user.wallet_balance) < amt) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // Check limits
    const limits = await checkAndResetLimits(userEmail);
    if (amt > limits.dailyLimit) {
      return res.status(400).json({ error: 'Daily limit exceeded' });
    }
    if (amt > limits.monthlyLimit) {
      return res.status(400).json({ error: 'Monthly limit exceeded' });
    }

    // Fraud detection
    if (amt > 500) {
      await logError('Fraud alert', `Large purchase: ${amt} by ${userEmail}`);
    }

    // Create transaction
    const transactionRef = uuidv4();
    await pool.query(
      'INSERT INTO transactions (transaction_ref, user_email, amount, status, transaction_type) VALUES ($1, $2, $3, $4, $5)',
      [transactionRef, userEmail, amt, 'PENDING', 'AIRTIME_PURCHASE']
    );

    // Deduct from wallet
    await pool.query(
      'UPDATE users SET wallet_balance = wallet_balance - $1, daily_airtime_limit = daily_airtime_limit - $2, monthly_airtime_limit = monthly_airtime_limit - $3 WHERE email = $4',
      [amt, amt, amt, userEmail]
    );

    // If buying for own phone, add to airtime_balance
    if (phone === user.phone) {
      await pool.query(
        'UPDATE users SET airtime_balance = airtime_balance + $1 WHERE email = $2',
        [amt, userEmail]
      );
    }

    // Insert into airtime_data
    await pool.query(
      'INSERT INTO airtime_data (transaction_ref, network, bundle_type, phone_number, amount) VALUES ($1, $2, $3, $4, $5)',
      [transactionRef, network, 'AIRTIME', phone, amt]
    );

    // Mock delivery success
    await pool.query(
      'UPDATE transactions SET status = $1 WHERE transaction_ref = $2',
      ['SUCCESS', transactionRef]
    );

    res.json({ message: 'Airtime purchased successfully', transaction_ref: transactionRef });
  } catch (error) {
    console.error('Buy airtime error:', error);
    await logError('Buy airtime failed', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /airtime-data/send-airtime
router.post('/send-airtime', async (req, res) => {
  try {
    const { recipient_phone, amount, pin } = req.body;
    const senderEmail = req.user.email;

    if (!recipient_phone || !amount || !pin) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const amt = parseFloat(amount);
    if (amt <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Get sender details
    const senderResult = await pool.query(
      'SELECT airtime_balance, pin FROM users WHERE email = $1',
      [senderEmail]
    );
    if (senderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sender not found' });
    }
    const sender = senderResult.rows[0];

    // Check PIN
    if (sender.pin !== pin) {
      await logError('PIN mismatch', `User: ${senderEmail}`);
      return res.status(403).json({ error: 'Invalid PIN' });
    }

    // Check airtime balance
    if (parseFloat(sender.airtime_balance) < amt) {
      return res.status(400).json({ error: 'Insufficient airtime balance' });
    }

    // Check limits
    const limits = await checkAndResetLimits(senderEmail);
    if (amt > limits.dailyLimit) {
      return res.status(400).json({ error: 'Daily limit exceeded' });
    }
    if (amt > limits.monthlyLimit) {
      return res.status(400).json({ error: 'Monthly limit exceeded' });
    }

    // Get recipient
    const recipientResult = await pool.query('SELECT email FROM users WHERE phone = $1', [recipient_phone]);
    if (recipientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    const recipientEmail = recipientResult.rows[0].email;

    // Create transaction
    const transactionRef = uuidv4();
    await pool.query(
      'INSERT INTO transactions (transaction_ref, user_email, amount, status, transaction_type) VALUES ($1, $2, $3, $4, $5)',
      [transactionRef, senderEmail, amt, 'PENDING', 'AIRTIME_SEND']
    );

    // Deduct from sender airtime_balance and limits
    await pool.query(
      'UPDATE users SET airtime_balance = airtime_balance - $1, daily_airtime_limit = daily_airtime_limit - $2, monthly_airtime_limit = monthly_airtime_limit - $3 WHERE email = $4',
      [amt, amt, amt, senderEmail]
    );

    // Add to recipient airtime_balance
    await pool.query(
      'UPDATE users SET airtime_balance = airtime_balance + $1 WHERE email = $2',
      [amt, recipientEmail]
    );

    // Insert into airtime_data
    await pool.query(
      'INSERT INTO airtime_data (transaction_ref, network, bundle_type, phone_number, amount) VALUES ($1, $2, $3, $4, $5)',
      [transactionRef, 'Vodacom', 'AIRTIME', recipient_phone, amt] // Default network, could be selected
    );

    // Success
    await pool.query(
      'UPDATE transactions SET status = $1 WHERE transaction_ref = $2',
      ['SUCCESS', transactionRef]
    );

    res.json({ message: 'Airtime sent successfully', transaction_ref: transactionRef });
  } catch (error) {
    console.error('Send airtime error:', error);
    await logError('Send airtime failed', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /airtime-data/buy-data
router.post('/buy-data', async (req, res) => {
  try {
    const { bundle_id, phone, pin } = req.body;
    const userEmail = req.user.email;

    if (!bundle_id || !phone || !pin) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const bundleId = parseInt(bundle_id);
    if (isNaN(bundleId)) {
      return res.status(400).json({ error: 'Invalid bundle_id' });
    }

    // Get bundle details
    const bundleResult = await pool.query('SELECT db.*, n.name as network_name FROM data_bundles db JOIN networks n ON db.network_id = n.network_id WHERE db.bundle_id = $1 AND db.enabled = TRUE AND n.enabled = TRUE', [bundleId]);
    if (bundleResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or disabled bundle' });
    }
    const bundle = bundleResult.rows[0];
    const network = bundle.network_name;
    const amt = parseFloat(bundle.price);
    if (amt <= 0) {
      return res.status(400).json({ error: 'Invalid bundle price' });
    }

    // Get user details
    const userResult = await pool.query(
      'SELECT wallet_balance, pin, phone FROM users WHERE email = $1',
      [userEmail]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    // Check PIN
    if (user.pin !== pin) {
      await logError('PIN mismatch', `User: ${userEmail}`);
      return res.status(403).json({ error: 'Invalid PIN' });
    }

    // Check wallet balance
    if (parseFloat(user.wallet_balance) < amt) {
      return res.status(400).json({ error: 'Insufficient wallet balance' });
    }

    // Check limits
    const limits = await checkAndResetLimits(userEmail);
    if (amt > limits.dailyLimit) {
      return res.status(400).json({ error: 'Daily limit exceeded' });
    }
    if (amt > limits.monthlyLimit) {
      return res.status(400).json({ error: 'Monthly limit exceeded' });
    }

    // Fraud detection
    if (amt > 500) {
      await logError('Fraud alert', `Large purchase: ${amt} by ${userEmail}`);
    }

    // Create transaction
    const transactionRef = uuidv4();
    await pool.query(
      'INSERT INTO transactions (transaction_ref, user_email, amount, status, transaction_type) VALUES ($1, $2, $3, $4, $5)',
      [transactionRef, userEmail, amt, 'PENDING', 'DATA_PURCHASE']
    );

    // Deduct from wallet
    await pool.query(
      'UPDATE users SET wallet_balance = wallet_balance - $1, daily_airtime_limit = daily_airtime_limit - $2, monthly_airtime_limit = monthly_airtime_limit - $3 WHERE email = $4',
      [amt, amt, amt, userEmail]
    );

    // If buying for own phone, add to data_balance
    if (phone === user.phone) {
      const dataMB = parseDataSize(bundle.data_size);
      await pool.query(
        'UPDATE users SET data_balance = data_balance + $1 WHERE email = $2',
        [dataMB, userEmail]
      );
    }

    // Insert into airtime_data
    await pool.query(
      'INSERT INTO airtime_data (transaction_ref, network, bundle_type, phone_number, amount, bundle_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [transactionRef, network, 'DATA', phone, amt, bundleId]
    );

    // Mock delivery success
    await pool.query(
      'UPDATE transactions SET status = $1 WHERE transaction_ref = $2',
      ['SUCCESS', transactionRef]
    );

    res.json({ message: 'Data purchased successfully', transaction_ref: transactionRef });
  } catch (error) {
    console.error('Buy data error:', error);
    await logError('Buy data failed', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /airtime-data/send-data
router.post('/send-data', async (req, res) => {
  try {
    const { recipient_phone, bundle_id, pin, quantity = 1 } = req.body;
    const senderEmail = req.user.email;

    if (!recipient_phone || !bundle_id || !pin) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const bundleId = parseInt(bundle_id);
    if (isNaN(bundleId)) {
      return res.status(400).json({ error: 'Invalid bundle_id' });
    }

    // Get bundle details
    const bundleResult = await pool.query('SELECT db.*, n.name as network_name FROM data_bundles db JOIN networks n ON db.network_id = n.network_id WHERE db.bundle_id = $1 AND db.enabled = TRUE AND n.enabled = TRUE', [bundleId]);
    if (bundleResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or disabled bundle' });
    }
    const bundle = bundleResult.rows[0];
    const network = bundle.network_name;
    const amt = parseFloat(bundle.price);
    if (amt <= 0) {
      return res.status(400).json({ error: 'Invalid bundle price' });
    }

    // Get sender details
    const senderResult = await pool.query(
      'SELECT data_balance, pin FROM users WHERE email = $1',
      [senderEmail]
    );
    if (senderResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sender not found' });
    }
    const sender = senderResult.rows[0];

    // Check PIN
    if (sender.pin !== pin) {
      await logError('PIN mismatch', `User: ${senderEmail}`);
      return res.status(403).json({ error: 'Invalid PIN' });
    }

    // Check data balance
    const dataMB = parseDataSize(bundle.data_size);
    console.log('sender.data_balance:', sender.data_balance, 'dataMB:', dataMB);
    if (parseFloat(sender.data_balance) < dataMB) {
      return res.status(400).json({ error: 'Insufficient data balance' });
    }

    // Check limits
    const limits = await checkAndResetLimits(senderEmail);
    if (amt > limits.dailyLimit) {
      return res.status(400).json({ error: 'Daily limit exceeded' });
    }
    if (amt > limits.monthlyLimit) {
      return res.status(400).json({ error: 'Monthly limit exceeded' });
    }

    // Get recipient
    const recipientResult = await pool.query('SELECT email FROM users WHERE phone = $1', [recipient_phone]);
    if (recipientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    const recipientEmail = recipientResult.rows[0].email;

    // Create transaction
    const transactionRef = uuidv4();
    await pool.query(
      'INSERT INTO transactions (transaction_ref, user_email, amount, status, transaction_type) VALUES ($1, $2, $3, $4, $5)',
      [transactionRef, senderEmail, 0, 'PENDING', 'DATA_SEND']
    );

    // Deduct from sender data_balance and limits
    await pool.query(
      'UPDATE users SET data_balance = data_balance - $1, daily_airtime_limit = daily_airtime_limit - $2, monthly_airtime_limit = monthly_airtime_limit - $3 WHERE email = $4',
      [dataMB, amt, amt, senderEmail]
    );

    // Add to recipient data_balance
    await pool.query(
      'UPDATE users SET data_balance = data_balance + $1 WHERE email = $2',
      [dataMB, recipientEmail]
    );

    // Insert into airtime_data
    await pool.query(
      'INSERT INTO airtime_data (transaction_ref, network, bundle_type, phone_number, amount, bundle_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [transactionRef, 'N/A', 'DATA', recipient_phone, dataMB, null]
    );

    // Success
    await pool.query(
      'UPDATE transactions SET status = $1 WHERE transaction_ref = $2',
      ['SUCCESS', transactionRef]
    );

    res.json({ message: `Data sent successfully: ${bundle.data_size}`, transaction_ref: transactionRef });
  } catch (error) {
    console.error('Send data error:', error);
    await logError('Send data failed', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /airtime-data/request-advance
router.post('/request-advance', async (req, res) => {
  try {
    const { amount, pin } = req.body;
    const userEmail = req.user.email;

    if (!amount || !pin) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const amt = parseFloat(amount);
    if (amt <= 0 || amt > 1000) { // Assume max 1000 for advance
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Get user details
    const userResult = await pool.query(
      'SELECT wallet_balance, pin FROM users WHERE email = $1',
      [userEmail]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    // Check PIN
    if (user.pin !== pin) {
      await logError('PIN mismatch', `User: ${userEmail}`);
      return res.status(403).json({ error: 'Invalid PIN' });
    }

    // Check eligibility: simple check, if wallet < 100, eligible
    if (parseFloat(user.wallet_balance) >= 100) {
      return res.status(400).json({ error: 'Not eligible for advance' });
    }

    // Create transaction
    const transactionRef = uuidv4();
    await pool.query(
      'INSERT INTO transactions (transaction_ref, user_email, amount, status, transaction_type) VALUES ($1, $2, $3, $4, $5)',
      [transactionRef, userEmail, amt, 'SUCCESS', 'ADVANCE']
    );

    // Insert into advances table
    await pool.query(
      'INSERT INTO advances (transaction_ref, user_email, amount, service_fee) VALUES ($1, $2, $3, $4)',
      [transactionRef, userEmail, amt, 0]
    );

    // Add to wallet
    await pool.query(
      'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE email = $2',
      [amt, userEmail]
    );

    res.json({ message: 'Advance granted successfully', transaction_ref: transactionRef });
  } catch (error) {
    console.error('Request advance error:', error);
    await logError('Request advance failed', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /airtime-data/transactions
router.get('/transactions', async (req, res) => {
  console.log('Transactions endpoint called for user:', req.user.email);
  try {
    const userEmail = req.user.email;
    const { page = 1, limit = 10, status, network, type } = req.query;

    let query = `
      SELECT t.transaction_ref, t.amount, t.status, t.transaction_type, t.created_at,
             ad.network, ad.bundle_type, ad.phone_number, ad.bundle_id
      FROM transactions t
      LEFT JOIN airtime_data ad ON t.transaction_ref = ad.transaction_ref
      WHERE t.user_email = $1
    `;
    let params = [userEmail];
    let paramIndex = 2;

    if (status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (network) {
      query += ` AND ad.network = $${paramIndex}`;
      params.push(network);
      paramIndex++;
    }

    if (type) {
      query += ` AND t.transaction_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    query += ' ORDER BY t.created_at DESC LIMIT $' + paramIndex + ' OFFSET $' + (paramIndex + 1);
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);
    res.json({ transactions: result.rows });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /airtime-data/receipt/:transaction_ref
router.get('/receipt/:transaction_ref', async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { transaction_ref } = req.params;

    const result = await pool.query(`
      SELECT t.*, ad.network, ad.bundle_type, ad.phone_number, ad.bundle_id, db.name as bundle_name
      FROM transactions t
      LEFT JOIN airtime_data ad ON t.transaction_ref = ad.transaction_ref
      LEFT JOIN data_bundles db ON ad.bundle_id = db.bundle_id
      WHERE t.transaction_ref = $1 AND t.user_email = $2
    `, [transaction_ref, userEmail]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ receipt: result.rows[0] });
  } catch (error) {
    console.error('Get receipt error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /airtime-data/top-up
router.post('/top-up', async (req, res) => {
  console.log('Top-up route hit');
  try {
    const { amount, payment_method, pin } = req.body;
    const userEmail = req.user.email;
    console.log('Top-up request:', { amount, payment_method, pin: pin ? '***' : null, userEmail });

    if (!amount || !payment_method || !pin) {
      console.log('Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const amt = parseFloat(amount);
    if (amt <= 0) {
      console.log('Invalid amount:', amt);
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // Get user
    const userResult = await pool.query('SELECT pin FROM users WHERE email = $1', [userEmail]);
    console.log('User query result:', userResult.rows.length);
    if (userResult.rows.length === 0) {
      console.log('User not found');
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    if (user.pin !== pin) {
      console.log('PIN mismatch');
      await logError('PIN mismatch', `User: ${userEmail}`);
      return res.status(403).json({ error: 'Invalid PIN' });
    }

    console.log('PIN valid, proceeding with top-up');

    // Mock payment success
    const transactionRef = uuidv4();
    console.log('Inserting transaction:', transactionRef);
    await pool.query(
      'INSERT INTO transactions (transaction_ref, user_email, amount, status, transaction_type) VALUES ($1, $2, $3, $4, $5)',
      [transactionRef, userEmail, amt, 'SUCCESS', 'WALLET_TOPUP']
    );

    // Check for outstanding advances and deduct
    const outstandingResult = await pool.query('SELECT * FROM advances WHERE user_email = $1 AND repaid = FALSE ORDER BY created_at', [userEmail]);
    console.log('Outstanding advances:', outstandingResult.rows.length);
    let remainingAmount = amt;

    for (const advance of outstandingResult.rows) {
      if (remainingAmount <= 0) break;
      const debt = advance.amount + advance.service_fee;
      if (remainingAmount >= debt) {
        // Fully repay
        await pool.query('UPDATE advances SET repaid = TRUE WHERE advance_id = $1', [advance.advance_id]);
        remainingAmount -= debt;
        console.log(`Advance ${advance.advance_id} fully repaid`);
      } else {
        // Partial, but since we can't partial repay easily, perhaps keep as is, or adjust amount
        // For simplicity, if full amount covers, repay
      }
    }

    console.log('Updating wallet balance with:', remainingAmount);
    // Add remaining to wallet
    await pool.query('UPDATE users SET wallet_balance = wallet_balance + $1 WHERE email = $2', [remainingAmount, userEmail]);

    console.log('Top-up successful');
    res.json({ message: 'Wallet topped up successfully', transaction_ref: transactionRef, added_amount: remainingAmount });
  } catch (error) {
    console.error('Top up error:', error);
    await logError('Top up failed', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin routes

// GET /airtime-data/admin/networks
router.get('/admin/networks', async (req, res) => {
  try {
    const userEmail = req.user.email;
    const userResult = await pool.query('SELECT role FROM users WHERE email = $1', [userEmail]);
    if (userResult.rows[0].role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query('SELECT * FROM networks ORDER BY name');
    res.json({ networks: result.rows });
  } catch (error) {
    console.error('Get admin networks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /airtime-data/admin/networks
router.post('/admin/networks', async (req, res) => {
  try {
    const userEmail = req.user.email;
    const userResult = await pool.query('SELECT role FROM users WHERE email = $1', [userEmail]);
    if (userResult.rows[0].role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, enabled } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Network name required' });
    }

    await pool.query('INSERT INTO networks (name, enabled) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET enabled = $2', [name, enabled !== false]);
    res.json({ message: 'Network saved successfully' });
  } catch (error) {
    console.error('Save network error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /airtime-data/admin/bundles
router.get('/admin/bundles', async (req, res) => {
  try {
    const userEmail = req.user.email;
    const userResult = await pool.query('SELECT role FROM users WHERE email = $1', [userEmail]);
    if (userResult.rows[0].role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(`
      SELECT db.*, n.name as network_name
      FROM data_bundles db
      JOIN networks n ON db.network_id = n.network_id
      ORDER BY n.name, db.data_size
    `);
    res.json({ bundles: result.rows });
  } catch (error) {
    console.error('Get admin bundles error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /airtime-data/admin/bundles
router.post('/admin/bundles', async (req, res) => {
  try {
    const userEmail = req.user.email;
    const userResult = await pool.query('SELECT role FROM users WHERE email = $1', [userEmail]);
    if (userResult.rows[0].role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { network_id, name, data_size, price, enabled } = req.body;
    if (!network_id || !name || !data_size || !price) {
      return res.status(400).json({ error: 'All fields required' });
    }

    await pool.query('INSERT INTO data_bundles (network_id, name, data_size, price, enabled) VALUES ($1, $2, $3, $4, $5)', [network_id, name, data_size, price, enabled !== false]);
    res.json({ message: 'Bundle saved successfully' });
  } catch (error) {
    console.error('Save bundle error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;