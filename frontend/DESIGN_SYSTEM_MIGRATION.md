# Design System Migration & Unification Guide

> **MIGRATION STATUS: 🔴 PENDING**
>
> This document outlines the mandatory steps to unify the Smart Enterprise Suite design language. Our goal is to eliminate inconsistent "premium" styles (ad-hoc Indigo/Violet gradients) and enforce the core Navy Blue (`#0A2472`) identity across all screens.

---

## 1. Design System Guardrails

### 🎨 Color Palette & Tokens
**Rule:** Use *semantic* tokens only. Never use raw color values or arbitrary Tailwind palette classes for primary UI elements.

| Category | Allowed Token (Utility) | ❌ Forbidden (Do Not Use) |
| :--- | :--- | :--- |
| **Primary Brand** | `bg-primary`, `text-primary`, `border-primary` | `bg-[#0A2472]`, `bg-blue-900`, `text-navy` |
| **Accents** | `bg-accent`, `text-accent-foreground` | `bg-indigo-500`, `text-violet-700` |
| **Gradients** | `bg-smart-gradient` (to be created) | `bg-gradient-to-r from-indigo-600 to-violet-700` |
| **Destructive** | `bg-destructive`, `text-destructive-foreground` | `bg-red-500`, `bg-rose-600` |
| **Success** | `bg-success` (custom utility), `text-success` | `bg-green-500`, `text-emerald-600` |
| **Muted/Subtle** | `bg-muted`, `text-muted-foreground` | `bg-gray-100`, `text-slate-400` |

### 🧩 Components
**Rule:** Use the `components/ui` library. Do not build UI elements from scratch using HTML tags.

| Component | ✅ Do This | ❌ Don't Do This |
| :--- | :--- | :--- |
| **Buttons** | `<Button variant="default">Save</Button>` | `<button className="bg-primary text-white p-2 rounded">Save</button>` |
| **Inputs** | `<Input placeholder="..." />` | `<input className="border border-gray-300 rounded" />` |
| **Cards** | `<Card><CardHeader>...</CardHeader></Card>` | `<div className="bg-white shadow rounded p-4">...</div>` |
| **Dialogs** | `<Dialog>...</Dialog>` | Custom fixed overlay divs |
| **Badges** | `<Badge variant="secondary">New</Badge>` | `<span className="bg-gray-100 rounded px-2">New</span>` |

### 📐 Spacing & Radius
**Rule:** Stick to the grid.
*   **Radius**:
    *   `rounded-lg` (0.5rem) for inputs, buttons, and small elements.
    *   `rounded-xl` (0.75rem) for cards, modals, and containers.
    *   `rounded-full` for badges, avatars, and pill buttons.
*   **Spacing**: Use standard Tailwind spacing (`p-4`, `m-2`, `gap-3`). Avoid arbitrary values like `p-[13px]`.

---

## 2. Interactive States & Accessibility

### State Requirements
All interactive elements must have visual feedback for these states:
1.  **Hover**: Subtle brightness change or background shift.
    *   *Standard:* `hover:bg-primary/90`
2.  **Focus**: Visible ring for keyboard navigation.
    *   *Standard:* `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` (Built-in to `shadcn/ui` components).
3.  **Active/Pressed**: Slight scale down or darker background.
4.  **Disabled**: Reduced opacity and pointer events removed.
    *   *Standard:* `disabled:opacity-50 disabled:pointer-events-none`

### Accessibility Checklist
*   **Contrast**: Text must satisfy WCAG AA (4.5:1) against its background.
    *   *Check:* White text on `bg-primary` (Navy) is safe. Gray text on white must be `text-slate-600` or darker.
*   **Hit Areas**: Interactive elements must be at least 44x44px (or have enough padding).
*   **Labels**: All inputs must have a visible `<Label>` or `aria-label`.

---

## 3. Tooling & Automation (Recommended)

To prevent regressions, we recommend adding:
1.  **ESLint Plugin Tailwind**:
    *   Configure `eslint-plugin-tailwindcss` to warn on arbitrary values (e.g., `w-[123px]`).
    *   Enforce class logical ordering.
2.  **Commit Hooks (Husky)**:
    *   Run a script to grep for forbidden classes (`bg-indigo-`, `bg-violet-`) before commit.

---

## 4. Migration Phase Plan

### Phase 1: Foundation (Zero Risk)
*Goal: Establish the new tokens without breaking existing UI.*

- [x] **1.1. Update `index.css`**:
    - [x] Define the official `bg-smart-gradient` class:
        ```css
        .bg-smart-gradient {
            background: linear-gradient(to right, hsl(var(--primary)), hsl(var(--primary) / 0.9));
        }
        ```
    - [x] Add missing semantic colors for `success`, `warning`, `info` to `:root` variables.
- [x] **1.2. Tailwind Config**:
    - [x] Extend `tailwind.config.js` to map `success` and `warning` to the new CSS variables.

### Phase 2: Component Refactoring (High Impact)
*Goal: Fix the "Premium" outliers to match the system.*

- [x] **Refactor `Layout.tsx` and Sidebar**:
    - [x] Replaced ad-hoc `rose-500` badges with `destructive` token.
    - [x] Standardized Logout button.
    - [x] Ensured consistent navigation item styling.
- [x] **Refactor Modals**:
    - [x] `CreateRequestModal.tsx`:
        - [x] Replaced gradient header with `bg-smart-gradient`.
        - [x] Used `Input`/`Button` components.
        - [x] Removed ad-hoc color classes.
- [x] **Refactor Dashboards**:
    - [x] `Dashboard.tsx`:
        - [x] Replaced ad-hoc colors (`emerald`, `indigo`, `rose`) with semantic tokens (`success`, `primary`, `destructive`).
        - [x] Updated gradients and button styles.
    - [x] `AdminDashboard.tsx`:
        - [x] Standardized charts colors.
        - [x] Updated status badges and metric cards.
- [x] **Refactor Settings**:
    - [x] `Settings.tsx`: Standardized tab colors to use `primary` and `destructive` tokens.
- [x] **Refactor Authentication**:
    - [x] `Login.tsx`: Applied `bg-smart-gradient` and primary brand colors.

### Phase 3: Global Standardization (Sweep)
*Goal: Catch any remaining hardcoded values.*

- [ ] **3.1. Global Search & Replace**:
    - [ ] Search for `bg-indigo-`, `bg-violet-`, `bg-purple-`, `bg-amber-`.
    - [ ] Replace with `bg-primary` (for brands) or `bg-warning` (for alerts).
- [ ] **3.2. Typography Audit**:
    - [ ] Search for `font-black`. Replace with `font-bold` for standard UI, keep `font-black` only for hero numbers/headers if designed.
- [ ] **3.3. Radius Audit**:
    - [ ] Search for `rounded-2xl` or `rounded-3xl` and standardize to `rounded-xl` for consistency.

### Phase 4: Verification & QA
*Goal: Ensure nothing is broken visually.*

- [ ] **4.1. Visual Regression Check**:
    - [ ] **Dashboard**: Verify charts match Navy palette.
    - [ ] **Create Request**: open modal, check steps, check "Select Customer" dropdown.
    - [ ] **Settings**: Check toggle switches and form fields.
- [ ] **4.2. Dark Mode Check**:
    - [ ] Toggle a mock dark mode class (if supported) to see if hardcoded colors break readability.
- [ ] **4.3. Interactive Check**:
    - [ ] Tab through the "Create Request" form. Ensure focus rings are visible and Navy colored.

---

## 5. Visual Reference

| Area | Correct Style |
| :--- | :--- |
| **Modal Header** | Navy Blue Gradient (`bg-smart-gradient`) |
| **Primary Button** | Navy Blue Gradient (`bg-smart-gradient`) |
| **Active Nav Item** | Navy Blue Background, White Text |
| **Input Focus** | Navy Blue Ring (`ring-primary`) |
| **Success State** | Green (`text-success`), **never** Teal/Cyan alone |
