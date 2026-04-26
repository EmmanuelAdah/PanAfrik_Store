# 🌍 Pan-Afrik Store API

[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-blue.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-336791.svg)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Cache-Redis-DC382D.svg)](https://redis.io/)
[![Cloudinary](https://img.shields.io/badge/Storage-Cloudinary-3448C5.svg)](https://cloudinary.com/)

**Pan-Afrik Store** is a high-performance cross-border e-commerce backend engine. It solves the critical challenge of currency volatility in African trade by implementing automated exchange rate synchronization, rate-locking at checkout, and decoupled merchant payout logic.

---

## 🚀 Key Technical Features

- **Automated Currency Sync**: Integrated `RateService` that fetches, caches, and manages exchange rates via a PostgreSQL-backed `RateCache`.
- **Atomic Checkout**: A robust transaction-based checkout system that locks exchange rates to prevent price fluctuations during payment.
- **Merchant Payout Management**: Automatically calculates merchant earnings in their local `baseCurrency`, ensuring sellers receive exact amounts regardless of the buyer's currency.
- **Security & Resilience**:
  - **JWT & Role-Based Access**: Strict boundaries for `merchant` and `customer` roles.
  - **Rate Limiting**: Protects sensitive checkout and auth endpoints from brute-force attacks.
  - **Cloudinary Integration**: Secure handling and storage of product imagery.

---

## 🏗️ Project Architecture

```
├── config/             # Cloudinary, CORS, Prisma, and Redis setups
├── controllers/        # Express handlers (Auth, Cart, Order, Product, Rate, User)
├── coverage/           # LCOV and Jest test coverage reports
├── middleware/         # Hash, JWT Auth, Rate Limiter, and Role Check logic
├── prisma/             
│   ├── migrations/     # SQL migration history
│   └── schema.prisma   # PostgreSQL relational schema
├── routes/             # Unified API route definitions
├── services/           # Business Logic: Currency, Rates, Webhooks, Image Uploads
├── test/               # Comprehensive Jest integration and unit test suites
├── utils/              # AppError, catchAsyncErrors, Logger, and Validators
├── app.js              # Express application configuration
└── server.js           # Server entry point
```

## 📊 Database Schema HighlightsThe system leverages Prisma with PostgreSQL to maintain financial integrity:
User: Tracks baseCurrency and country for localized experiences.
Order: Stores exchangeRateApplied (Decimal 18, 6) to provide a permanent audit trail.
OrderItem: Captures unitPriceMerchantCurrency to insulate merchants from FX risks.
PayoutNotification: An automated system tracking merchant settlement status (pending, sent).

## 🚦 API ReferenceAuthentication & UserMethodEndpointDescription

POST/api/auth/register -- Register as a Customer or Merchant
POST/api/auth/login -- Secure login and JWT issuance
PUT/api/user/update/:idUpdate -- profile (Auth & Role Protected)Commerce 

LogicMethodEndpointAccessDescription

GET/api/productsPublicList active products
POST/api/productsMerchantUpload product with Cloudinary image
POST/api/cartCustomerAdd items to cross-border cart
POST/api/order/checkoutCustomerAtomic checkout with rate 

## lockingFinancial DataMethodEndpointDescription
GET/api/rates -- Retrieve the latest cached FX rates

## 🔧 Setup & Installation
```
Clone the repository -- git clone https://github.com/EmmanuelAdah/PanAfrik_Store.git
cd pan-afrik-store

Install Dependencies
npm install

Configure Environment
Create a .env file in the root:Code snippet

DATABASE_URL="postgresql://user:password@localhost:5432/panafrik"
DIRECT_URL="postgresql://user:password@localhost:5432/panafrik"
REDIS_URL="your_redis_url"
CLOUDINARY_CLOUD_NAME="your_name"
JWT_SECRET="your_secret"

Initialize Database
npx prisma migrate dev
npx prisma generate

Run the Application
npm run dev
```

## 🧪 Testing & Quality
The project uses Jest and Supertest. 
Run the following to see the coverage report located in the /coverage folder:Bashnpm test
