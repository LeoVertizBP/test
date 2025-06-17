# Navigation Testing Guide

This document explains how to verify and validate application navigation without running the application. These tools help ensure that navigation flows are working as expected across the application.

## Recent Updates

The navigation system has been significantly improved:

1. **Route Constants System**: All routes are now defined in `src/constants/routes.ts`
2. **Standardized Navigation Methods**: All components use consistent navigation patterns
3. **Enhanced Navigation Testing Tools**: The checker tool now detects route constant usage
4. **Improved Documentation**: Better guides for navigation best practices
5. **Fixed Navigation Issues**: Resolved problems with main navigation and detail views

## Why Test Navigation Without Running the App?

Navigation issues are often only discovered when users interact with the application. By using static analysis tools, we can:

1. Identify potential issues before users encounter them
2. Verify that all pages are accessible through the UI
3. Ensure navigation is implemented consistently using recommended methods
4. Avoid regression issues when making changes

## Available Testing Tools

### 1. Navigation Checker

The Navigation Checker performs static analysis of our code to detect:
- Navigation patterns used across components 
- Proper implementation of navigation methods
- Potential issues like hardcoded paths, missing back buttons, etc.

#### How to Run:

```bash
cd frontend
npm run check-navigation
```

This will:
- Scan all components for navigation-related code
- Generate a detailed report (`navigation-check-results.log`)
- Display a summary in the console showing percentages of recommended vs non-recommended navigation methods

#### What to Look For:

- Ensure most navigation uses router.push() (recommended method)
- Review any non-recommended navigation methods (like direct window.location changes)
- Check for components that import useRouter but don't use it for navigation

### 2. Navigation Flow Diagram Generator

This tool creates a visual diagram of all navigation paths in the application, making it easier to understand the user journey.

#### How to Run:

```bash
cd frontend
npm run generate-nav-diagram
```

This will:
- Generate a Mermaid diagram showing the navigation flow between components and pages
- Save the diagram to `navigation-flow-diagram.md` in the project root
- Show statistics and potential issues in the console

#### What to Look For:

- **Orphaned Pages**: Pages with no incoming navigation (may be unreachable)
- **Dead-End Pages**: Pages with no outgoing navigation (may trap users)
- **Missing Connections**: Important pages that should connect but don't
- **Circular References**: Ensure the navigation flow makes logical sense

## Testing Navigation Changes

When making changes to navigation:

1. Run both tools before your changes to establish a baseline
2. Make your changes
3. Run both tools again to see what changed
4. Review the comparison for unexpected changes

## Best Practices for Navigation

Our tools enforce these best practices:

1. **Use ROUTES constants**: Always use the centralized route constants instead of hardcoded paths
2. **Use recommended navigation methods**:
   - `Link` component with ROUTES constants (best for navigation elements)
   - `router.push()` with ROUTES constants (best for programmatic navigation)
3. **Include back buttons**: Especially for nested routes or "detail" pages
4. **Use descriptive route names**: Make the navigation flow clear in the constants file

## Route Constants Usage

### Importing Route Constants

```typescript
import { ROUTES } from '@/constants/routes';
```

### Using in Link Component (Preferred)

```typescript
<Link href={ROUTES.DASHBOARD}>Back to Dashboard</Link>
```

### Using for Programmatic Navigation

```typescript
router.push(ROUTES.MANAGEMENT_RULE_SET);
```

### With Dynamic Parameters

```typescript
router.push(`${ROUTES.MANAGEMENT_RULE_SET}/${id}`);
```

By regularly running these tools and following these standards, we can maintain a robust and consistent navigation experience without needing to manually test every path.
