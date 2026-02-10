# Smart Enterprise Suite - API Documentation

**Version:** 3.2.0  
**Last Updated:** January 31, 2026  
**Status:** Production Ready

---

## Overview

This document provides comprehensive API documentation for the Smart Enterprise Suite backend. For interactive API documentation, visit `/api-docs` when running the backend server.

---

## 📚 Related Documentation

### Detailed API Documentation

For comprehensive API reference materials, refer to the **[project-analysis/](../project-analysis/)** documentation:

#### API Reference & Schemas
- **[05-api-endpoints-reference.md](../project-analysis/05-api-endpoints-reference.md)** - Complete API endpoint reference including:
  - All authentication endpoints with request/response examples
  - Customer management APIs (CRUD operations)
  - Maintenance request workflows
  - Warehouse and inventory management
  - Transfer order operations
  - Sales and payment processing
  - User and permission management
  - Reports and dashboard APIs
  - Rate limits and authentication requirements for each endpoint

- **[06-api-schemas.md](../project-analysis/06-api-schemas.md)** - Detailed API request/response schemas:
  - Authentication schemas (login, profile, preferences)
  - Customer schemas (create, update, response)
  - Maintenance request schemas (request lifecycle)
  - Transfer order schemas (create, receive, status updates)
  - Sales and payment schemas
  - Field-level validation rules and examples
  - Complete JSON examples for all major operations

- **[07-api-authentication-guide.md](../project-analysis/07-api-authentication-guide.md)** - Comprehensive authentication & authorization guide:
  - JWT-based authentication flow with sequence diagrams
  - Role hierarchy and permission system
  - Multi-layer security model
  - Branch-level data isolation
  - Security middleware implementation
  - Error handling and response codes
  - Implementation examples for protected routes

- **[08-api-error-codes.md](../project-analysis/08-api-error-codes.md)** - Complete API error code reference:
  - HTTP status code meanings
  - Error response format specification
  - Common error scenarios and solutions
  - Validation error details
  - Authentication/authorization error codes

#### Additional API Resources
- **[SWAGGER_EXAMPLES.md](./SWAGGER_EXAMPLES.md)** - OpenAPI/Swagger documentation examples
- **[API_SPEC.md](./API_SPEC.md)** - Core API endpoints and response standards
- **[IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)** - How-to guide for API implementation patterns

#### Interactive Documentation
- **Swagger UI**: http://localhost:5000/api-docs - Auto-generated interactive API documentation
- All endpoints include JSDoc annotations for automatic documentation generation

---

*For backend implementation details, see [ARCHITECTURE.md](./ARCHITECTURE.md)*
*For system design principles, see [SYSTEM_BLUEPRINT.md](./SYSTEM_BLUEPRINT.md)*
