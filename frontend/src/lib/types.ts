

// Removed Firebase Timestamp import


// Represents a maintenance request for a POS machine.
export type MaintenanceRequest = {
  id: string; // Document ID
  customerId: string; // The unique bkcode of the customer.
  posMachineId: string; // The ID of the POS machine document.
  customerName: string;
  machineModel?: string;
  machineManufacturer?: string;
  serialNumber?: string;
  createdAt: Date | string; // Was Timestamp
  status: 'Open' | 'In Progress' | 'Closed' | 'Cancelled';

  technician: string;
  notes?: string;
  complaint: string; // The initial complaint reported by the customer.
  actionTaken?: string; // The procedure performed by the technician.
  closingUserId?: string; // UID of the user who closed the request.
  closingUserName?: string; // Name of the user who closed the request.
  closingTimestamp?: Date | string; // Was Timestamp
  usedParts?: { partId: string, partName: string, cost: number, withCost: boolean }[];
  receiptNumber?: string;
  totalCost?: number;
  customer?: Customer;
  posMachine?: PosMachine;
};

// Represents a customer entity. The document ID will be the bkcode.
export type Customer = {
  id: string; // Document ID (which is the bkcode)
  bkcode: string;
  client_name: string;
  supply_office?: string;
  operating_date?: Date | string;
  address: string;
  contact_person?: string;
  scanned_id_path?: string;
  national_id?: string;
  dept?: string;
  telephone_1?: string;
  telephone_2?: string;
  has_gates?: boolean;
  bk_type?: string;
  clienttype?: string;
  notes?: string;
  papers_date?: Date | string;
  isSpecial?: boolean;
  posMachines?: PosMachine[];
  simCards?: SimCard[];
};

// Represents a single POS machine owned by a customer.
export type PosMachine = {
  id: string; // Document ID
  serialNumber: string;
  posId: string;
  model?: string;
  manufacturer?: string;
  customerId: string; // The bkcode of the customer
  isMain?: boolean;
};

// Represents a SIM card associated with a customer.
export type SimCard = {
  id: string; // Document ID
  serialNumber: string;
  type: string;
  customerId: string; // The bkcode of the customer
};

// Defines the structure for machine parameter rules used for auto-lookup.
export type MachineParameter = {
  id: string; // Document ID
  prefix: string;
  model: string;
  manufacturer: string;
};

export type ClientType = {
  id: string;
  name: string;
  description?: string;
};

// Represents the definition and properties of a spare part.
export type SparePart = {
  id: string; // Document ID
  partNumber?: string; // Optional SKU
  name: string;
  description?: string;
  compatibleModels: string[];
  defaultCost: number;
  isConsumable?: boolean;
  allowsMultiple?: boolean;
};

// Represents the stock level of a specific spare part in inventory.
export type InventoryItem = {
  id: string; // Document ID
  partId: string; // Links to SparePart ID
  quantity: number;
  minLevel: number;
  location: string;
};

// Logs changes to the defaultCost of a SparePart.
export type PriceChangeLog = {
  id: string; // Document ID
  partId: string; // ID of the SparePart
  oldCost: number;
  newCost: number;
  changedAt: Date | string;
  userId: string; // UID of the user who made the change
}

// Logs the usage of spare parts in a maintenance request.
export type UsedPartLog = {
  id: string; // Document ID
  requestId: string;
  customerId: string;
  customerName: string;
  posMachineId: string;
  technician: string;
  closedByUserId: string;
  closedAt: Date | string;
  parts: {
    partId: string;
    partName: string;
    quantityUsed: number;
    withCost: boolean;
  }[];
  receiptNumber?: string;
}


export type Asset = {
  id: string;
  name: string;
  type: string;
  location: string;
  status: 'Operational' | 'Under Maintenance' | 'Decommissioned';
  lastMaintenance: string;
};

export type Technician = {
  id: string;
  displayName?: string;
  email?: string;
  role?: string;
};

// Represents a user of the maintenance management system.
export type User = {
  id: string; // Document ID
  uid: string; // Firebase Auth UID
  email: string;
  displayName?: string;
  role?: string;
  theme?: string;
  themeVariant?: 'glass' | 'solid';
  fontFamily?: string;
};

export type DashboardStats = {
  revenue: {
    amount: number;
    trend?: { name: string; value: number }[];
    period?: string;
  };
  requests: {
    open: number;
    inProgress: number;
    distribution: { name: string; value: number }[];
  };
  inventory: {
    lowStock: any[];
    machines?: number;
    sims?: number;
  };
  alerts: {
    overdueInstallments: number;
    pendingTransfers?: number;
  };
  recentActivity: any[];
  pendingInstallments: {
    installments: any[];
    totalCount: number;
    totalAmount: number;
    totalRemaining: number;
  };
  period: {
    type: 'month' | 'quarter' | 'year';
    month?: number;
    year: number;
  };
  maintenanceStats?: {
    revenue: number;
    paidCount: number;
    freeCount: number;
  };
  activeRequests?: number;
};

export type Payment = {
  id: string;
  customerId?: string;
  customerName?: string;
  requestId?: string;
  amount: number;
  reason: string;
  paymentPlace: string;
  receiptNumber?: string;
  notes?: string;
  userId?: string;
  userName?: string;
  createdAt: string;
  customer?: {
    client_name: string;
    bkcode?: string;
  };
};

export type PaymentStats = {
  total: number;
  today: number;
  month: number;
  byPlace: {
    paymentPlace: string;
    _sum: { amount: number };
    _count: number;
  }[];
};

export type InstallmentStats = {
  customersCount: number;
  totalInstallments: number;
  totalValue: number;
  avgMonths: number;
  overdueCount: number;
  overdueValue: number;
  overdueCustomersCount: number;
};

