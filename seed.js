require('dotenv').config();
const pool = require('./src/db');
const { v4: uuidv4 } = require('uuid');

async function seedAdmin() {
  try {
    const adminEmail = 'admin@bathinibona.co.za';
    const adminPasswordHash = '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi'; // bcrypt hash for 'password'
    const adminFullName = 'Admin User';
    const adminPhone = '0712345678';
    const adminUserId = uuidv4();

    // Check if admin exists
    const existing = await pool.query('SELECT email FROM users WHERE email = $1', [adminEmail]);
    if (existing.rows.length > 0) {
      console.log('Admin user already exists');
      return;
    }

    await pool.query(
      'INSERT INTO users (user_id, email, full_name, phone_number, password_hash, role, wallet_balance) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [adminUserId, adminEmail, adminFullName, adminPhone, adminPasswordHash, 'ADMIN', 1000]
    );

    console.log('Admin user seeded successfully');
  } catch (error) {
    console.error('Error seeding admin:', error);
  }
}

async function seedNetworks() {
  try {
    // Check if networks exist
    const existing = await pool.query('SELECT COUNT(*) FROM networks');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log('Networks already seeded');
      return;
    }

    const networks = [
      { name: 'Vodacom' },
      { name: 'MTN' },
      { name: 'Cell C' },
      { name: 'Telkom' }
    ];

    for (const network of networks) {
      await pool.query('INSERT INTO networks (name) VALUES ($1)', [network.name]);
    }

    console.log('Networks seeded successfully');
  } catch (error) {
    console.error('Error seeding networks:', error);
  }
}

async function seedDataBundles() {
  try {
    // Check if data bundles exist
    const existing = await pool.query('SELECT COUNT(*) FROM data_bundles');
    if (parseInt(existing.rows[0].count) > 0) {
      console.log('Data bundles already seeded');
      return;
    }

    // Get network IDs
    const networkRows = await pool.query('SELECT network_id, name FROM networks');
    const networkMap = {};
    networkRows.rows.forEach(row => {
      networkMap[row.name] = row.network_id;
    });

    const bundles = [
      { network: 'Vodacom', name: '1GB Data', data_size: '1GB', price: 50.00 },
      { network: 'Vodacom', name: '5GB Data', data_size: '5GB', price: 200.00 },
      { network: 'Vodacom', name: '10GB Data', data_size: '10GB', price: 350.00 },
      { network: 'MTN', name: '1GB Data', data_size: '1GB', price: 45.00 },
      { network: 'MTN', name: '5GB Data', data_size: '5GB', price: 180.00 },
      { network: 'MTN', name: '10GB Data', data_size: '10GB', price: 320.00 },
      { network: 'Cell C', name: '1GB Data', data_size: '1GB', price: 40.00 },
      { network: 'Cell C', name: '5GB Data', data_size: '5GB', price: 160.00 },
      { network: 'Cell C', name: '10GB Data', data_size: '10GB', price: 300.00 },
      { network: 'Telkom', name: '1GB Data', data_size: '1GB', price: 55.00 },
      { network: 'Telkom', name: '5GB Data', data_size: '5GB', price: 220.00 },
      { network: 'Telkom', name: '10GB Data', data_size: '10GB', price: 400.00 }
    ];

    for (const bundle of bundles) {
      const networkId = networkMap[bundle.network];
      if (networkId) {
        await pool.query(
          'INSERT INTO data_bundles (network_id, name, data_size, price) VALUES ($1, $2, $3, $4)',
          [networkId, bundle.name, bundle.data_size, bundle.price]
        );
      }
    }

    console.log('Data bundles seeded successfully');
  } catch (error) {
    console.error('Error seeding data bundles:', error);
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
          price, total_quantity, available_quantity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        ticket.ticket_id, ticket.ticket_type, ticket.ticket_subtype, ticket.title, ticket.description,
        ticket.event_date, ticket.end_date, ticket.location, ticket.departure_location, ticket.arrival_location,
        ticket.departure_time, ticket.arrival_time, ticket.price, ticket.total_quantity, ticket.available_quantity
      ]);
    }

    console.log('Tickets seeded successfully');
  } catch (error) {
    console.error('Error seeding tickets:', error);
  }
}

async function main() {
  await seedAdmin();
  await seedNetworks();
  await seedDataBundles();
  await seedTickets();
  pool.end();
}

main();