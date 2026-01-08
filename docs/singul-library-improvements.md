# Singul Library Customization Improvements

## PR Summary

This PR adds comprehensive customization support to the `@singulio/singul` library, enabling developers to fully control the appearance and behavior of search results.

---

## Issues Fixed

### 1. Remove Debug "Click me" Button
**Current code (line 152 in singul.js):**
```jsx
<button onClick={() => console.log('This is a test prop: ' + this.testingProp)}>Click me</button>
```
This debug button should be removed from production builds.

---

## New Features

### 2. Layout Mode Support

Add a `layout` prop to switch between list and grid display:

```tsx
interface SingulJSProps {
  // ... existing props
  layout?: 'list' | 'grid';
  gridColumns?: number | { xs?: number; sm?: number; md?: number; lg?: number };
}
```

**Usage:**
```jsx
<SingulJS
  authToken={token}
  layout="grid"
  gridColumns={{ xs: 1, sm: 2, md: 3 }}
/>
```

**Implementation in render():**
```jsx
render() {
  const styles = this.getParsedStyles();
  const isGrid = this.layout === 'grid';
  
  const dropdownStyle = {
    ...(styles.dropdown || {}),
    ...(isGrid ? {
      display: 'grid',
      gridTemplateColumns: this.getGridColumns(),
      gap: styles.gridGap || '8px',
    } : {})
  };

  return (
    // ... existing wrapper code
    {this.isOpen && (
      <div class="dropdown" style={dropdownStyle}>
        {/* results */}
      </div>
    )}
  );
}
```

---

### 3. Custom Item Renderer

Add support for custom rendering via slots or render callbacks:

```tsx
interface SingulJSProps {
  // ... existing props
  renderItem?: (app: AlgoliaSearchApp, isSelected: boolean) => JSX.Element;
}
```

**For Stencil/Web Components - Use Slots:**
```jsx
<singul-js auth-token={token}>
  <template slot="item">
    <div class="custom-item">
      <img src="${app.image_url}" />
      <span>${app.name}</span>
    </div>
  </template>
</singul-js>
```

**For React wrapper - Use render prop:**
```jsx
<SingulJS
  authToken={token}
  renderItem={(app, isSelected) => (
    <div className={`custom-card ${isSelected ? 'selected' : ''}`}>
      <img src={app.image_url} alt={app.name} />
      <h3>{app.name}</h3>
      <p>{app.description}</p>
      <span className="category">{app.categories?.[0]}</span>
    </div>
  )}
/>
```

---

### 4. Enhanced customStyles Keys

Expand the customStyles object to support more granular control:

```typescript
interface CustomStyles {
  // Container & Input (existing)
  container?: CSSProperties;
  inputWrapper?: CSSProperties;
  input?: CSSProperties;
  searchIcon?: CSSProperties;
  loadingSpinner?: CSSProperties;
  spinner?: CSSProperties;
  
  // Dropdown (existing + new)
  dropdown?: CSSProperties;
  dropdownItem?: CSSProperties;
  dropdownItemHover?: CSSProperties;  // NEW
  selectedItem?: CSSProperties;
  
  // App Info (existing + new)
  appInfo?: CSSProperties;
  appIcon?: CSSProperties;
  appDetails?: CSSProperties;
  appName?: CSSProperties;
  appDescription?: CSSProperties;     // NEW
  appCategory?: CSSProperties;        // NEW
  appTags?: CSSProperties;            // NEW
  
  // Grid Layout (NEW)
  gridContainer?: CSSProperties;
  gridItem?: CSSProperties;
  gridItemHover?: CSSProperties;
  
  // States (NEW)
  emptyState?: CSSProperties;
  loadingState?: CSSProperties;
  errorState?: CSSProperties;
  
  // Selection indicator (NEW)
  checkbox?: CSSProperties;
  checkboxChecked?: CSSProperties;
}
```

---

### 5. Multi-Select Support

Add ability to select multiple items:

```tsx
interface SingulJSProps {
  // ... existing props
  multiSelect?: boolean;
  selectedApps?: AlgoliaSearchApp[];
  onSelectionChange?: (apps: AlgoliaSearchApp[]) => void;
  showCheckbox?: boolean;
}
```

**Usage:**
```jsx
<SingulJS
  authToken={token}
  multiSelect={true}
  showCheckbox={true}
  selectedApps={selectedApps}
  onSelectionChange={(apps) => setSelectedApps(apps)}
/>
```

---

### 6. Prevent Default Behavior

Add option to prevent the default window.open behavior:

```tsx
interface SingulJSProps {
  // ... existing props
  preventDefault?: boolean;  // If true, don't auto-open auth URL
}
```

**Current behavior (line 116-127):**
```javascript
selectApp(app) {
  const authUrl = `https://shuffler.io/appauth?app_id=${app.objectID}&auth=${this.auth}`;
  this.appSelected.emit({ app, authUrl });
  
  if (typeof window.onAppSelected === 'function') {
    window.onAppSelected({ app, authUrl });
  } else {
    window.open(authUrl, '_blank');  // This should be optional
  }
  
  this.closeDropdown();
}
```

**Proposed change:**
```javascript
selectApp(app) {
  const authUrl = `https://shuffler.io/appauth?app_id=${app.objectID}&auth=${this.auth}`;
  this.appSelected.emit({ app, authUrl });
  
  if (typeof window.onAppSelected === 'function') {
    window.onAppSelected({ app, authUrl });
  } else if (!this.preventDefault) {
    window.open(authUrl, '_blank');
  }
  
  this.closeDropdown();
}
```

---

### 7. Show App Description in Results

Currently only `app.name` is displayed. Add description and categories:

**Current (line 153-156):**
```jsx
<div class="app-details" style={styles.appDetails || {}}>
  <span class="app-name" style={styles.appName || {}}>{app.name}</span>
</div>
```

**Proposed:**
```jsx
<div class="app-details" style={styles.appDetails || {}}>
  <span class="app-name" style={styles.appName || {}}>{app.name}</span>
  {this.showDescription && app.description && (
    <span class="app-description" style={styles.appDescription || {}}>
      {app.description}
    </span>
  )}
  {this.showCategories && app.categories?.length > 0 && (
    <span class="app-category" style={styles.appCategory || {}}>
      {app.categories[0]}
    </span>
  )}
</div>
```

Add props:
```tsx
interface SingulJSProps {
  showDescription?: boolean;  // default: false
  showCategories?: boolean;   // default: false
  showTags?: boolean;         // default: false
}
```

---

### 8. CSS Custom Properties (CSS Variables)

Expose CSS custom properties for theming without JavaScript:

```css
:host {
  /* Colors */
  --singul-bg: transparent;
  --singul-input-bg: #ffffff;
  --singul-input-border: #e0e0e0;
  --singul-input-focus-border: #0066ff;
  --singul-text: #1a1a1a;
  --singul-text-muted: #666666;
  --singul-dropdown-bg: #ffffff;
  --singul-dropdown-border: #e0e0e0;
  --singul-dropdown-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  --singul-item-hover-bg: #f5f5f5;
  --singul-item-selected-bg: #e6f0ff;
  --singul-item-selected-border: #0066ff;
  --singul-accent: #0066ff;
  
  /* Spacing */
  --singul-border-radius: 8px;
  --singul-input-padding: 12px 16px;
  --singul-item-padding: 12px 16px;
  --singul-item-gap: 8px;
  --singul-grid-gap: 12px;
  
  /* Typography */
  --singul-font-family: inherit;
  --singul-font-size: 14px;
  --singul-font-weight-normal: 400;
  --singul-font-weight-bold: 600;
}
```

**Usage in consuming app:**
```css
singul-js {
  --singul-dropdown-bg: rgba(26, 26, 26, 0.98);
  --singul-text: white;
  --singul-accent: #FF6600;
  --singul-border-radius: 12px;
}
```

---

## Complete Updated Interface

```typescript
export interface SingulJSProps extends Omit<HTMLAttributes<HTMLElement>, 'onChange'> {
  // Required
  authToken: string;
  
  // Search Input
  placeholder?: string;
  
  // Layout
  layout?: 'list' | 'grid';
  gridColumns?: number | { xs?: number; sm?: number; md?: number; lg?: number };
  
  // Display Options
  showDescription?: boolean;
  showCategories?: boolean;
  showTags?: boolean;
  showCheckbox?: boolean;
  
  // Selection
  multiSelect?: boolean;
  selectedApps?: AlgoliaSearchApp[];
  preventDefault?: boolean;
  
  // Styling
  customStyles?: CustomStyles;
  class?: string;
  
  // Custom Rendering (React only)
  renderItem?: (app: AlgoliaSearchApp, isSelected: boolean) => JSX.Element;
  renderEmptyState?: () => JSX.Element;
  renderLoadingState?: () => JSX.Element;
  
  // Events
  onAppSelected?: (detail: AppSelectedEvent, event: CustomEvent) => void;
  onSelectionChange?: (apps: AlgoliaSearchApp[]) => void;
  onSearchChange?: (query: string) => void;
}
```

---

## Migration Guide

These changes are **backward compatible**. Existing usage will continue to work:

```jsx
// This still works exactly as before
<SingulJS
  authToken={token}
  placeholder="Search..."
  customStyles={{ container: { width: '400px' } }}
/>
```

New features are opt-in:

```jsx
// Enhanced usage with new features
<SingulJS
  authToken={token}
  placeholder="Search..."
  layout="grid"
  gridColumns={3}
  showDescription={true}
  showCategories={true}
  multiSelect={true}
  preventDefault={true}
  onAppSelected={(detail) => handleSelection(detail.app)}
  customStyles={{
    container: { width: '100%' },
    gridItem: { borderRadius: '12px' },
    appDescription: { color: '#888' },
  }}
/>
```

---

## Files Changed

1. `src/components/singul/singul.tsx` - Main component logic
2. `src/components/singul/singul.css` - Add grid layout styles & CSS variables
3. `src/components/singul/singul.helpers.tsx` - Update interfaces
4. `react/index.tsx` - Update React wrapper with new props
5. `vue/index.ts` - Update Vue wrapper with new props
6. `README.md` - Document new features

---

## Testing Checklist

- [ ] List layout works as before (backward compat)
- [ ] Grid layout displays correctly at all breakpoints
- [ ] Custom styles apply to all new elements
- [ ] Multi-select works with checkbox display
- [ ] preventDefault stops auto-opening URLs
- [ ] renderItem callback renders custom JSX
- [ ] CSS variables override default theme
- [ ] "Click me" debug button is removed
- [ ] All existing tests pass
