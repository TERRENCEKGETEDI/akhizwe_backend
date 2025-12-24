const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const pool = require('../db');
const { v4: uuidv4 } = require('uuid'); // for log_id if needed

const router = express.Router();

// Middleware for all admin routes
router.use(authenticateToken);
router.use(requireAdmin);

// Helper function to log admin actions
const logAdminAction = async (adminEmail, action) => {
  try {
    await pool.query(
      'INSERT INTO admin_logs (log_id, admin_email, action) VALUES ($1, $2, $3)',
      [uuidv4(), adminEmail, action]
    );
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
};

// Account Management

// View all user accounts (paginated, filtered)
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 10, role, blocked } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT email, full_name, phone, role, wallet_balance, is_blocked, created_at FROM users WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (role) {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (blocked !== undefined) {
      query += ` AND is_blocked = $${paramIndex}`;
      params.push(blocked === 'true');
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM users WHERE 1=1';
    const countParams = params.slice(0, -2); // Remove limit and offset
    if (role) countQuery += ' AND role = $1';
    if (blocked !== undefined) countQuery += role ? ' AND is_blocked = $2' : ' AND is_blocked = $1';

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      users: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Block or unblock a user
router.patch('/users/:email/block', async (req, res) => {
  try {
    const { email } = req.params;
    const { is_blocked } = req.body;

    if (typeof is_blocked !== 'boolean') {
      return res.status(400).json({ error: 'is_blocked must be a boolean' });
    }

    const result = await pool.query(
      'UPDATE users SET is_blocked = $1 WHERE email = $2 RETURNING email, full_name, is_blocked',
      [is_blocked, email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const action = `${is_blocked ? 'Blocked' : 'Unblocked'} user ${email}`;
    await logAdminAction(req.user.email, action);

    res.json({ message: `User ${is_blocked ? 'blocked' : 'unblocked'} successfully`, user: result.rows[0] });
  } catch (error) {
    console.error('Error updating user block status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a user account (hard delete)
router.delete('/users/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const result = await pool.query('DELETE FROM users WHERE email = $1 RETURNING email, full_name', [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const action = `Deleted user account ${email}`;
    await logAdminAction(req.user.email, action);

    res.json({ message: 'User deleted successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// System Monitoring & Stats

// Airtime/Data sales statistics
router.get('/stats/airtime-data', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = `
      SELECT
        ad.network,
        ad.bundle_type,
        COUNT(*) as transaction_count,
        SUM(t.amount) as total_amount
      FROM transactions t
      JOIN airtime_data ad ON t.transaction_ref = ad.transaction_ref
      WHERE t.status = 'SUCCESS'
    `;
    const params = [];
    let paramIndex = 1;

    if (start_date) {
      query += ` AND t.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND t.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    query += ' GROUP BY ad.network, ad.bundle_type ORDER BY ad.network, ad.bundle_type';

    const result = await pool.query(query, params);

    res.json({ stats: result.rows });
  } catch (error) {
    console.error('Error fetching airtime/data stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Ticket sales statistics
router.get('/stats/tickets', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = `
      SELECT
        t.ticket_type,
        t.title,
        COUNT(tp.transaction_ref) as tickets_sold,
        SUM(t.price) as total_revenue
      FROM tickets t
      LEFT JOIN ticket_purchases tp ON t.ticket_id = tp.ticket_id
      LEFT JOIN transactions tr ON tp.transaction_ref = tr.transaction_ref
      WHERE tr.status = 'SUCCESS' OR tr.status IS NULL
    `;
    const params = [];
    let paramIndex = 1;

    if (start_date) {
      query += ` AND tr.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND tr.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    query += ' GROUP BY t.ticket_id, t.ticket_type, t.title ORDER BY t.ticket_type, t.title';

    const result = await pool.query(query, params);

    res.json({ stats: result.rows });
  } catch (error) {
    console.error('Error fetching ticket stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Media upload, delete, and flag stats
router.get('/stats/media', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = `
      SELECT
        media_type,
        is_approved,
        COUNT(*) as count,
        COUNT(mi.*) as interactions
      FROM media m
      LEFT JOIN media_interactions mi ON m.media_id = mi.media_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (start_date) {
      query += ` AND m.uploaded_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND m.uploaded_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    query += ' GROUP BY media_type, is_approved ORDER BY media_type, is_approved';

    const result = await pool.query(query, params);

    res.json({ stats: result.rows });
  } catch (error) {
    console.error('Error fetching media stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Revenue and usage reports
router.get('/stats/revenue', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    let query = `
      SELECT
        transaction_type,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount
      FROM transactions
      WHERE status = 'SUCCESS'
    `;
    const params = [];
    let paramIndex = 1;

    if (start_date) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    query += ' GROUP BY transaction_type ORDER BY transaction_type';

    const result = await pool.query(query, params);

    res.json({ revenue: result.rows });
  } catch (error) {
    console.error('Error fetching revenue stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Content & Ticket Control

// CRUD Tickets

// Get all tickets
router.get('/tickets', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tickets ORDER BY event_date DESC');
    res.json({ tickets: result.rows });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add a ticket
router.post('/tickets', async (req, res) => {
  try {
    const {
      ticket_type, ticket_subtype, title, description, event_date, end_date,
      location, departure_location, arrival_location, departure_time, arrival_time,
      price, total_quantity, max_per_user, sales_start_date, sales_end_date,
      cancellation_policy, refund_policy, is_featured
    } = req.body;

    if (!ticket_type || !title || !event_date || !price || !total_quantity) {
      return res.status(400).json({ error: 'Missing required fields: ticket_type, title, event_date, price, total_quantity' });
    }

    // Validate ticket types
    const validTypes = ['EVENT', 'GAME', 'TRANSPORT'];
    if (!validTypes.includes(ticket_type)) {
      return res.status(400).json({ error: 'Invalid ticket_type. Must be EVENT, GAME, or TRANSPORT' });
    }

    // Validate subtypes
    const validSubtypes = {
      'EVENT': ['GENERAL_ADMISSION', 'RESERVED_SEATING'],
      'GAME': ['GENERAL_ADMISSION', 'RESERVED_SEATING'],
      'TRANSPORT': ['ONE_WAY', 'RETURN']
    };

    if (ticket_subtype && !validSubtypes[ticket_type]?.includes(ticket_subtype)) {
      return res.status(400).json({ error: `Invalid ticket_subtype for ${ticket_type}` });
    }

    const ticket_id = uuidv4();
    const result = await pool.query(
      `INSERT INTO tickets (
        ticket_id, ticket_type, ticket_subtype, title, description, event_date, end_date,
        location, departure_location, arrival_location, departure_time, arrival_time,
        price, total_quantity, available_quantity, max_per_user, sales_start_date, sales_end_date,
        cancellation_policy, refund_policy, is_featured
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) RETURNING *`,
      [
        ticket_id, ticket_type, ticket_subtype, title, description, event_date, end_date,
        location, departure_location, arrival_location, departure_time, arrival_time,
        price, total_quantity, total_quantity, max_per_user, sales_start_date, sales_end_date,
        cancellation_policy, refund_policy, is_featured || false
      ]
    );

    const action = `Added new ticket: ${title} (${ticket_type})`;
    await logAdminAction(req.user.email, action);

    res.status(201).json({ message: 'Ticket added successfully', ticket: result.rows[0] });
  } catch (error) {
    console.error('Error adding ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Edit a ticket (with restrictions after sales start)
router.put('/tickets/:ticket_id', async (req, res) => {
  try {
    const { ticket_id } = req.params;
    const {
      ticket_type, ticket_subtype, title, description, event_date, end_date,
      location, departure_location, arrival_location, departure_time, arrival_time,
      price, total_quantity, max_per_user, sales_start_date, sales_end_date,
      cancellation_policy, refund_policy, is_featured, status
    } = req.body;

    // Check if ticket exists and get current data
    const existingResult = await pool.query('SELECT * FROM tickets WHERE ticket_id = $1', [ticket_id]);
    if (existingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const existingTicket = existingResult.rows[0];
    const now = new Date();

    // Check if sales have started - restrict certain changes
    const salesStarted = existingTicket.sales_start_date && new Date(existingTicket.sales_start_date) <= now;
    const hasSales = existingTicket.total_quantity > existingTicket.available_quantity;

    if (salesStarted && hasSales) {
      // Cannot change price, total_quantity, or event_date after sales started
      if (price !== undefined && price !== existingTicket.price) {
        return res.status(400).json({ error: 'Cannot change price after sales have started' });
      }
      if (total_quantity !== undefined && total_quantity < existingTicket.total_quantity) {
        return res.status(400).json({ error: 'Cannot reduce total quantity after sales have started' });
      }
      if (event_date !== existingTicket.event_date) {
        return res.status(400).json({ error: 'Cannot change event date after sales have started' });
      }
    }

    // Calculate new available quantity
    let newAvailableQuantity = existingTicket.available_quantity;
    if (total_quantity !== undefined && total_quantity > existingTicket.total_quantity) {
      newAvailableQuantity += (total_quantity - existingTicket.total_quantity);
    }

    const result = await pool.query(
      `UPDATE tickets SET
        ticket_type = COALESCE($1, ticket_type),
        ticket_subtype = COALESCE($2, ticket_subtype),
        title = COALESCE($3, title),
        description = COALESCE($4, description),
        event_date = COALESCE($5, event_date),
        end_date = $6,
        location = COALESCE($7, location),
        departure_location = $8,
        arrival_location = $9,
        departure_time = $10,
        arrival_time = $11,
        price = COALESCE($12, price),
        total_quantity = COALESCE($13, total_quantity),
        available_quantity = $14,
        max_per_user = COALESCE($15, max_per_user),
        sales_start_date = $16,
        sales_end_date = $17,
        cancellation_policy = $18,
        refund_policy = $19,
        is_featured = COALESCE($20, is_featured),
        status = COALESCE($21, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE ticket_id = $22 RETURNING *`,
      [
        ticket_type, ticket_subtype, title, description, event_date, end_date,
        location, departure_location, arrival_location, departure_time, arrival_time,
        price, total_quantity, newAvailableQuantity, max_per_user, sales_start_date, sales_end_date,
        cancellation_policy, refund_policy, is_featured, status, ticket_id
      ]
    );

    const action = `Updated ticket: ${result.rows[0].title}`;
    await logAdminAction(req.user.email, action);

    res.json({ message: 'Ticket updated successfully', ticket: result.rows[0] });
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a ticket
router.delete('/tickets/:ticket_id', async (req, res) => {
  try {
    const { ticket_id } = req.params;

    // Check if ticket has any purchases
    const purchaseCheck = await pool.query(
      'SELECT COUNT(*) FROM ticket_purchases WHERE ticket_id = $1 AND status = $2',
      [ticket_id, 'ACTIVE']
    );

    if (parseInt(purchaseCheck.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete ticket with active purchases. Cancel the event instead.' });
    }

    const result = await pool.query('DELETE FROM tickets WHERE ticket_id = $1 RETURNING title', [ticket_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const action = `Deleted ticket: ${result.rows[0].title}`;
    await logAdminAction(req.user.email, action);

    res.json({ message: 'Ticket deleted successfully' });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Cancel event and process refunds
router.post('/tickets/:ticket_id/cancel', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { ticket_id } = req.params;
    const { refund_percentage = 100 } = req.body;

    // Get ticket details
    const ticketResult = await client.query('SELECT * FROM tickets WHERE ticket_id = $1', [ticket_id]);
    if (ticketResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Get all active purchases
    const purchasesResult = await client.query(
      'SELECT tp.*, tr.user_email FROM ticket_purchases tp JOIN transactions tr ON tp.transaction_ref = tr.transaction_ref WHERE tp.ticket_id = $1 AND tp.status = $2',
      [ticket_id, 'ACTIVE']
    );

    const purchases = purchasesResult.rows;
    const refunds = [];

    for (const purchase of purchases) {
      const refundAmount = purchase.total_amount * (refund_percentage / 100);

      // Refund to user wallet
      await client.query(
        'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE email = $2',
        [refundAmount, purchase.user_email]
      );

      // Create refund transaction
      const refundRef = uuidv4();
      await client.query(
        'INSERT INTO transactions (transaction_ref, user_email, amount, transaction_type, status) VALUES ($1, $2, $3, $4, $5)',
        [refundRef, purchase.user_email, refundAmount, 'EVENT_CANCELLATION_REFUND', 'SUCCESS']
      );

      // Update purchase status
      await client.query(
        'UPDATE ticket_purchases SET status = $1 WHERE qr_code = $2',
        ['CANCELLED', purchase.qr_code]
      );

      refunds.push({
        user_email: purchase.user_email,
        refund_amount: refundAmount,
        transaction_ref: refundRef
      });
    }

    // Update ticket status
    await client.query(
      'UPDATE tickets SET status = $1, available_quantity = 0 WHERE ticket_id = $2',
      ['CANCELLED', ticket_id]
    );

    // Send notifications
    for (const refund of refunds) {
      // Note: In production, this would send actual notifications
      console.log(`Refund processed for ${refund.user_email}: R${refund.refund_amount}`);
    }

    const action = `Cancelled event ${ticketResult.rows[0].title} and processed ${refunds.length} refunds`;
    await logAdminAction(req.user.email, action);

    await client.query('COMMIT');

    res.json({
      message: 'Event cancelled and refunds processed',
      refunds_processed: refunds.length,
      total_refund_amount: refunds.reduce((sum, r) => sum + r.refund_amount, 0)
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error cancelling event:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Process manual refund
router.post('/tickets/refund/:transaction_ref', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { transaction_ref } = req.params;
    const { refund_amount, reason } = req.body;

    // Get purchase details
    const purchaseResult = await client.query(
      'SELECT tp.*, t.title, tr.user_email, tr.amount FROM ticket_purchases tp JOIN tickets t ON tp.ticket_id = t.ticket_id JOIN transactions tr ON tp.transaction_ref = tr.transaction_ref WHERE tp.transaction_ref = $1',
      [transaction_ref]
    );

    if (purchaseResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const purchase = purchaseResult.rows[0];

    if (purchase.status !== 'ACTIVE') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Purchase is not active' });
    }

    const finalRefundAmount = refund_amount || purchase.amount;

    // Process refund
    await client.query(
      'UPDATE users SET wallet_balance = wallet_balance + $1 WHERE email = $2',
      [finalRefundAmount, purchase.user_email]
    );

    // Create refund transaction
    const refundRef = uuidv4();
    await client.query(
      'INSERT INTO transactions (transaction_ref, user_email, amount, transaction_type, status) VALUES ($1, $2, $3, $4, $5)',
      [refundRef, purchase.user_email, finalRefundAmount, 'MANUAL_REFUND', 'SUCCESS']
    );

    // Update purchase status
    await client.query(
      'UPDATE ticket_purchases SET status = $1 WHERE transaction_ref = $2',
      ['CANCELLED', transaction_ref]
    );

    // Restore ticket stock
    await client.query(
      'UPDATE tickets SET available_quantity = available_quantity + 1 WHERE ticket_id = $1',
      [purchase.ticket_id]
    );

    const action = `Processed manual refund of R${finalRefundAmount} for transaction ${transaction_ref}. Reason: ${reason || 'Not specified'}`;
    await logAdminAction(req.user.email, action);

    await client.query('COMMIT');

    res.json({
      message: 'Refund processed successfully',
      refund_amount: finalRefundAmount,
      refund_transaction: refundRef
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error processing refund:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// Get ticket sales report
router.get('/tickets/reports/sales', async (req, res) => {
  try {
    const { start_date, end_date, ticket_id } = req.query;

    let query = `
      SELECT
        t.ticket_id,
        t.title,
        t.ticket_type,
        t.event_date,
        COUNT(tp.transaction_ref) as tickets_sold,
        SUM(tp.total_amount) as total_revenue,
        t.total_quantity,
        t.available_quantity
      FROM tickets t
      LEFT JOIN ticket_purchases tp ON t.ticket_id = tp.ticket_id
      LEFT JOIN transactions tr ON tp.transaction_ref = tr.transaction_ref
      WHERE tr.status = 'SUCCESS' OR tr.status IS NULL
    `;

    const params = [];
    let paramIndex = 1;

    if (ticket_id) {
      query += ` AND t.ticket_id = $${paramIndex}`;
      params.push(ticket_id);
      paramIndex++;
    }

    if (start_date) {
      query += ` AND tr.created_at >= $${paramIndex}`;
      params.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND tr.created_at <= $${paramIndex}`;
      params.push(end_date);
      paramIndex++;
    }

    query += ' GROUP BY t.ticket_id, t.title, t.ticket_type, t.event_date, t.total_quantity, t.available_quantity ORDER BY t.event_date DESC';

    const result = await pool.query(query, params);

    res.json({ sales_report: result.rows });
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get attendance report
router.get('/tickets/reports/attendance', async (req, res) => {
  try {
    const { ticket_id } = req.query;

    let query = `
      SELECT
        t.title,
        t.event_date,
        COUNT(CASE WHEN tp.status = 'USED' THEN 1 END) as attendees,
        COUNT(tp.transaction_ref) as total_purchased,
        ROUND(
          COUNT(CASE WHEN tp.status = 'USED' THEN 1 END)::decimal /
          NULLIF(COUNT(tp.transaction_ref), 0) * 100, 2
        ) as attendance_percentage
      FROM tickets t
      LEFT JOIN ticket_purchases tp ON t.ticket_id = tp.ticket_id
      WHERE t.event_date < CURRENT_TIMESTAMP
    `;

    const params = [];
    if (ticket_id) {
      query += ' AND t.ticket_id = $1';
      params.push(ticket_id);
    }

    query += ' GROUP BY t.ticket_id, t.title, t.event_date ORDER BY t.event_date DESC';

    const result = await pool.query(query, params);

    res.json({ attendance_report: result.rows });
  } catch (error) {
    console.error('Error generating attendance report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve or reject media
router.patch('/media/:media_id/approve', async (req, res) => {
  try {
    const { media_id } = req.params;
    const { is_approved } = req.body;

    if (typeof is_approved !== 'boolean') {
      return res.status(400).json({ error: 'is_approved must be a boolean' });
    }

    const result = await pool.query(
      'UPDATE media SET is_approved = $1 WHERE media_id = $2 RETURNING media_id, title, is_approved',
      [is_approved, media_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Media not found' });
    }

    const action = `${is_approved ? 'Approved' : 'Rejected'} media: ${result.rows[0].title}`;
    await logAdminAction(req.user.email, action);

    res.json({ message: `Media ${is_approved ? 'approved' : 'rejected'} successfully`, media: result.rows[0] });
  } catch (error) {
    console.error('Error updating media approval:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// View and manage reports
router.get('/reports', async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'PENDING' } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      'SELECT * FROM reports WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [status, limit, offset]
    );

    const countResult = await pool.query('SELECT COUNT(*) FROM reports WHERE status = $1', [status]);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      reports: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update report status
router.patch('/reports/:report_id', async (req, res) => {
  try {
    const { report_id } = req.params;
    const { status } = req.body;

    if (!['PENDING', 'REVIEWED', 'RESOLVED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await pool.query(
      'UPDATE reports SET status = $1 WHERE report_id = $2 RETURNING *',
      [status, report_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const action = `Updated report ${report_id} status to ${status}`;
    await logAdminAction(req.user.email, action);

    res.json({ message: 'Report status updated', report: result.rows[0] });
  } catch (error) {
    console.error('Error updating report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Security & Reliability

// View audit logs
router.get('/logs', async (req, res) => {
  try {
    const { page = 1, limit = 50, admin_email } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM admin_logs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (admin_email) {
      query += ` AND admin_email = $${paramIndex}`;
      params.push(admin_email);
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) FROM admin_logs WHERE 1=1';
    const countParams = admin_email ? [admin_email] : [];
    if (admin_email) countQuery += ' AND admin_email = $1';

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      logs: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// View failed transactions
router.get('/transactions/failed', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      'SELECT * FROM transactions WHERE status = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      ['FAILED', limit, offset]
    );

    const countResult = await pool.query('SELECT COUNT(*) FROM transactions WHERE status = $1', ['FAILED']);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      transactions: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching failed transactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dashboard summary
router.get('/dashboard', async (req, res) => {
  try {
    // Total users
    const totalUsersResult = await pool.query('SELECT COUNT(*) FROM users');
    const totalUsers = parseInt(totalUsersResult.rows[0].count);

    // Active vs blocked users
    const userStatusResult = await pool.query('SELECT is_blocked, COUNT(*) FROM users GROUP BY is_blocked');
    const activeUsers = userStatusResult.rows.find(r => r.is_blocked === false)?.count || 0;
    const blockedUsers = userStatusResult.rows.find(r => r.is_blocked === true)?.count || 0;

    // Total revenue
    const revenueResult = await pool.query("SELECT SUM(amount) FROM transactions WHERE status = 'SUCCESS'");
    const totalRevenue = parseFloat(revenueResult.rows[0].sum || 0);

    // Total airtime/data transactions
    const airtimeTransactionsResult = await pool.query("SELECT COUNT(*) FROM transactions t JOIN airtime_data ad ON t.transaction_ref = ad.transaction_ref WHERE t.status = 'SUCCESS'");
    const totalAirtimeTransactions = parseInt(airtimeTransactionsResult.rows[0].count);

    // Total ticket sales
    const ticketSalesResult = await pool.query("SELECT COUNT(*) FROM ticket_purchases tp JOIN transactions t ON tp.transaction_ref = t.transaction_ref WHERE t.status = 'SUCCESS'");
    const totalTicketSales = parseInt(ticketSalesResult.rows[0].count);

    // Total media uploaded
    const mediaUploadedResult = await pool.query('SELECT COUNT(*) FROM media');
    const totalMediaUploaded = parseInt(mediaUploadedResult.rows[0].count);

    // Pending reports count
    const pendingReportsResult = await pool.query("SELECT COUNT(*) FROM reports WHERE status = 'PENDING'");
    const pendingReports = parseInt(pendingReportsResult.rows[0].count);

    // System status (placeholder)
    const systemStatus = 'online'; // Could be 'online', 'limited', 'maintenance'

    res.json({
      totalUsers,
      activeUsers,
      blockedUsers,
      totalRevenue,
      totalAirtimeTransactions,
      totalTicketSales,
      totalMediaUploaded,
      pendingReports,
      systemStatus
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// For fraud alerts, enable/disable services, backup - these might need additional setup
// For now, placeholder

router.get('/fraud-alerts', async (req, res) => {
  // Placeholder: monitor for unusual patterns
  res.json({ alerts: [] });
});

router.post('/services/:service/toggle', async (req, res) => {
  // Placeholder: toggle services
  const { service } = req.params;
  const { enabled } = req.body;
  res.json({ message: `Service ${service} ${enabled ? 'enabled' : 'disabled'}` });
});

router.post('/backup', async (req, res) => {
  // Placeholder: trigger backup
  res.json({ message: 'Backup initiated' });
});

module.exports = router;