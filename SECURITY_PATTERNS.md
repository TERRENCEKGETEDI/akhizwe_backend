# 🔐 Security Patterns for Financial Data

## ❌ CRITICAL: What NOT to do

### Never embed financial data in JWTs
```javascript
// ❌ DANGEROUS - Financial data becomes stale
const token = jwt.sign({
  email: user.email,
  role: user.role,
  wallet_balance: user.wallet_balance,      // ❌ DON'T DO THIS
  airtime_balance: user.airtime_balance,    // ❌ DON'T DO THIS
  data_balance: user.data_balance           // ❌ DON'T DO THIS
}, JWT_SECRET);
```

### Why this is dangerous:
- JWTs can become stale - balance changes won't be reflected
- Users could make transactions with outdated balances
- Security vulnerability allowing financial fraud

## ✅ CORRECT PATTERNS

### 1. JWT should only contain identity data
```javascript
// ✅ SECURE - Only identity information
const token = jwt.sign({
  email: user.email,
  role: user.role,
  phone: user.phone
}, JWT_SECRET, { expiresIn: '1h' });
```

### 2. Always fetch fresh financial data from database
```javascript
// ✅ CORRECT - Fresh data from database
const userResult = await pool.query(
  'SELECT wallet_balance, airtime_balance, data_balance FROM users WHERE email = $1',
  [req.user.email]
);

const user = userResult.rows[0];
const currentBalance = parseFloat(user.wallet_balance);
```

### 3. Use the getFreshUserData helper
```javascript
const { getFreshUserData } = require('../middleware/getUserData');

// ✅ RECOMMENDED - Use helper function
const freshUserData = await getFreshUserData(req.user.email);
const walletBalance = freshUserData.wallet_balance;
```

## 🛡️ Security Principles

### JWT should contain:
- ✅ Identity (email, phone)
- ✅ Role (USER, ADMIN)
- ✅ Session validity
- ✅ Non-sensitive flags

### JWT should NEVER contain:
- ❌ Financial balances (wallet, airtime, data)
- ❌ Quotas or limits that change frequently
- ❌ Permissions that can be revoked
- ❌ Any data that needs real-time accuracy

## 🔄 When to fetch fresh data

### Always fetch from database when:
- Processing transactions
- Checking balances before purchases
- Displaying account information
- Validating spending limits
- Any financial operation

### Safe to use JWT data for:
- Basic user identification
- Role-based access control
- Non-financial user preferences
- Session validation

## 📋 Implementation Checklist

- [ ] JWT contains only identity data
- [ ] Financial data fetched from database
- [ ] Balance validated before every transaction
- [ ] No stale balance assumptions
- [ ] Real-time data for all monetary operations

## 🚨 Warning Signs

If you see these patterns, it's a security vulnerability:
- `req.user.wallet_balance` in transaction code
- Financial calculations using JWT data
- Balance updates without database queries
- Trusting JWT balance for purchases

Remember: **Financial data must always come from the database!**