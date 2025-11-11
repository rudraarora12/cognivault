CogniVault — Client
===================

This is the React + Vite frontend for CogniVault, an AI‑powered memory vault with a cinematic, brand‑level landing page, route loader, and smooth day/night theming.

Getting started
- npm install
- npm run dev
- Open http://localhost:5173

Available scripts
- npm run dev — start Vite dev server
- npm run build — production build
- npm run preview — preview production build locally

Notable paths
- src/App.jsx — app shell, 1s route/initial loader, routes
- src/pages/LandingPage.jsx — hero, vision, how‑it‑works, experience, features, testimonials
- src/components/HeroSection.jsx — imports and renders src/assets/home.jpeg
- src/components/TestimonialsCarousel.jsx — animated testimonial carousel
- src/contexts/ThemeContext.jsx — day/night theme provider
- src/styles/global.css — brand variables and global styles
- src/styles/landing.css — landing sections and animations
- src/styles/footer.css — footer styles

Brand assets
- Primary hero image: src/assets/home.jpeg (imported in HeroSection.jsx)
- Optional background video: public/assets/hero-bg.mp4 (see commented example in HeroSection.jsx)
- You can replace home.jpeg with your own asset and keep the same path/name.

License
- Proprietary — © CogniVault. All rights reserved.
