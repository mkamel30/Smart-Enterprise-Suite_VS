# API Documentation

## Overview
The Smart Enterprise Suite API is a RESTful API built with Express.js.
Base URL: `http://localhost:5000/api` (Development)

## Authentication
Most endpoints require authentication using a Bearer Token.
Header: `Authorization: Bearer <token>`

## Error Handling
Standard error response format:
```json
{
  "error": "Error message description",
  "details": "Optional validation details or stack trace (dev only)"
}
```

---

## Endpoints

### 🔐 Authentication

#### Login
- **POST** `/auth/login`
- **Body**: `{ "email": "user@example.com", "password": "password" }`
- **Response**: `{ "token": "jwt_token...", "user": { ... } }`

#### Get Current User
- **GET** `/auth/me`
- **Headers**: `Authorization: Bearer <token>`

### 🛠️ Maintenance Requests

#### Get All Requests
- **GET** `/requests`
- **Query Params**: `page`, `limit`, `status`, `branchId`
- **Response**: List of maintenance requests

#### Create Request
- **POST** `/requests`
- **Body**:
  ```json
  {
    "customerId": 1,
    "posMachineId": 5,
    "complaint": "Screen not working",
    "technicianId": 10
  }
  ```

#### Update Request Status
- **PUT** `/requests/:id/status`
- **Body**: `{ "status": "In Progress" }`

### 👥 Customers

#### Search Customers
- **GET** `/customers/search`
- **Query Params**: `q` (search query for name, phone, or code)

#### Get Customer Details
- **GET** `/customers/:id`

### 📦 Inventory

#### Get Inventory Items
- **GET** `/inventory`
- **Query Params**: `branchId`

#### Stock Movement (In/Out)
- **POST** `/inventory/movement`
- **Body**: `{ "partId": 1, "quantity": 5, "type": "IN", "reason": "Restock" }`

### 💰 Payments

#### Process Payment
- **POST** `/payments`
- **Body**: `{ "amount": 500, "requestId": 123, "method": "CASH" }`

---

> **Note**: This is a simplified reference. For full details including all fields and validation rules, refer to the source code handlers or the Swagger UI (if enabled).
