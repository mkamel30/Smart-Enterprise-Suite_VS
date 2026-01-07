# Smart Enterprise Suite Design System

## Overview
تم تطبيق نظام تصميم موحد وافتراضي في جميع أنحاء البرنامج. جميع المكونات الأساسية تستخدم ألوان وأنماط Smart Enterprise Suite تلقائياً.

## Colors (الألوان)

### Primary Colors (الألوان الأساسية)
- **Primary Navy**: `#0A2472` - اللون الأساسي (الرؤوس والتسميات الرئيسية)
- **Accent Cyan**: `#6CE4F0` - PANTONE 2727 C (التأكيدات والعناصر البارزة)
- **Success Green**: `#80C646` - PANTONE 367 C (الأزرار والحالات الناجحة)

### Secondary Colors (الألوان الثانوية)
- Purple: `#7E5BAB` - PANTONE 525 C
- Pink: `#C85C8E` - PANTONE 674 C
- Orange: `#E86B3A` - PANTONE 7578 C
- Yellow: `#F5C451` - PANTONE 141 C
- Teal: `#31625C` - PANTONE 555 C

## Components (المكونات)

### Button (الأزرار)
```tsx
<Button variant="default">Primary Button</Button>
<Button variant="outline">Outline Button</Button>
<Button variant="destructive">Delete</Button>
<Button variant="success">Save Changes</Button>
<Button variant="ghost">Light Button</Button>
<Button variant="link">Link Button</Button>
```

**Variants:**
- `default`: Dark navy gradient with white text (الافتراضي)
- `outline`: Navy border with navy text
- `destructive`: Red gradient with white text
- `success`: Green gradient with white text
- `ghost`: Transparent with hover effect
- `link`: Text link with underline

### Input Fields (حقول الإدخال)
```tsx
<Input placeholder="Enter text..." />
<Textarea placeholder="Enter message..." />
<Select>
  <option>Choose...</option>
</Select>
```

**Features:**
- 2px borders with navy accent: `border-[#0A2472]/10`
- Focus rings with primary color
- Professional hover effects
- Smooth transitions

### Cards & Containers (البطاقات والحاويات)
```tsx
<Card>
  <CardHeader>Title</CardHeader>
  <CardContent>Content here</CardContent>
  <CardFooter>Footer</CardFooter>
</Card>
```

**Features:**
- White background with 2px borders
- Subtle shadow effect
- Professional spacing
- Automatic header/footer borders

### Dialog/Modal
```tsx
<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button>Action</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Features:**
- Dark navy headers
- White content areas
- Professional borders
- Smooth animations

### Badges (الشارات)
```tsx
<Badge variant="default">Primary</Badge>
<Badge variant="success">Success</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="secondary">Info</Badge>
<Badge variant="outline">Outline</Badge>
```

### Alerts (التنبيهات)
```tsx
<Alert variant="default">
  <AlertTitle>Note</AlertTitle>
  <AlertDescription>Message here</AlertDescription>
</Alert>
<Alert variant="destructive">Error message</Alert>
<Alert variant="success">Success message</Alert>
<Alert variant="warning">Warning message</Alert>
```

### Checkboxes
```tsx
<Checkbox />
```

**Features:**
- Navy primary color
- Smooth hover effects
- Focus rings with primary color

## CSS Utility Classes

### Headers
```html
<div class="smart-header">Header Content</div>
<h2 class="smart-header-text">Title</h2>
```

### Cards
```html
<div class="smart-card">
  <div class="smart-card-header">Header</div>
  <div class="smart-card-footer">Footer</div>
</div>
```

### Labels & Text
```html
<label class="smart-label">Field Label</label>
<p class="smart-description">Helper text</p>
```

### Input Groups
```html
<input class="smart-input" />
<textarea class="smart-textarea"></textarea>
<select class="smart-select"></select>
```

### Buttons
```html
<button class="smart-btn-primary">Primary Action</button>
<button class="smart-btn-secondary">Secondary</button>
<button class="smart-btn-success">Save</button>
<button class="smart-btn-danger">Delete</button>
```

### Badges & Status
```html
<span class="smart-badge smart-badge-primary">Primary</span>
<span class="smart-badge smart-badge-success">Success</span>
<span class="smart-badge smart-badge-danger">Error</span>
<span class="smart-badge smart-badge-warning">Warning</span>
```

### Alerts
```html
<div class="smart-alert smart-alert-error">Error message</div>
<div class="smart-alert smart-alert-success">Success message</div>
<div class="smart-alert smart-alert-warning">Warning message</div>
<div class="smart-alert smart-alert-info">Info message</div>
```

### Hover Effects
```html
<div class="smart-hover">Hover for subtle background</div>
<div class="smart-hover-lift">Hover for lift effect</div>
```

### Dividers
```html
<hr class="smart-divider" />
```

## Design Tokens

### Spacing
- Standard: `1rem` (16px)
- Compact: `0.5rem` (8px)
- Loose: `2rem` (32px)

### Borders
- Standard: `2px solid border-[#0A2472]/10`
- Thick: `3px solid border-[#0A2472]/20`

### Shadows
- Small: `shadow-md`
- Large: `shadow-lg`

### Border Radius
- Standard: `rounded-lg`
- Full: `rounded-full`

## Typography

### Font Family
- Arabic: Configured via CSS variables
- Default: Inter

### Font Weights
- Normal: 400
- Bold: 700 (font-bold)
- Extra Bold: 900 (font-black for labels)

## Dark Mode
Currently configured for light theme. Dark mode support can be extended using Tailwind's `dark:` prefix.

## RTL Support
All components have built-in RTL support through Tailwind's `dir="rtl"` attribute and flexbox utilities.

## Customization

To customize colors globally, update:
1. `/frontend/tailwind.config.js` - Theme colors
2. `/frontend/src/index.css` - CSS variables and utility classes

Example:
```javascript
// tailwind.config.js
theme: {
  extend: {
    colors: {
      brand: {
        primary: '#0A2472',
        // ... other colors
      }
    }
  }
}
```

## Best Practices

1. **Use Component Variants**: Always prefer component variants over inline styles
   ```tsx
   // Good ✅
   <Button variant="success">Save</Button>
   
   // Avoid ❌
   <Button className="bg-green-500">Save</Button>
   ```

2. **Consistent Colors**: Use the predefined colors from the design system
   ```tsx
   // Good ✅
   <div className="text-[#0A2472]">Text</div>
   
   // Avoid ❌
   <div className="text-blue-500">Text</div>
   ```

3. **Button Hierarchy**: Use variants to show importance
   - `primary`: Main action
   - `secondary`: Secondary action
   - `outline`: Tertiary action
   - `ghost`: Minimal action
   - `destructive`: Dangerous action

4. **Spacing & Layout**: Use Tailwind's spacing system
   ```tsx
   <div className="p-6 gap-4">Content</div>
   ```

## Migration Guide

For existing components using old styling:

1. Replace custom button styles with `<Button>` component
2. Replace custom input styles with `<Input>` component
3. Replace custom card styles with `<Card>` component
4. Remove inline `bg-` and `border-` classes, use utility classes
5. Use `variant` prop instead of `className` for styling

Example migration:
```tsx
// Before
<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2">
  Click
</button>

// After
<Button variant="default">Click</Button>
```
