require('dotenv').config();
const pool = require('./src/db');
const { v4: uuidv4 } = require('uuid');

async function seedAdmin() {
  try {
    const adminEmail = 'admin@bathinibona.co.za';
    const adminPasswordHash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'; // bcrypt hash for 'password'
    const adminFullName = 'Admin User';
    const adminPhone = '0712345678';

    // Check if admin exists
    const existing = await pool.query('SELECT email FROM users WHERE email = $1', [adminEmail]);
    if (existing.rows.length > 0) {
      console.log('Admin user already exists');
      return;
    }

    await pool.query(
      'INSERT INTO users (email, full_name, phone, password_hash, role, wallet_balance) VALUES ($1, $2, $3, $4, $5, $6)',
      [adminEmail, adminFullName, adminPhone, adminPasswordHash, 'ADMIN', 1000]
    );

    console.log('Admin user seeded successfully');
  } catch (error) {
    console.error('Error seeding admin:', error);
  }
}

async function seedTickets() {
  try {
    // Check if tickets exist
    const existing = await pool.query('SELECT COUNT(*) FROM tickets');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log('Tickets already seeded');
      return;
    }

    const tickets = [
      {
        ticket_id: uuidv4(),
        ticket_type: 'EVENT',
        ticket_subtype: 'GENERAL_ADMISSION',
        title: 'Summer Music Festival',
        description: 'A fantastic outdoor music festival featuring multiple artists.',
        event_date: new Date('2025-12-25T18:00:00Z'),
        end_date: new Date('2025-12-25T23:00:00Z'),
        location: 'Cape Town Stadium',
        price: 150.00,
        total_quantity: 1000,
        available_quantity: 1000,
        performers: ['Artist A', 'Artist B', 'Artist C'],
        start_time: '18:00',
        end_time: '23:00'
      },
      {
        ticket_id: uuidv4(),
        ticket_type: 'GAME',
        ticket_subtype: 'GENERAL_ADMISSION',
        title: 'Soccer Match: Team A vs Team B',
        description: 'Exciting premier league match.',
        event_date: new Date('2025-12-20T15:00:00Z'),
        location: 'Johannesburg Stadium',
        price: 100.00,
        total_quantity: 500,
        available_quantity: 500,
        teams: ['Team A', 'Team B'],
        start_time: '15:00',
        end_time: '17:00'
      },
      {
        ticket_id: uuidv4(),
        ticket_type: 'TRANSPORT',
        ticket_subtype: 'ONE_WAY',
        title: 'Bus to Durban',
        description: 'Comfortable bus service to Durban.',
        event_date: new Date('2025-12-22T08:00:00Z'),
        departure_location: 'Johannesburg',
        arrival_location: 'Durban',
        departure_time: '08:00',
        arrival_time: '18:00',
        location: 'Johannesburg Bus Station',
        price: 50.00,
        total_quantity: 50,
        available_quantity: 50
      }
    ];

    for (const ticket of tickets) {
      await pool.query(`
        INSERT INTO tickets (
          ticket_id, ticket_type, ticket_subtype, title, description, event_date, end_date,
          location, departure_location, arrival_location, departure_time, arrival_time,
          price, total_quantity, available_quantity, performers, teams, start_time, end_time
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      `, [
        ticket.ticket_id, ticket.ticket_type, ticket.ticket_subtype, ticket.title, ticket.description,
        ticket.event_date, ticket.end_date, ticket.location, ticket.departure_location, ticket.arrival_location,
        ticket.departure_time, ticket.arrival_time, ticket.price, ticket.total_quantity, ticket.available_quantity,
        JSON.stringify(ticket.performers || null), JSON.stringify(ticket.teams || null), ticket.start_time, ticket.end_time
      ]);
    }

    console.log('Tickets seeded successfully');
  } catch (error) {
    console.error('Error seeding tickets:', error);
  }
}

async function main() {
  await seedAdmin();
  await seedTickets();
  pool.end();
}

main();