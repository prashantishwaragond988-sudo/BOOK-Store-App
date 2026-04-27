# Bookstore Full-Stack Ecosystem

## Backend Setup
1. Copy `.env.example` to `.env`, fill Firebase/Cloudinary/Razorpay keys, place `serviceAccountKey.json`.
2. `pip install -r requirements.txt`
3. `cd backend && flask --app run run`
4. API at `http://localhost:5000`
   - POST /auth/register, /auth/login (JWT)
   - GET /products/books, /products/ebooks
   - Admin: /admin/* (Bearer token, admin email)
   - Orders: /orders/*

## Email OTP Registration (Firebase Auth)
1. Copy `backend/.env.example` to `backend/.env` and fill:
   - `EMAIL_USER`, `EMAIL_PASS` (Gmail App Password)
   - `FIREBASE_CREDENTIALS=serviceAccountKey.json` (path to service account JSON)
2. Install deps: `pip install -r requirements.txt`
3. Start backend: `cd backend; python run.py` (or `flask --app run run`)
4. OTP APIs:
   - `POST /send-otp` `{ "email": "you@example.com" }` (max `3` per day per email)
   - `POST /resend-otp` `{ "email": "you@example.com" }`
   - `POST /verify-otp` `{ "email": "you@example.com", "otp": "123456" }`
   - `POST /register` `{ "name": "Name", "email": "you@example.com", "password": "******" }`

## Test Backend
Use Postman:
- Register user
- Login → get token
- Add to cart/orders
- Admin login → analytics

## Frontend (Next.js - Phase 2 next)
1. `cd frontend && npm install`
2. Set env in `frontend/.env.local`:
   - `NEXT_PUBLIC_API_URL=http://localhost:5000` (or your public backend URL)
3. `npm run dev`
4. Open the simple OTP registration page: `http://localhost:3000/otp-register.html`

Backend complete, no import errors, clean architecture.
Run `flask --app backend/run run` to test.

Proceeding to Phase 2: Next.js frontend.
