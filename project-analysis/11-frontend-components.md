# Frontend Components Documentation

## Smart Enterprise Suite - Component Architecture Guide

**Version:** 1.0  
**Last Updated:** January 31, 2026  
**Total Components:** 58+ components across 5 categories

---

## Table of Contents

1. [UI Components (Primitive Layer)](#1-ui-components-primitive-layer)
2. [Feature Components](#2-feature-components)
3. [Custom Hooks](#3-custom-hooks)
4. [Component Patterns](#4-component-patterns)
5. [Shared Components](#5-shared-components)
6. [Component Reference Tables](#6-component-reference-tables)

---

## 1. UI Components (Primitive Layer)

The UI components are built on top of **Radix UI primitives** and styled with **Tailwind CSS**. They form the foundational design system for the application.

### 1.1 Button Component

**Location:** `frontend/src/components/ui/button.tsx`

Primary interactive element with multiple variants and sizes.

#### Props Interface

```typescript
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | null
  size?: "default" | "sm" | "lg" | "icon" | null
}
```

#### Variants

| Variant | Description | Use Case |
|---------|-------------|----------|
| `default` | Primary gradient button | Main actions, CTAs |
| `destructive` | Red gradient for dangerous actions | Delete, remove |
| `outline` | Bordered with transparent background | Secondary actions |
| `secondary` | Subtle background highlight | Alternative actions |
| `ghost` | Transparent with hover effect | Toolbars, menus |
| `link` | Text-only with underline | Navigation links |
| `success` | Green gradient | Success confirmations |

#### Usage Example

```tsx
import { Button } from "@/components/ui/button"

// Primary action
<Button>Save Changes</Button>

// Destructive action
<Button variant="destructive">Delete</Button>

// With icon
<Button size="icon">
  <SaveIcon className="h-4 w-4" />
</Button>

// As child (polymorphic)
<Button asChild>
  <Link to="/dashboard">Go to Dashboard</Link>
</Button>
```

#### Dependencies
- `@radix-ui/react-slot`
- `class-variance-authority`
- `tailwind-merge`
- `lucide-react`

---

### 1.2 Dialog Component

**Location:** `frontend/src/components/ui/dialog.tsx`

Modal dialog for overlays, confirmations, and forms.

#### Compound Components

| Component | Purpose |
|-----------|---------|
| `Dialog` | Root container with state management |
| `DialogTrigger` | Element that opens the dialog |
| `DialogContent` | Main dialog container with animations |
| `DialogHeader` | Title and description area |
| `DialogFooter` | Action buttons area |
| `DialogTitle` | Accessible dialog title |
| `DialogDescription` | Accessible description |
| `DialogClose` | Close button trigger |

#### Props Interface

```typescript
interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  // Inherits all Radix Dialog content props
}
```

#### Usage Example

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"

<Dialog>
  <DialogTrigger asChild>
    <Button>Edit Profile</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Edit Profile</DialogTitle>
      <DialogDescription>
        Make changes to your profile here.
      </DialogDescription>
    </DialogHeader>
    <div className="py-4">
      {/* Form content */}
    </div>
    <DialogFooter>
      <Button type="submit">Save changes</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

#### Features
- Accessible (ARIA compliant)
- Keyboard navigation (Escape to close)
- Backdrop blur effect
- Animation support
- RTL support

---

### 1.3 Tabs Component

**Location:** `frontend/src/components/ui/tabs.tsx`

Tabbed interface for content organization.

#### Compound Components

| Component | Purpose |
|-----------|---------|
| `Tabs` | Root container |
| `TabsList` | Container for tab triggers |
| `TabsTrigger` | Individual tab button |
| `TabsContent` | Content panel for each tab |

#### Usage Example

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

<Tabs defaultValue="account" className="w-[400px]">
  <TabsList>
    <TabsTrigger value="account">Account</TabsTrigger>
    <TabsTrigger value="password">Password</TabsTrigger>
  </TabsList>
  <TabsContent value="account">
    <p>Account settings content</p>
  </TabsContent>
  <TabsContent value="password">
    <p>Password settings content</p>
  </TabsContent>
</Tabs>
```

---

### 1.4 Card Component

**Location:** `frontend/src/components/ui/card.tsx`

Container component for content grouping.

#### Compound Components

| Component | Purpose |
|-----------|---------|
| `Card` | Main container |
| `CardHeader` | Header section with border |
| `CardTitle` | Title element |
| `CardDescription` | Subtitle/description |
| `CardContent` | Main content area |
| `CardFooter` | Footer with actions |

#### Usage Example

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>Project Status</CardTitle>
    <CardDescription>Overview of current projects</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Project details here</p>
  </CardContent>
  <CardFooter>
    <Button>View Details</Button>
  </CardFooter>
</Card>
```

---

### 1.5 Input Component

**Location:** `frontend/src/components/ui/input.tsx`

Form input element with consistent styling.

#### Props Interface

```typescript
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>
```

#### Usage Example

```tsx
import { Input } from "@/components/ui/input"

<Input 
  type="text" 
  placeholder="Enter your name" 
  className="max-w-sm"
/>

<Input 
  type="email" 
  disabled 
  value="user@example.com"
/>
```

#### Styling Features
- Focus ring with primary color
- RTL text direction support
- Disabled state styling
- Border transition animations

---

### 1.6 Select Component

**Location:** `frontend/src/components/ui/select.tsx`

Dropdown select component with full keyboard navigation.

#### Compound Components

| Component | Purpose |
|-----------|---------|
| `Select` | Root container |
| `SelectTrigger` | Dropdown button |
| `SelectValue` | Selected value display |
| `SelectContent` | Dropdown menu |
| `SelectItem` | Individual option |
| `SelectGroup` | Option grouping |
| `SelectLabel` | Group label |
| `SelectSeparator` | Visual divider |
| `SelectScrollUpButton` | Scroll navigation |
| `SelectScrollDownButton` | Scroll navigation |

#### Usage Example

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

<Select>
  <SelectTrigger className="w-[180px]">
    <SelectValue placeholder="Select a fruit" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="apple">Apple</SelectItem>
    <SelectItem value="banana">Banana</SelectItem>
    <SelectItem value="orange">Orange</SelectItem>
  </SelectContent>
</Select>
```

---

### 1.7 Table Component

**Location:** `frontend/src/components/ui/table.tsx`

Data table structure component.

#### Compound Components

| Component | Purpose |
|-----------|---------|
| `Table` | Table wrapper with overflow |
| `TableHeader` | thead element |
| `TableBody` | tbody element |
| `TableFooter` | tfoot element |
| `TableRow` | tr element with hover states |
| `TableHead` | th element with styling |
| `TableCell` | td element |
| `TableCaption` | caption element |

#### Usage Example

```tsx
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

<Table>
  <TableCaption>A list of recent invoices</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Invoice</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Method</TableHead>
      <TableHead>Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>INV001</TableCell>
      <TableCell>Paid</TableCell>
      <TableCell>Credit Card</TableCell>
      <TableCell>$250.00</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

---

### 1.8 Badge Component

**Location:** `frontend/src/components/ui/badge.tsx`

Status indicators and labels.

#### Props Interface

```typescript
export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
  VariantProps<typeof badgeVariants> {
  variant?: "default" | "secondary" | "destructive" | "outline" | null
}
```

#### Variants

| Variant | Colors | Use Case |
|---------|--------|----------|
| `default` | Navy background | Primary status |
| `secondary` | Cyan tint | Secondary info |
| `destructive` | Red | Error/Alert |
| `outline` | Bordered | Neutral |
| `success` | Green | Success states |

#### Usage Example

```tsx
import { Badge } from "@/components/ui/badge"

<Badge>New</Badge>
<Badge variant="secondary">Draft</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="success">Completed</Badge>
```

---

### 1.9 Data Table Component

**Location:** `frontend/src/components/ui/data-table.tsx`

Advanced table with sorting, filtering, and pagination using `@tanstack/react-table`.

#### Props Interface

```typescript
export interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKeys: string[]           // Fields to search
  searchPlaceholder?: string
  columnFilters?: ColumnFiltersState
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>
  isLoading?: boolean
  onRowSelectionChange?: (selectedIds: string[]) => void
}
```

#### Features
- Global search across specified fields
- Column visibility toggle
- Row selection with callbacks
- Loading skeleton state
- Pagination with navigation
- Animation support via Framer Motion

#### Usage Example

```tsx
import { DataTable } from "@/components/ui/data-table"
import { ColumnDef } from "@tanstack/react-table"

const columns: ColumnDef<Customer>[] = [
  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
]

<DataTable
  columns={columns}
  data={customers}
  searchKeys={["name", "email"]}
  searchPlaceholder="Search customers..."
  isLoading={isLoading}
  onRowSelectionChange={(ids) => console.log('Selected:', ids)}
/>
```

---

### 1.10 Alert Component

**Location:** `frontend/src/components/ui/alert.tsx`

Contextual feedback messages.

#### Props Interface

```typescript
interface AlertProps extends React.HTMLAttributes<HTMLDivElement> & 
  VariantProps<typeof alertVariants> {
  variant?: "default" | "destructive" | "success" | "warning"
}
```

#### Variants

| Variant | Background | Border | Icon Color |
|---------|------------|--------|------------|
| `default` | White | Navy tint | Navy |
| `destructive` | Red-50 | Red-200 | Red |
| `success` | Green/10 | Green/20 | Green |
| `warning` | Yellow/10 | Yellow/20 | Yellow |

#### Usage Example

```tsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

<Alert>
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Heads up!</AlertTitle>
  <AlertDescription>
    You can add components to your app using the cli.
  </AlertDescription>
</Alert>

<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    Something went wrong. Please try again.
  </AlertDescription>
</Alert>
```

---

### 1.11 Additional UI Components

#### Checkbox
**Location:** `frontend/src/components/ui/checkbox.tsx`

```tsx
import { Checkbox } from "@/components/ui/checkbox"

<Checkbox id="terms" />
<label htmlFor="terms">Accept terms</label>
```

#### Textarea
**Location:** `frontend/src/components/ui/textarea.tsx`

```tsx
import { Textarea } from "@/components/ui/textarea"

<Textarea placeholder="Enter your message" />
```

#### Label
**Location:** `frontend/src/components/ui/label.tsx`

```tsx
import { Label } from "@/components/ui/label"

<Label htmlFor="email">Email</Label>
<Input id="email" />
```

#### Progress
**Location:** `frontend/src/components/ui/progress.tsx`

```tsx
import { Progress } from "@/components/ui/progress"

<Progress value={33} />
```

#### Avatar
**Location:** `frontend/src/components/ui/avatar.tsx`

```tsx
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

<Avatar>
  <AvatarImage src="https://github.com/shadcn.png" />
  <AvatarFallback>CN</AvatarFallback>
</Avatar>
```

#### Skeleton
**Location:** `frontend/src/components/ui/skeleton.tsx`

```tsx
import { Skeleton } from "@/components/ui/skeleton"

<div className="space-y-2">
  <Skeleton className="h-4 w-[250px]" />
  <Skeleton className="h-4 w-[200px]" />
</div>
```

#### Dropdown Menu
**Location:** `frontend/src/components/ui/dropdown-menu.tsx`

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button>Open</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Profile</DropdownMenuItem>
    <DropdownMenuItem>Settings</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

#### Sheet (Slide-over)
**Location:** `frontend/src/components/ui/sheet.tsx`

```tsx
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

<Sheet>
  <SheetTrigger>Open</SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Edit profile</SheetTitle>
    </SheetHeader>
    {/* Content */}
  </SheetContent>
</Sheet>
```

#### Alert Dialog
**Location:** `frontend/src/components/ui/alert-dialog.tsx`

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

<AlertDialog>
  <AlertDialogTrigger>Delete</AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
      <AlertDialogDescription>
        This action cannot be undone.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancel</AlertDialogCancel>
      <AlertDialogAction>Continue</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

#### Calendar
**Location:** `frontend/src/components/ui/calendar.tsx`

```tsx
import { Calendar } from "@/components/ui/calendar"

<Calendar
  mode="single"
  selected={date}
  onSelect={setDate}
/>
```

#### Chart (Recharts Wrapper)
**Location:** `frontend/src/components/ui/chart.tsx`

```tsx
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"

<ChartContainer config={chartConfig}>
  <LineChart data={chartData}>
    <ChartTooltip content={<ChartTooltipContent />} />
    <Line type="monotone" dataKey="value" />
  </LineChart>
</ChartContainer>
```

---

## 2. Feature Components

### 2.1 Customer Components

Location: `frontend/src/components/customers/`

#### CustomerDetailCard

**Purpose:** Display comprehensive customer information in a modal/tab interface.

**Location:** `frontend/src/components/customers/CustomerDetailCard.tsx`

**Props Interface:**

```typescript
interface CustomerDetailCardProps {
  customer: any;                    // Customer data object
  onClose: () => void;             // Close handler
  onCreateRequest?: (customer: any, machine: any) => void;
  onExchange?: (customer: any, machine: any) => void;
  onReturn?: (customer: any, machine: any) => void;
  onViewHistory?: (serialNumber: string) => void;
  disabledMachines?: Set<string>;   // Machines with open requests
  onSimPurchase?: (customer: any) => void;
  onSimExchange?: (customer: any, sim: any) => void;
  onSimHistory?: (customer: any, sim: any) => void;
  onSimUpdate?: (id: string, type: string) => void;
}
```

**State Management:**
- Internal `showHistory` state for audit log modal
- Uses composition pattern with sub-components

**Events:**
- History modal toggle
- Tab switching between machines and info
- Delegates machine actions to parent

**Usage Example:**

```tsx
<CustomerDetailCard
  customer={selectedCustomer}
  onClose={() => setSelectedCustomer(null)}
  onCreateRequest={handleCreateRequest}
  onExchange={handleExchange}
  onViewHistory={handleViewHistory}
  disabledMachines={machinesWithOpenRequests}
/>
```

**Sub-components:**
- `CustomerDetailHeader` - Header with customer info and actions
- `CustomerDetailTabs` - Tab navigation
- `CustomerMachinesTab` - Machines and SIM cards list
- `CustomerInfoTab` - Customer details display

---

#### CustomerStats

**Purpose:** Dashboard statistics cards showing customer metrics.

**Location:** `frontend/src/components/customers/CustomerStats.tsx`

**Props Interface:**

```typescript
interface CustomerStatsProps {
  stats: {
    customers: number;    // Total customers count
    machines: number;     // Total machines count
    simCards: number;     // Total SIM cards count
  };
}
```

**Features:**
- RTL layout (Arabic interface)
- Icon integration from lucide-react
- Hover animations
- Gradient backgrounds

**Usage Example:**

```tsx
<CustomerStats 
  stats={{
    customers: 150,
    machines: 320,
    simCards: 145
  }}
/>
```

---

#### CustomerSearch

**Purpose:** Real-time search component with dropdown results.

**Location:** `frontend/src/components/customers/CustomerSearch.tsx`

**Props Interface:**

```typescript
interface CustomerSearchProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: any[];       // Search result items
  onSelectResult: (result: any) => void;
}
```

**Features:**
- Full-width search input with icon
- Dropdown results panel
- Result type indicators (customer, machine, sim)
- Animated transitions

---

#### CustomerModals

**Purpose:** Collection of modal dialogs for customer operations.

**Location:** `frontend/src/components/customers/CustomerModals.tsx`

**Components:**
- `CreateCustomerModal` - Add new customer
- `EditCustomerModal` - Edit existing customer
- `DeleteCustomerDialog` - Confirmation for deletion

---

#### AllMachinesTable

**Purpose:** Table display of all customer machines.

**Location:** `frontend/src/components/customers/AllMachinesTable.tsx`

**Props:**
- `machines`: Array of machine objects
- `onAction`: Callback for row actions
- `disabledMachines`: Set of machine IDs to disable

---

#### AllSimCardsTable

**Purpose:** Table display of all customer SIM cards.

**Location:** `frontend/src/components/customers/AllSimCardsTable.tsx`

---

#### MachineActionModals

**Purpose:** Modals for machine-related actions.

**Location:** `frontend/src/components/customers/MachineActionModals.tsx`

**Includes:**
- Create request modal
- Exchange machine modal
- Return machine modal

---

### 2.2 Warehouse Components

Location: `frontend/src/components/warehouse/`

#### MachineExchangeModal

**Purpose:** Modal for exchanging machines between warehouse and customers.

**Location:** `frontend/src/components/warehouse/MachineExchangeModal.tsx`

**Props Interface:**

```typescript
interface MachineExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ExchangeData) => void;
  selectedMachine: any;          // Machine leaving warehouse
  isLoading: boolean;
  performedBy: string;           // User performing action
}

interface ExchangeData {
  outgoingMachineId: string;
  customerId: string;
  incomingMachineId: string;
  incomingStatus: 'STANDBY' | 'DEFECTIVE' | 'CLIENT_REPAIR';
  incomingNotes: string;
  performedBy: string;
}
```

**State:**
- `clientSearch`: Search term for customers
- `selectedClient`: Selected customer
- `clientMachines`: Machines owned by selected customer
- `exchangeData`: Form data for incoming machine

**Features:**
- Live customer search with debouncing
- Customer machine selection
- Status selection for incoming machine
- Notes input with validation

**Usage Example:**

```tsx
<MachineExchangeModal
  isOpen={showExchangeModal}
  onClose={() => setShowExchangeModal(false)}
  onSubmit={handleExchange}
  selectedMachine={selectedMachine}
  isLoading={isProcessing}
  performedBy={user.id}
/>
```

---

#### RepairModal

**Purpose:** Modal for logging machine repair operations.

**Location:** `frontend/src/components/warehouse/RepairModal.tsx`

**Props Interface:**

```typescript
interface RepairModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: RepairPayload) => void;
  selectedMachine: any;
  isLoading: boolean;
}

interface RepairPayload {
  resolution: 'REPAIRED' | 'SCRAPPED' | 'REJECTED_REPAIR';
  notes: string;
  parts: Array<{
    partId: string;
    name: string;
    quantity: number;
    cost: number;
  }>;
}
```

**Features:**
- Resolution type selection
- Spare parts inventory integration
- Parts cost calculation
- Engineer report textarea

---

#### MachineWarehouseStats

**Purpose:** Statistics dashboard for machine warehouse.

**Location:** `frontend/src/components/warehouse/MachineWarehouseStats.tsx`

**Props Interface:**

```typescript
interface MachineWarehouseStatsProps {
  counts: Record<string, number>;   // Status counts
  isAffairs: boolean;               // User role flags
  isCenterManager: boolean;
}
```

**Status Categories:**
- `NEW` - New machines
- `STANDBY` - Exchange machines
- `DEFECTIVE` - Defective machines
- `CLIENT_REPAIR` - Customer repairs
- `REPAIRED` - Successfully repaired

---

#### Additional Warehouse Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `MachineSaleModal` | Sell machine to customer | `MachineSaleModal.tsx` |
| `AddMachineModal` | Add new machine to warehouse | `AddMachineModal.tsx` |
| `TransferMachinesModal` | Transfer between locations | `TransferMachinesModal.tsx` |
| `MachineImportModal` | Import machines from file | `MachineImportModal.tsx` |
| `MachineReturnToCustomerModal` | Return machine to customer | `MachineReturnToCustomerModal.tsx` |
| `MachineRepairModal` | Send machine for repair | `MachineRepairModal.tsx` |
| `AssignTechnicianModal` | Assign tech to machine | `AssignTechnicianModal.tsx` |
| `MaintenanceTransferModal` | Transfer for maintenance | `MaintenanceTransferModal.tsx` |
| `MaintenanceKanban` | Kanban board view | `MaintenanceKanban.tsx` |
| `MachineLogsTable` | Machine history logs | `MachineLogsTable.tsx` |
| `MachineImportExport` | Import/export utilities | `MachineImportExport.tsx` |
| `MachineWarehouseColumns` | Table column definitions | `MachineWarehouseColumns.tsx` |

---

### 2.3 Reports Components

Location: `frontend/src/components/reports/`

#### FinancialOverview

**Purpose:** Financial dashboard with charts and metrics.

**Location:** `frontend/src/components/reports/FinancialOverview.tsx`

**Props Interface:**

```typescript
interface FinancialOverviewProps {
  data: {
    financials: {
      totalSales: number;
      totalCollected: number;
      totalOutstanding: number;
      inventoryValue: number;
      breakdown: BreakdownData;
    };
    trends: Array<{
      name: string;
      sales: number;
      collections: number;
    }>;
    metrics: {
      totalRequests: number;
      closedRequests: number;
      closureRate: number;
      avgResolutionTimeHours: number;
    };
    recentPayments: Payment[];
    recentRequests: Request[];
  };
}
```

**Features:**
- Area charts for sales/collections trends
- Pie chart for collection ratio
- Statistics cards with breakdown
- Recent transactions tables
- Operational metrics grid

**Dependencies:**
- `recharts` - Charting library
- `lucide-react` - Icons
- `StatCard` - Statistics component

---

#### StatCard

**Purpose:** Reusable statistics card with trend indicators.

**Location:** `frontend/src/components/reports/StatCard.tsx`

**Props Interface:**

```typescript
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'emerald' | 'orange' | 'purple';
  trend?: string;              // Trend text
  trendUp?: boolean;           // Direction indicator
  suffix?: string;             // Unit suffix (e.g., "ج.م")
  breakdown?: {
    machines: number;
    sims: number;
    maintenance: number;
    manual: number;
    other: number;
  };
}
```

---

#### Additional Reports Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `BranchRankings` | Branch performance comparison | `BranchRankings.tsx` |
| `GovernoratePerformance` | Geographic performance | `GovernoratePerformance.tsx` |
| `InventoryAnalytics` | Inventory insights | `InventoryAnalytics.tsx` |
| `InventoryMovementReport` | Stock movement tracking | `InventoryMovementReport.tsx` |
| `PosStockReport` | POS inventory report | `PosStockReport.tsx` |
| `PosSalesReport` | Sales analysis report | `PosSalesReport.tsx` |
| `AiStrategicAssistant` | AI-powered insights | `AiStrategicAssistant.tsx` |
| `ReportsTabs` | Report navigation tabs | `ReportsTabs.tsx` |
| `ReportsFilters` | Report filtering controls | `ReportsFilters.tsx` |
| `TabButton` | Custom tab button | `TabButton.tsx` |

---

## 3. Custom Hooks

Location: `frontend/src/hooks/`

### 3.1 useApiMutation

**Purpose:** Wrapper around `useMutation` with automatic toast notifications and query invalidation.

**Location:** `frontend/src/hooks/useApiMutation.ts`

**Interface:**

```typescript
interface ApiMutationOptions<TData, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  successMessage?: string;
  successDetail?: string | ((data: TData) => string);
  errorMessage?: string;
  invalidateKeys?: string[][];    // Query keys to invalidate
  onSuccess?: (data: TData, variables: TVariables, context: unknown) => void;
  onError?: (error: any, variables: TVariables, context: unknown) => void;
}

function useApiMutation<TData = any, TVariables = any>(
  options: ApiMutationOptions<TData, TVariables>
): UseMutationResult<TData, Error, TVariables, unknown>
```

**Features:**
- Automatic success/error toasts
- Backend error message extraction
- Query cache invalidation
- Custom success/error callbacks

**Usage Example:**

```typescript
import { useApiMutation } from '@/hooks/useApiMutation';
import { api } from '@/api/client';

const createCustomerMutation = useApiMutation({
  mutationFn: api.createCustomer,
  successMessage: 'تم إنشاء العميل بنجاح',
  successDetail: (data) => data.client_name,
  errorMessage: 'فشل إنشاء العميل',
  invalidateKeys: [['customers']],
  onSuccess: (data) => {
    // Custom logic
    navigate(`/customers/${data.bkcode}`);
  }
});

// Usage
await createCustomerMutation.mutateAsync(customerData);
```

**Error Handling:**
Extracts detailed error messages from backend response structure:
```
{ error: { message: "...", details: { field: "error" } } }
```

---

### 3.2 useCustomerData

**Purpose:** Comprehensive data hook for customer management page.

**Location:** `frontend/src/hooks/useCustomerData.ts`

**Interface:**

```typescript
function useCustomerData(
  isAdmin: boolean,
  initialBranchId?: string
): {
  // Branch filtering
  filterBranchId: string;
  setFilterBranchId: (id: string) => void;
  
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchResults: SearchResult[];
  
  // Selection
  selectedCustomerCode: string | null;
  setSelectedCustomerCode: (code: string | null) => void;
  selectedCustomer: Customer | null;
  
  // Data
  branches: Branch[];
  customers: Customer[];
  isLoading: boolean;
  error: Error | null;
  
  // Derived
  machinesWithOpenRequests: Set<string>;
  stats: {
    customers: number;
    machines: number;
    simCards: number;
  };
}
```

**Features:**
- Automatic data normalization (handles various API response shapes)
- Branch filtering for admins
- Multi-field search (customer name, code, machine serial)
- Stats calculation
- Open request tracking

**Response Normalization:**
```typescript
// Handles all these shapes:
Customer[]                          // Direct array
{ data: Customer[] }               // Wrapped in data
{ customers: Customer[] }          // Wrapped in customers
{ items: Customer[] }              // Wrapped in items
```

**Usage Example:**

```typescript
const {
  customers,
  searchQuery,
  setSearchQuery,
  searchResults,
  selectedCustomer,
  setSelectedCustomerCode,
  stats,
  isLoading
} = useCustomerData(isAdmin, initialBranchId);
```

---

### 3.3 useAuthQuery

**Purpose:** Wrapper around `useQuery` that checks authentication before enabling.

**Location:** `frontend/src/hooks/useAuthQuery.ts`

**Interface:**

```typescript
function useAuthQuery<TQueryFnData, TError, TData, TQueryKey extends QueryKey>(
  options: Omit<UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>, 'enabled'> & {
    enabled?: boolean;
  }
): UseQueryResult<TData, TError>
```

**Purpose:**
- Prevents API calls before user is authenticated
- Combines auth check with custom enabled logic
- Avoids 500 errors on protected endpoints

**Usage Example:**

```typescript
import { useAuthQuery } from '@/hooks/useAuthQuery';

const { data: customers } = useAuthQuery({
  queryKey: ['customers'],
  queryFn: () => api.getCustomers(),
  // Automatically disabled if !user
  // Can also add: enabled: someCondition
});
```

---

### 3.4 usePushNotifications

**Purpose:** Manages browser push notification subscription.

**Location:** `frontend/src/hooks/usePushNotifications.ts`

**Interface:**

```typescript
function usePushNotifications(): {
  isSupported: boolean;
  permission: NotificationPermission;
  subscription: PushSubscription | null;
  requestPermission: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
}
```

**Features:**
- Service worker registration
- VAPID key subscription
- Backend subscription sync
- Permission management

**Usage Example:**

```typescript
const { isSupported, permission, requestPermission, unsubscribe } = usePushNotifications();

// Check support
if (isSupported) {
  // Request permission
  const granted = await requestPermission();
  if (granted) {
    console.log('Push notifications enabled');
  }
}
```

---

## 4. Component Patterns

### 4.1 Compound Components Pattern

Used in: Dialog, Tabs, Dropdown Menu, Select, Sheet, Alert Dialog

**Pattern:**
```tsx
// Parent exports multiple related components
export {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
}

// Usage
<Dialog>
  <DialogTrigger>Open</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Desc</DialogDescription>
    </DialogHeader>
    Content
    <DialogFooter>Actions</DialogFooter>
  </DialogContent>
</Dialog>
```

**Benefits:**
- Flexibility in layout
- Explicit component relationships
- ARIA accessibility built-in

---

### 4.2 Container/Presentational Pattern

**Container Component (Smart):**
```tsx
// CustomerDetailCard.tsx - Container
export default function CustomerDetailCard({ customer, onClose, ... }) {
  const [showHistory, setShowHistory] = useState(false);
  
  return (
    <div className="...">
      <CustomerDetailHeader 
        customer={customer} 
        onClose={onClose}
        onShowHistory={() => setShowHistory(true)}
      />
      <Tabs>
        <CustomerMachinesTab customer={customer} ... />
        <CustomerInfoTab customer={customer} />
      </Tabs>
    </div>
  );
}
```

**Presentational Component (Dumb):**
```tsx
// CustomerStats.tsx - Presentational
export default function CustomerStats({ stats }: CustomerStatsProps) {
  return (
    <div className="smart-grid">
      {/* Pure UI rendering based on props */}
    </div>
  );
}
```

---

### 4.3 Custom Hook Pattern

**Pattern:**
```typescript
// useCustomerData.ts
export function useCustomerData(isAdmin: boolean, initialBranchId?: string) {
  // State management
  const [filterBranchId, setFilterBranchId] = useState(initialBranchId || '');
  
  // Data fetching
  const { data: customers } = useQuery({...});
  
  // Derived state
  const stats = useMemo(() => {...}, [customers]);
  
  // Return everything component needs
  return {
    filterBranchId,
    setFilterBranchId,
    customers,
    stats,
    // ...
  };
}
```

**Benefits:**
- Separation of concerns
- Reusable logic
- Easier testing

---

### 4.4 Forward Ref Pattern

Used in most UI components for ref forwarding.

```tsx
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
```

---

## 5. Shared Components

### 5.1 Layout Component

**Location:** `frontend/src/components/Layout.tsx`

**Purpose:** Application shell with navigation, header, and content area.

**Features:**
- Material Design 3 navigation rail
- Collapsible sidebar (desktop: 20px, hover: 72px)
- Mobile drawer overlay
- Role-based navigation filtering
- Notification bell integration
- User profile dropdown
- Zoom controls (70% - 150%)
- Real-time stats badges

**Navigation Groups:**
1. Dashboard (لوحات التحكم)
2. Maintenance (الصيانة)
3. Customers & Sales (العملاء والمبيعات)
4. Warehouse & Transfers (المخازن والنقل)
5. Management & Reports (الإدارة والتقارير)

**State:**
- `isSidebarOpen`: Mobile sidebar visibility
- `isProfileOpen`: Profile dropdown state
- `expandedGroups`: Expanded nav groups
- `zoomLevel`: Page zoom level

---

### 5.2 PageHeader Component

**Location:** `frontend/src/components/PageHeader.tsx`

**Purpose:** Consistent page header with title, subtitle, and actions.

**Props Interface:**

```typescript
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;     // Buttons, links, etc.
  filter?: ReactNode;      // Filter controls
  showDot?: boolean;       // Animated dot indicator
  className?: string;
}
```

**Usage Example:**

```tsx
<PageHeader
  title="العملاء"
  subtitle="إدارة بيانات العملاء والأجهزة"
  filter={<BranchFilter />}
  actions={
    <>
      <Button onClick={handleExport}>تصدير</Button>
      <Button onClick={handleAdd}>إضافة عميل</Button>
    </>
  }
/>
```

---

### 5.3 NotificationBell Component

**Location:** `frontend/src/components/NotificationBell.tsx`

**Purpose:** Real-time notification center with WebSocket support.

**Features:**
- Unread count badge
- Notification list dropdown
- Real-time updates via WebSocket
- Sound notifications (configurable)
- Mark as read (individual & bulk)
- Toast notifications for new items
- Navigation on notification click

**State:**
- `isOpen`: Dropdown visibility
- `audioRef`: Audio element for sound

**Integrations:**
- SocketContext for real-time events
- SettingsContext for preferences
- React Query for data fetching

---

### 5.4 Modal System Components

**Common Modal Pattern:**

All modals follow a consistent structure:

```tsx
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  // ... specific props
}

// Structure
<AnimatePresence>
  <div className="fixed inset-0 z-50 ..."> {/* Backdrop */}
    <motion.div> {/* Animated content */}
      <form onSubmit={handleSubmit}>
        {/* Form fields */}
        <div className="flex gap-3"> {/* Footer actions */}
          <Button type="submit">Confirm</Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </motion.div>
  </div>
</AnimatePresence>
```

**Animation:**
- Framer Motion for enter/exit animations
- Scale and fade effects
- Staggered content animation

---

### 5.5 Form Components

**Form Pattern with UI Components:**

```tsx
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

<form onSubmit={handleSubmit}>
  <div className="space-y-2">
    <Label htmlFor="name">Name</Label>
    <Input id="name" value={name} onChange={...} />
  </div>
  
  <div className="space-y-2">
    <Label>Status</Label>
    <Select value={status} onValueChange={...}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="inactive">Inactive</SelectItem>
      </SelectContent>
    </Select>
  </div>
  
  <Button type="submit">Save</Button>
</form>
```

---

## 6. Component Reference Tables

### 6.1 UI Components Summary

| Component | Location | Radix Base | Dependencies | Key Features |
|-----------|----------|------------|--------------|--------------|
| Button | `ui/button.tsx` | Slot | cva, lucide | 7 variants, 4 sizes |
| Dialog | `ui/dialog.tsx` | DialogPrimitive | - | Overlay, animations, compound |
| Tabs | `ui/tabs.tsx` | TabsPrimitive | - | 4 sub-components |
| Card | `ui/card.tsx` | - | - | 6 sub-components |
| Input | `ui/input.tsx` | - | - | Focus ring, RTL support |
| Select | `ui/select.tsx` | SelectPrimitive | lucide | Full keyboard nav, 10 parts |
| Table | `ui/table.tsx` | - | - | 7 sub-components |
| Badge | `ui/badge.tsx` | - | cva | 5 variants |
| Data Table | `ui/data-table.tsx` | TanStack Table | framer-motion | Sort, filter, pagination |
| Alert | `ui/alert.tsx` | - | cva | 4 variants, icon support |
| Checkbox | `ui/checkbox.tsx` | CheckboxPrimitive | lucide | Animated check |
| Textarea | `ui/textarea.tsx` | - | - | Resize-none default |
| Label | `ui/label.tsx` | LabelPrimitive | cva | Peer disabled styling |
| Progress | `ui/progress.tsx` | ProgressPrimitive | - | Animated progress |
| Avatar | `ui/avatar.tsx` | AvatarPrimitive | - | Image + fallback |
| Skeleton | `ui/skeleton.tsx` | - | - | Pulse animation |
| Dropdown Menu | `ui/dropdown-menu.tsx` | DropdownMenuPrimitive | lucide | 15 sub-components |
| Sheet | `ui/sheet.tsx` | DialogPrimitive | cva | 4 side positions |
| Alert Dialog | `ui/alert-dialog.tsx` | AlertDialogPrimitive | - | Confirmation dialogs |
| Calendar | `ui/calendar.tsx` | react-day-picker | - | Date picker |
| Chart | `ui/chart.tsx` | recharts | - | Theming support |

### 6.2 Customer Components Summary

| Component | Location | Purpose | Props Count |
|-----------|----------|---------|-------------|
| CustomerDetailCard | `customers/CustomerDetailCard.tsx` | Customer detail view | 10 |
| CustomerStats | `customers/CustomerStats.tsx` | Dashboard stats | 1 |
| CustomerSearch | `customers/CustomerSearch.tsx` | Search with dropdown | 4 |
| CustomerQuickList | `customers/CustomerQuickList.tsx` | Quick customer list | 3 |
| CustomerModals | `customers/CustomerModals.tsx` | CRUD modals | - |
| CustomerHeader | `customers/CustomerHeader.tsx` | Page header | 4 |
| AllMachinesTable | `customers/AllMachinesTable.tsx` | Machines table | 5 |
| AllSimCardsTable | `customers/AllSimCardsTable.tsx` | SIM cards table | 4 |
| MachineActionModals | `customers/MachineActionModals.tsx` | Action dialogs | - |
| CustomerDetailHeader | `customers/details/CustomerDetailHeader.tsx` | Detail header | 3 |
| CustomerDetailTabs | `customers/details/CustomerDetailTabs.tsx` | Tab navigation | 2 |
| CustomerMachinesTab | `customers/details/CustomerMachinesTab.tsx` | Machines tab | 8 |
| CustomerInfoTab | `customers/details/CustomerInfoTab.tsx` | Info tab | 1 |

### 6.3 Warehouse Components Summary

| Component | Location | Purpose | Key Feature |
|-----------|----------|---------|-------------|
| MachineExchangeModal | `warehouse/MachineExchangeModal.tsx` | Exchange machines | Live customer search |
| RepairModal | `warehouse/RepairModal.tsx` | Log repairs | Spare parts tracking |
| MachineWarehouseStats | `warehouse/MachineWarehouseStats.tsx` | Stats dashboard | Role-based display |
| MachineSaleModal | `warehouse/MachineSaleModal.tsx` | Sell machines | Customer selection |
| AddMachineModal | `warehouse/AddMachineModal.tsx` | Add machines | Serial validation |
| TransferMachinesModal | `warehouse/TransferMachinesModal.tsx` | Transfers | Multi-select |
| MachineImportModal | `warehouse/MachineImportModal.tsx` | Import | File upload |
| MachineReturnToCustomerModal | `warehouse/MachineReturnToCustomerModal.tsx` | Returns | Status tracking |
| MachineRepairModal | `warehouse/MachineRepairModal.tsx` | Repair requests | Technician assignment |
| AssignTechnicianModal | `warehouse/AssignTechnicianModal.tsx` | Tech assignment | Availability check |
| MaintenanceTransferModal | `warehouse/MaintenanceTransferModal.tsx` | Maintenance | Multi-machine |
| MaintenanceKanban | `warehouse/MaintenanceKanban.tsx` | Board view | Drag & drop |
| MachineLogsTable | `warehouse/MachineLogsTable.tsx` | History | Timeline view |
| MachineImportExport | `warehouse/MachineImportExport.tsx` | Import/export | CSV/Excel |
| MachineWarehouseColumns | `warehouse/MachineWarehouseColumns.tsx` | Table columns | Column definitions |

### 6.4 Reports Components Summary

| Component | Location | Purpose | Visualization |
|-----------|----------|---------|---------------|
| FinancialOverview | `reports/FinancialOverview.tsx` | Financial dashboard | Area charts, pie |
| StatCard | `reports/StatCard.tsx` | Statistic cards | Trend indicators |
| BranchRankings | `reports/BranchRankings.tsx` | Branch comparison | Bar charts |
| GovernoratePerformance | `reports/GovernoratePerformance.tsx` | Regional data | Map/chart |
| InventoryAnalytics | `reports/InventoryAnalytics.tsx` | Inventory insights | Multiple charts |
| InventoryMovementReport | `reports/InventoryMovementReport.tsx` | Stock movement | Table |
| PosStockReport | `reports/PosStockReport.tsx` | POS inventory | Table |
| PosSalesReport | `reports/PosSalesReport.tsx` | Sales analysis | Charts |
| AiStrategicAssistant | `reports/AiStrategicAssistant.tsx` | AI insights | Text/cards |
| ReportsTabs | `reports/ReportsTabs.tsx` | Navigation | Tabs |
| ReportsFilters | `reports/ReportsFilters.tsx` | Filtering | Form controls |
| TabButton | `reports/TabButton.tsx` | Tab button | Custom styling |

### 6.5 Custom Hooks Summary

| Hook | Location | Purpose | Dependencies |
|------|----------|---------|--------------|
| useApiMutation | `hooks/useApiMutation.ts` | Mutation wrapper | react-query, toast |
| useCustomerData | `hooks/useCustomerData.ts` | Customer data | react-query |
| useAuthQuery | `hooks/useAuthQuery.ts` | Auth-aware query | react-query, AuthContext |
| usePushNotifications | `hooks/usePushNotifications.ts` | Push notifications | AuthContext, SettingsContext |

### 6.6 Shared Components Summary

| Component | Location | Purpose | Key Features |
|-----------|----------|---------|--------------|
| Layout | `components/Layout.tsx` | App shell | Sidebar, header, zoom |
| PageHeader | `components/PageHeader.tsx` | Page headers | Title, actions, filters |
| NotificationBell | `components/NotificationBell.tsx` | Notifications | WebSocket, real-time |
| ProtectedRoute | `components/ProtectedRoute.tsx` | Route protection | Role checking |
| StatusBar | `components/StatusBar.tsx` | Footer status | Connection status |

---

## 7. Styling Conventions

### 7.1 Tailwind Configuration

**Custom Colors:**
- `primary`: #0A2472 (Navy blue - brand color)
- `secondary`: Light tints for backgrounds
- `muted`: Neutral grays
- `accent`: Cyan (#6CE4F0)
- `success`: Green (#80C646)
- `warning`: Orange (#F5C451)
- `destructive`: Red

### 7.2 RTL Support

All components support RTL layouts:
```tsx
// Use logical properties
<div className="ml-auto"> {/* margin-left: auto */}
<div className="mr-3">   {/* margin-right: 3 */}

// RTL-aware components
<input dir="auto" />     {/* Automatic text direction */}
```

### 7.3 Animation Standards

**Standard Durations:**
- Fast: 150ms (hover states)
- Normal: 200-300ms (transitions)
- Slow: 500ms (page animations)

**Common Animations:**
- `animate-in fade-in slide-in-from-bottom-4 duration-500`
- `hover:shadow-lg transition-all`
- `group-hover:scale-110 transition-transform`

---

## 8. Best Practices

### 8.1 Component Creation

1. **Use TypeScript** for all props
2. **Forward refs** for DOM elements
3. **Set displayName** for debugging
4. **Use cn() utility** for class merging
5. **Export both component and variants** (if using CVA)

### 8.2 Data Fetching

1. **Use useAuthQuery** for protected endpoints
2. **Use useApiMutation** for mutations with toasts
3. **Normalize responses** in hooks (handle different shapes)
4. **Invalidate queries** after mutations
5. **Set staleTime** for static data (branches, settings)

### 8.3 Form Handling

1. **Use controlled components**
2. **Show loading states** on submit
3. **Validate before submission**
4. **Use isLoading prop** to disable inputs
5. **Show inline errors** when possible

### 8.4 Error Handling

1. **Use useApiMutation** for consistent error toasts
2. **Extract meaningful messages** from backend
3. **Log unexpected errors** to console
4. **Show fallback UI** for component errors
5. **Use error boundaries** for critical sections

---

## 9. Dependencies Overview

### Core Dependencies

| Package | Purpose |
|---------|---------|
| `react` / `react-dom` | UI library |
| `typescript` | Type safety |
| `tailwindcss` | Styling |
| `@radix-ui/*` | Headless UI primitives |
| `class-variance-authority` | Component variants |
| `tailwind-merge` | Class merging |
| `clsx` | Conditional classes |
| `lucide-react` | Icon library |

### Data & State

| Package | Purpose |
|---------|---------|
| `@tanstack/react-query` | Data fetching |
| `axios` | HTTP client |
| `zustand` | State management |
| `react-hook-form` | Form handling |
| `zod` | Validation |

### Animation

| Package | Purpose |
|---------|---------|
| `framer-motion` | Animations |
| `recharts` | Charts |

### Utilities

| Package | Purpose |
|---------|---------|
| `date-fns` | Date formatting |
| `react-hot-toast` | Notifications |
| `socket.io-client` | Real-time |

---

**End of Frontend Components Documentation**
