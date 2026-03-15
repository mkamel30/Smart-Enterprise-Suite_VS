# Smart Enterprise Suite - Architecture Guide

This document provides a high-level overview of the system architecture and domain concepts.

## 1. System Components
The system is divided into two primary applications:
*   **Backend (Express / Node.js)**: Provides the RESTful API and manages business logic, authorization, and database interactions.
*   **Frontend (React / Vite)**: The user-facing application built with TailwindCSS and Radix UI. Uses React Query (TanStack) for caching and state management.

## 2. Database Schema (Prisma)
The database uses Prisma ORM and SQLite (or PostgreSQL in production). Core domain models include:
*   `User`: Represents personnel (Admins, Technicians, Managers).
*   `Branch` & `MaintenanceCenter`: Organizational units.
*   `Customer` & `Machine`: Client data and their POS hardware.
*   `MaintenanceRequest`: Tracks the lifecycle of machine repairs.
*   `SparePart` & `StockMovement`: Inventory management.

## 3. Real-time Communication
The system utilizes Socket.io for real-time notifications:
*   **Maintenance Updates**: Live alerts when a machine is assigned, completed, or transferred.
*   **Stock Alerts**: Notifications for low inventory levels.

## 4. Key Workflows
*   **Maintenance Flow**: Customer reports issue -> Branch logs request -> Transferred to Center -> Technician assigned -> Repaired using Spare Parts -> Closed & Invoiced.
*   **Financial Flow**: Parts consumed are logged with their cost. Transactions (Receipts) record payments and link directly to requests.
