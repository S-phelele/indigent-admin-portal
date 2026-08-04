Indigent Admin Portal
Tech Stack
Admin Portal
React + Vite + React Router

Auth	JWT + OTP (SMS simulated)

Project Structure
 admin-portal/            # React admin UI

Prerequisites
npm or yarn

Setup
Default accounts (from seed):
Admin: `admin@indigent.gov.za` / `admin123`

Admin Portal
cd admin-portal
npm install
npm run dev            # http://localhost:5174

Application Flow
Register / Sign in
Admin reviews, views documents, Approves or Declines

Income Threshold:
Landing page states: total household income R7 500 or less per month may qualify.  
General form also references R4 200. Both are stored; eligibility logic can be adjusted by municipality.

Notes:
OTP is logged to the server console in development (`demoOtp` also returned in non-production responses).
Document uploads stored under `backend/uploads/<applicationId>/`.
Change `JWT_SECRET` and database credentials before production use.
