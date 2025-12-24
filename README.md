# Admin API Documentation

This backend provides admin functionalities for managing users, content, and system monitoring. All endpoints require JWT authentication with admin privileges.

## Authentication

All admin endpoints require a Bearer token in the Authorization header: `Authorization: Bearer <token>`

## Endpoints

### Account Management

#### GET /api/admin/users
View all user accounts with pagination and filters.
- Query params: `page`, `limit`, `role`, `blocked`
- Response: Paginated list of users

#### PATCH /api/admin/users/:email/block
Block or unblock a user.
- Body: `{ "is_blocked": boolean }`
- Response: Updated user info

#### DELETE /api/admin/users/:email
Delete a user account.
- Response: Confirmation message

### System Monitoring

#### GET /api/admin/stats/airtime-data
Airtime/data sales statistics.
- Query params: `start_date`, `end_date`
- Response: Stats by network and bundle type

#### GET /api/admin/stats/tickets
Ticket sales statistics.
- Query params: `start_date`, `end_date`
- Response: Sales by ticket type and title

#### GET /api/admin/stats/media
Media upload, approval, and interaction stats.
- Query params: `start_date`, `end_date`
- Response: Counts by type and approval status

#### GET /api/admin/stats/revenue
Revenue and usage reports.
- Query params: `start_date`, `end_date`
- Response: Revenue by transaction type

### Content Control

#### GET /api/admin/tickets
Get all tickets.
- Response: List of tickets

#### POST /api/admin/tickets
Add a new ticket.
- Body: `{ "ticket_type", "title", "event_date", "location", "price", "total_quantity" }`
- Response: Created ticket

#### PUT /api/admin/tickets/:ticket_id
Update a ticket.
- Body: Updated ticket fields
- Response: Updated ticket

#### DELETE /api/admin/tickets/:ticket_id
Delete a ticket.
- Response: Confirmation

#### PATCH /api/admin/media/:media_id/approve
Approve or reject media.
- Body: `{ "is_approved": boolean }`
- Response: Updated media

#### GET /api/admin/reports
View reports.
- Query params: `page`, `limit`, `status`
- Response: Paginated reports

#### PATCH /api/admin/reports/:report_id
Update report status.
- Body: `{ "status": "PENDING|REVIEWED|RESOLVED" }`
- Response: Updated report

### Security

#### GET /api/admin/logs
View admin audit logs.
- Query params: `page`, `limit`, `admin_email`
- Response: Paginated logs

#### GET /api/admin/transactions/failed
View failed transactions.
- Query params: `page`, `limit`
- Response: Paginated failed transactions

#### GET /api/admin/fraud-alerts
Fraud alerts (placeholder).
- Response: Message

#### POST /api/admin/services/:service/toggle
Toggle service (placeholder).
- Body: `{ "enabled": boolean }`
- Response: Message

#### POST /api/admin/backup
Trigger backup (placeholder).
- Response: Message

## Error Handling

All endpoints return appropriate HTTP status codes and JSON error messages.

## Database

Uses PostgreSQL with tables as specified. Run `reports_table.sql` to add the reports table if needed.