# DineSmart — Hero Page (Copy Directory)

This `copy/` directory contains the new Hero/Landing page files ready to be integrated into the main project.

## Files

| File | Purpose | Destination |
|------|---------|-------------|
| `HeroPage.jsx` | Landing page React component | `frontend/src/components/HeroPage.jsx` |
| `HeroPage.css` | Landing page styles & animations | `frontend/src/components/HeroPage.css` |
| `App.jsx` | Updated routing (root `/` → HeroPage) | `frontend/src/App.jsx` (replaces existing) |

## What Changed in App.jsx

1. **Root route `"/"`** now renders `<HeroPage />` instead of redirecting to `/customer`
2. **Catch-all `"*"`** now redirects to `/` (landing page) instead of `/customer`
3. Added `import HeroPage from './components/HeroPage'` at the top

## How to Integrate

Once you're happy with the hero page, copy the files to their destinations:

```powershell
# From the project root (DSA-pro/)
copy copy\HeroPage.jsx frontend\src\components\HeroPage.jsx
copy copy\HeroPage.css frontend\src\components\HeroPage.css
copy copy\App.jsx frontend\src\App.jsx
```

## Navigation Wiring

All buttons in the HeroPage are wired to your existing routes:

| Button | Navigates To |
|--------|-------------|
| **Login** | `/customer/login` |
| **Get Started** | `/customer/register` |
| **Reserve a Table** | `/customer/reserve` |
| **Explore Dashboard** | `/management` |
| **Start Your Free Trial** | `/customer/register` |
