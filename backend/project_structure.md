Smart-Enterprise-Suite_VS/
├── backend/                          # Express.js API
│   ├── middleware/                   # Express middleware
│   │   ├── auth.js                  # JWT authentication
│   │   ├── validation.js            # Input validation with Zod
│   │   ├── rateLimits.js            # Rate limiting
│   │   ├── security.js              # Security headers
│   │   ├── csrf.js                  # CSRF protection
│   │   └── permissions.js           # Role-based access control
│   ├── routes/                      # API route handlers
│   │   ├── requests.js              # Maintenance requests
│   │   ├── customers.js             # Customer management
│   │   ├── technicians.js           # User/technician management
│   │   ├── admin.js                 # Admin operations
│   │   ├── branches.js              # Branch management
│   │   └── [other routes]
│   ├── services/                    # Business logic
│   ├── utils/                       # Utility functions
│   │   ├── errorHandler.js          # Error handling
│   │   ├── logger.js                # Logging
│   │   └── [other utilities]
│   ├── config/                      # Configuration
│   │   └── index.js                 # Environment config
│   ├── prisma/                      # Database schema
│   │   ├── schema.prisma            # Prisma schema
│   │   └── migrations/              # Database migrations
│   ├── db.js                        # Database connection
│   ├── server.js                    # Express app setup
│   ├── .env
