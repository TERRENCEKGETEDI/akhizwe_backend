const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const pool = require('../db');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const qrcode = require('qrcode');

const router = express.Router();

// Middleware for all ticket routes
router.use(authMiddleware);

// Simple admin check middleware
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'ADMIN' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Helper function to get system settings
const getSystemSetting = async (settingKey) => {
  try {
    const result = await pool.query(
      'SELECT setting_value, setting_type FROM ticket_settings WHERE setting_key = $1',
      [settingKey]
    );
    if (result.rows.length === 0) return null;

    const { setting_value, setting_type } = result.rows[0];
    switch (setting_type) {
      case 'NUMBER': return parseFloat(setting_value);
      case 'BOOLEAN': return setting_value === 'true';
      case 'JSON': return JSON.parse(setting_value);
      default: return setting_value;
    }
  } catch (error) {
    console.error('Error getting system setting:', error);
    return null;
  }
};

// Helper function to check rate limiting
const checkRateLimit = async (userEmail, action = 'purchase') => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  try {
    const result = await pool.query(
      'SELECT COUNT(*) FROM transactions WHERE user_email = $1 AND transaction_type = $2 AND created_at > $3',
      [userEmail, `TICKET_${action.toUpperCase()}`, oneHourAgo]
    );

    const rateLimit = await getSystemSetting('rate_limit_purchases_per_hour') || 5;
    return parseInt(result.rows[0].count) < rateLimit;
  } catch (error) {
    console.error('Error checking rate limit:', error);
    return true; // Allow on error
  }
};

// Helper function to send notification (placeholder - would integrate with SMS/email service)
const sendNotification = async (userEmail, type, message, ticketId = null, transactionRef = null) => {
  try {
    await pool.query(
      'INSERT INTO ticket_notifications (user_email, ticket_id, transaction_ref, notification_type, message) VALUES ($1, $2, $3, $4, $5)',
      [userEmail, ticketId, transactionRef, type, message]
    );
    // In production, this would trigger actual SMS/email sending
    console.log(`Notification sent to ${userEmail}: ${message}`);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};

// Helper function to generate QR code (data URL)
const generateQR = async (data) => {
  try {
    return await qrcode.toDataURL(data);
  } catch (error) {
    console.error('Error generating QR:', error);
    return null;
  }
};

// Helper function to log admin action (for reminders)
const logAdminAction = async (adminEmail, action) => {
  try {
    await pool.query(
      'INSERT INTO admin_logs (log_id, admin_email, action) VALUES ($1, $2, $3)',
      [uuidv4(), adminEmail || 'system', action]
    );
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
};

// GET /tickets/settings - get system settings (admin only)
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ticket_settings ORDER BY setting_key');
    res.json({ settings: result.rows });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /tickets/settings/:key - update system setting (admin only)
router.put('/settings/:key', requireAdmin, async (req, res) => {
  try {
    const { key } = req.params;
    const { value, type = 'STRING' } = req.body;

    await pool.query(
      'UPDATE ticket_settings SET setting_value = $1, setting_type = $2, updated_at = CURRENT_TIMESTAMP WHERE setting_key = $3',
      [value, type, key]
    );

    res.json({ message: 'Setting updated successfully' });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /tickets - list available tickets with advanced filtering
router.get('/', async (req, res) => {
  try {
    const {
      type, date, location, price_min, price_max, search,
      subtype, upcoming_only = 'true', featured_only = 'false'
    } = req.query;

    let query = `
      SELECT *,
      CASE
        WHEN event_date > CURRENT_TIMESTAMP THEN 'UPCOMING'
        WHEN event_date <= CURRENT_TIMESTAMP AND (end_date IS NULL OR end_date >= CURRENT_TIMESTAMP) THEN 'ONGOING'
        ELSE 'EXPIRED'
      END as status_display
      FROM tickets
      WHERE available_quantity > 0
      AND (status IS NULL OR status = 'ACTIVE')
    `;

    const params = [];
    let paramIndex = 1;

    // Hide expired tickets by default
    if (upcoming_only === 'true') {
      query += ` AND event_date > CURRENT_TIMESTAMP`;
    }

    if (type) {
      query += ` AND ticket_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (subtype) {
      query += ` AND ticket_subtype = $${paramIndex}`;
      params.push(subtype);
      paramIndex++;
    }

    if (date) {
      query += ` AND DATE(event_date) = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }

    if (location) {
      query += ` AND location ILIKE $${paramIndex}`;
      params.push(`%${location}%`);
      paramIndex++;
    }

    if (price_min) {
      query += ` AND price >= $${paramIndex}`;
      params.push(parseFloat(price_min));
      paramIndex++;
    }

    if (price_max) {
      query += ` AND price <= $${paramIndex}`;
      params.push(parseFloat(price_max));
      paramIndex++;
    }

    if (search) {
      query += ` AND (title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (featured_only === 'true') {
      query += ` AND is_featured = true`;
    }

    query += ' ORDER BY event_date ASC, is_featured DESC';

    const result = await pool.query(query, params);
    res.json({ tickets: result.rows });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    // Return mock data if database is unavailable
    const mockTickets = [
      {
        ticket_id: 1,
        title: 'Summer Music Festival 2025',
        ticket_type: 'EVENT',
        ticket_subtype: 'GENERAL_ADMISSION',
        event_date: '2025-01-15T18:00:00Z',
        start_time: '18:00',
        end_time: '23:00',
        location: 'Sandton Convention Centre',
        price: 250.00,
        available_quantity: 500,
        total_quantity: 1000,
        performers: ['DJ Fresh', 'Black Coffee', 'Culoe De Song'],
        description: 'South Africa\'s biggest electronic music festival featuring top DJs',
        is_featured: true,
        status_display: 'UPCOMING'
      },
      {
        ticket_id: 2,
        title: 'Orlando Pirates vs Kaizer Chiefs',
        ticket_type: 'GAME',
        ticket_subtype: 'RESERVED_SEATING',
        event_date: '2025-01-10T15:00:00Z',
        start_time: '15:00',
        end_time: '17:00',
        location: 'FNB Stadium',
        price: 180.00,
        available_quantity: 200,
        total_quantity: 500,
        teams: ['Orlando Pirates', 'Kaizer Chiefs'],
        description: 'Premier Soccer League derby match',
        is_featured: false,
        status_display: 'UPCOMING'
      },
      {
        ticket_id: 3,
        title: 'Cape Town to Johannesburg Flight',
        ticket_type: 'TRANSPORT',
        ticket_subtype: 'ECONOMY',
        event_date: '2025-01-20T06:00:00Z',
        start_time: null,
        end_time: null,
        location: 'Cape Town International',
        price: 850.00,
        available_quantity: 50,
        total_quantity: 100,
        departure_location: 'Cape Town',
        arrival_location: 'Johannesburg',
        departure_time: '06:00',
        description: 'Direct flight from CPT to JNB',
        is_featured: false,
        status_display: 'UPCOMING'
      }
    ];
    res.json({ tickets: mockTickets });
  }
});

// POST /tickets/buy - buy ticket with comprehensive validation
router.post('/buy', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { ticket_id, quantity = 1, seat, pin } = req.body;
    const userEmail = req.user.email;

    // Check if ticket sales are enabled
    const salesEnabled = await getSystemSetting('ticket_sales_enabled');
    if (salesEnabled === false) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ticket sales are currently disabled' });
    }

    // Check rate limiting
    const withinLimit = await checkRateLimit(userEmail, 'purchase');
    if (!withinLimit) {
      await client.query('ROLLBACK');
      return res.status(429).json({ error: 'Purchase rate limit exceeded. Please try again later.' });
    }

    // Get user details
    const userResult = await client.query(
      'SELECT wallet_balance, is_blocked FROM users WHERE email = $1',
      [userEmail]
    );
    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];

    // Check if user is blocked
    if (user.is_blocked) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Account is blocked. Contact support.' });
    }

    // Verify PIN if required
    // const requirePin = await getSystemSetting('require_pin_for_purchase');
    // if (requirePin && pin) {
    //   // TODO: Verify PIN hash when PIN system is implemented
    //   // For now, just check if PIN is provided
    // } else if (requirePin && !pin) {
    //   await client.query('ROLLBACK');
    //   return res.status(400).json({ error: 'PIN verification required' });
    // }

    // Get ticket details
    const ticketResult = await client.query('SELECT * FROM tickets WHERE ticket_id = $1', [ticket_id]);
    if (ticketResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ticket not found' });
    }
    const ticket = ticketResult.rows[0];

    // Check if ticket is expired
    if (new Date(ticket.event_date) <= new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ticket has expired' });
    }

    // Check sales dates
    const now = new Date();
    if (ticket.sales_start_date && new Date(ticket.sales_start_date) > now) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ticket sales have not started yet' });
    }
    if (ticket.sales_end_date && new Date(ticket.sales_end_date) < now) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ticket sales have ended' });
    }

    // Check availability
    if (ticket.available_quantity < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient tickets available' });
    }

    // Check quantity limits per user
    const maxPerUser = ticket.max_per_user || await getSystemSetting('max_tickets_per_user') || 10;
    const existingPurchases = await client.query(
      'SELECT COALESCE(SUM(ticket_quantity), 0) as total FROM ticket_purchases tp JOIN transactions t ON tp.transaction_ref = t.transaction_ref WHERE t.user_email = $1 AND tp.ticket_id = $2 AND t.status = $3',
      [userEmail, ticket_id, 'SUCCESS']
    );
    if (parseInt(existingPurchases.rows[0].total) + quantity > maxPerUser) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Maximum ${maxPerUser} tickets per user for this event` });
    }

    // Check wallet balance
    const totalPrice = ticket.price * quantity;
    const walletBalance = parseFloat(user.wallet_balance);
    if (walletBalance < totalPrice) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Insufficient wallet balance. Available: R${walletBalance}, Required: R${totalPrice}` });
    }

    // Check seat requirements and availability
    if ((ticket.ticket_type === 'EVENT' || ticket.ticket_type === 'GAME') && ticket.ticket_subtype === 'RESERVED_SEATING' && !seat) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Seat selection required for reserved seating' });
    }

    // If seat provided, check if already taken
    if (seat) {
      const seatCheck = await client.query(
        'SELECT seat FROM ticket_purchases WHERE ticket_id = $1 AND seat = $2 AND status = $3',
        [ticket_id, seat, 'ACTIVE']
      );
      if (seatCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Seat already taken' });
      }
    }

    // Lock ticket stock (prevent overselling)
    await client.query(
      'UPDATE tickets SET available_quantity = available_quantity - $1 WHERE ticket_id = $2 AND available_quantity >= $1',
      [quantity, ticket_id]
    );

    const stockCheck = await client.query('SELECT available_quantity FROM tickets WHERE ticket_id = $1', [ticket_id]);
    if (stockCheck.rows[0].available_quantity < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ticket sold out during purchase' });
    }

    // Generate transaction ref and QR codes
    const transactionRef = uuidv4();
    const qrCodes = [];
    for (let i = 0; i < quantity; i++) {
      const qrValue = crypto.randomBytes(16).toString('hex');
      const qrImage = await generateQR(qrValue);
      qrCodes.push({ value: qrValue, image: qrImage });
    }

    // Create transaction (PENDING first, then SUCCESS)
    await client.query(
      'INSERT INTO transactions (transaction_ref, user_email, amount, transaction_type, status) VALUES ($1, $2, $3, $4, $5)',
      [transactionRef, userEmail, totalPrice, 'TICKET_PURCHASE', 'PENDING']
    );

    // Create ticket purchases
    const purchases = [];
    for (let i = 0; i < quantity; i++) {
      await client.query(
        'INSERT INTO ticket_purchases (ticket_id, transaction_ref, qr_code, qr_image, ticket_quantity, total_amount, status, seat) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [ticket_id, transactionRef, qrCodes[i].value, qrCodes[i].image, 1, ticket.price, 'PENDING', seat]
      );
      purchases.push({
        ticket_id,
        transaction_ref: transactionRef,
        qr_code: qrCodes[i].value,
        seat,
        status: 'PENDING'
      });
    }

    // Update user wallet
    await client.query(
      'UPDATE users SET wallet_balance = wallet_balance - $1 WHERE email = $2',
      [totalPrice, userEmail]
    );

    // Mark transaction as SUCCESS
    await client.query(
      'UPDATE transactions SET status = $1 WHERE transaction_ref = $2',
      ['SUCCESS', transactionRef]
    );

    // Mark purchases as ACTIVE
    await client.query(
      'UPDATE ticket_purchases SET status = $1 WHERE transaction_ref = $2',
      ['ACTIVE', transactionRef]
    );

    // Send purchase confirmation
    await sendNotification(
      userEmail,
      'PURCHASE_CONFIRMATION',
      `Your ticket purchase for ${ticket.title} has been confirmed. Transaction: ${transactionRef}`,
      ticket_id,
      transactionRef
    );

    await client.query('COMMIT');

    res.json({
      message: 'Ticket purchased successfully',
      transaction_ref: transactionRef,
      purchases,
      receipt: {
        total_amount: totalPrice,
        quantity,
        ticket_title: ticket.title,
        event_date: ticket.event_date
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error buying ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// POST /tickets/cancel/:transaction_ref - cancel ticket with refund policy
router.post('/cancel/:transaction_ref', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { transaction_ref } = req.params;
    const userEmail = req.user.email;

    // Get purchase details
    const purchaseResult = await client.query(
      'SELECT tp.*, t.price, t.event_date, t.ticket_type, t.ticket_subtype, tp.ticket_quantity, tp.total_amount FROM ticket_purchases tp JOIN tickets t ON tp.ticket_id = t.ticket_id WHERE tp.transaction_ref = $1 AND tp.transaction_ref IN (SELECT transaction_ref FROM transactions WHERE user_email = $2)',
      [transaction_ref, userEmail]
    );

    if (purchaseResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const purchases = purchaseResult.rows;
    const firstPurchase = purchases[0];

    // Check if already cancelled
    if (firstPurchase.status === 'CANCELLED' || firstPurchase.status === 'USED') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ticket cannot be cancelled' });
    }

    // Check cancellation deadline
    const eventTime = new Date(firstPurchase.event_date);
    const now = new Date();
    const hoursDiff = (eventTime - now) / (1000 * 60 * 60);

    const cancellationDeadline = await getSystemSetting('cancellation_deadline_hours') || 24;
    const refundPercentage = await getSystemSetting('refund_percentage') || 80;

    let refundAmount = 0;
    let canCancel = false;

    if (hoursDiff > cancellationDeadline) {
      // Full refund according to policy
      refundAmount = firstPurchase.total_amount * (refundPercentage / 100);
      canCancel = true;
    } else if (firstPurchase.ticket_type === 'TRANSPORT' && hoursDiff > 2) {
      // Special case for transport - allow cancellation up to 2 hours before
      refundAmount = firstPurchase.total_amount * 0.5; // 50% refund
      canCancel = true;
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `Cancellation not allowed within ${cancellationDeadline} hours of event`,
        hours_remaining: Math.max(0, hoursDiff)
      });
    }

    if (!canCancel) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cancellation not allowed at this time' });
    }

    // Update purchase status
    await client.query(
      'UPDATE ticket_purchases SET status = $1 WHERE transaction_ref = $2',
      ['CANCELLED', transaction_ref]
    );

    // Refund to wallet
    await client.query(
      'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE email = $2',
      [refundAmount, userEmail]
    );

    // Restore ticket stock
    const totalQuantity = purchases.reduce((sum, p) => sum + p.ticket_quantity, 0);
    await client.query(
      'UPDATE tickets SET available_quantity = available_quantity + $1 WHERE ticket_id = $2',
      [totalQuantity, firstPurchase.ticket_id]
    );

    // Update transaction status
    await client.query(
      'UPDATE transactions SET status = $1 WHERE transaction_ref = $2',
      ['CANCELLED', transaction_ref]
    );

    // Create refund transaction record
    const refundRef = uuidv4();
    await client.query(
      'INSERT INTO transactions (transaction_ref, user_email, amount, transaction_type, status) VALUES ($1, $2, $3, $4, $5)',
      [refundRef, userEmail, refundAmount, 'TICKET_REFUND', 'SUCCESS']
    );

    // Send cancellation notification
    await sendNotification(
      userEmail,
      'CANCELLATION',
      `Your ticket for ${firstPurchase.title || 'event'} has been cancelled. Refund: R${refundAmount.toFixed(2)}`,
      firstPurchase.ticket_id,
      transaction_ref
    );

    await client.query('COMMIT');

    res.json({
      message: 'Ticket cancelled successfully',
      refund_amount: refundAmount,
      refund_transaction: refundRef
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cancelling ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// GET /tickets/validate/:qr - validate QR code with transport logic
router.get('/validate/:qr', async (req, res) => {
  try {
    const { qr } = req.params;

    const result = await pool.query(
      'SELECT tp.*, t.title, t.event_date, t.location, t.ticket_type, t.ticket_subtype, t.departure_location, t.arrival_location, t.departure_time FROM ticket_purchases tp JOIN tickets t ON tp.ticket_id = t.ticket_id WHERE tp.qr_code = $1',
      [qr]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'QR code not found' });
    }

    const ticket = result.rows[0];

    if (ticket.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Ticket has been cancelled' });
    }

    if (ticket.status === 'USED') {
      return res.status(400).json({ error: 'Ticket has already been used' });
    }

    // Transport-specific validation
    if (ticket.ticket_type === 'TRANSPORT') {
      const now = new Date();
      const departureTime = new Date(ticket.event_date);
      if (ticket.departure_time) {
        const [hours, minutes] = ticket.departure_time.split(':');
        departureTime.setHours(parseInt(hours), parseInt(minutes));
      }

      // Prevent boarding after departure time
      if (now > departureTime) {
        return res.status(400).json({
          error: 'Boarding time has passed',
          departure_time: departureTime.toISOString()
        });
      }
    }

    // Mark as used and record validation
    await pool.query(
      'UPDATE ticket_purchases SET status = $1, used_at = CURRENT_TIMESTAMP, validated_by = $2 WHERE qr_code = $3',
      ['USED', req.user?.email || 'system', qr]
    );

    res.json({
      valid: true,
      ticket: {
        title: ticket.title,
        event_date: ticket.event_date,
        location: ticket.location,
        departure_location: ticket.departure_location,
        arrival_location: ticket.arrival_location,
        departure_time: ticket.departure_time,
        seat: ticket.seat,
        ticket_type: ticket.ticket_type,
        ticket_subtype: ticket.ticket_subtype,
        validated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error validating QR:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /tickets/history - user's ticket purchases with filtering
router.get('/history', async (req, res) => {
  try {
    const userEmail = req.user.email;
    const { status, type, upcoming_only } = req.query;

    let query = `
      SELECT tp.*, t.title, t.event_date, t.location, t.ticket_type, t.ticket_subtype,
             tr.amount, tr.created_at as purchase_date, tr.status as transaction_status, COALESCE(tp.qr_image, tp.qr_code) as qr_code
      FROM ticket_purchases tp
      JOIN tickets t ON tp.ticket_id = t.ticket_id
      JOIN transactions tr ON tp.transaction_ref = tr.transaction_ref
      WHERE tr.user_email = $1
    `;

    const params = [userEmail];
    let paramIndex = 2;

    if (status) {
      query += ` AND tp.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (type) {
      query += ` AND t.ticket_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }

    if (upcoming_only === 'true') {
      query += ` AND t.event_date > CURRENT_TIMESTAMP`;
    }

    query += ' ORDER BY tr.created_at DESC';

    const result = await pool.query(query, params);

    res.json({ purchases: result.rows });
  } catch (error) {
    console.error('Error fetching ticket history:', error);
    // Return mock data if database is unavailable
    const mockPurchases = [
      {
        transaction_ref: 'txn-123456',
        title: 'Summer Music Festival',
        event_date: '2025-01-15T18:00:00Z',
        location: 'Sandton Convention Centre',
        ticket_type: 'EVENT',
        ticket_subtype: 'GENERAL_ADMISSION',
        amount: 250.00,
        purchase_date: '2024-12-20T10:30:00Z',
        status: 'ACTIVE',
        qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
      },
      {
        transaction_ref: 'txn-789012',
        title: 'Orlando Pirates vs Kaizer Chiefs',
        event_date: '2025-01-10T15:00:00Z',
        location: 'FNB Stadium',
        ticket_type: 'GAME',
        ticket_subtype: 'RESERVED_SEATING',
        amount: 180.00,
        purchase_date: '2024-12-18T14:20:00Z',
        status: 'ACTIVE',
        qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...'
      }
    ];
    res.json({ purchases: mockPurchases });
  }
});

// GET /tickets/upcoming - user's upcoming events
router.get('/upcoming', async (req, res) => {
  try {
    const userEmail = req.user.email;

    const result = await pool.query(
      `SELECT DISTINCT t.*, COALESCE(tp.qr_image, tp.qr_code) as qr_code, tp.status as purchase_status
        FROM tickets t
        JOIN ticket_purchases tp ON t.ticket_id = tp.ticket_id
        JOIN transactions tr ON tp.transaction_ref = tr.transaction_ref
        WHERE tr.user_email = $1
        AND t.event_date > CURRENT_TIMESTAMP
        AND tp.status = 'ACTIVE'
        ORDER BY t.event_date ASC`,
      [userEmail]
    );

    res.json({ events: result.rows });
  } catch (error) {
    console.error('Error fetching upcoming events:', error);
    // Return mock data if database is unavailable
    const mockEvents = [
      {
        ticket_id: 1,
        title: 'Summer Music Festival',
        event_date: '2025-01-15T18:00:00Z',
        location: 'Sandton Convention Centre',
        ticket_type: 'EVENT',
        ticket_subtype: 'GENERAL_ADMISSION',
        qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
        purchase_status: 'ACTIVE',
        seat: null
      },
      {
        ticket_id: 2,
        title: 'Orlando Pirates vs Kaizer Chiefs',
        event_date: '2025-01-10T15:00:00Z',
        location: 'FNB Stadium',
        ticket_type: 'GAME',
        ticket_subtype: 'RESERVED_SEATING',
        qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
        purchase_status: 'ACTIVE',
        seat: 'A12'
      }
    ];
    res.json({ events: mockEvents });
  }
});

// POST /tickets/reminders/send - send event reminders (could be called by cron job)
router.post('/reminders/send', async (req, res) => {
  try {
    // Find events happening in next 24 hours
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = await pool.query(
      `SELECT DISTINCT t.*, COALESCE(tp.qr_image, tp.qr_code) as qr_code, tr.user_email
        FROM tickets t
        JOIN ticket_purchases tp ON t.ticket_id = tp.ticket_id
        JOIN transactions tr ON tp.transaction_ref = tr.transaction_ref
        WHERE t.event_date BETWEEN CURRENT_TIMESTAMP AND $1
        AND tp.status = 'ACTIVE'
        AND tr.status = 'SUCCESS'`,
      [tomorrow]
    );

    const remindersSent = [];

    for (const ticket of result.rows) {
      await sendNotification(
        ticket.user_email,
        'EVENT_REMINDER',
        `Reminder: ${ticket.title} is tomorrow at ${new Date(ticket.event_date).toLocaleString()}. Location: ${ticket.location}`,
        ticket.ticket_id
      );
      remindersSent.push(ticket.user_email);
    }

    res.json({
      message: `Reminders sent to ${remindersSent.length} users`,
      count: remindersSent.length
    });
  } catch (error) {
    console.error('Error sending reminders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;