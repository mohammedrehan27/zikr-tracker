# Ibadah Tracker (v1)

Signup/login, 5 Namaz marking (Jamaat / Alone / Missed / Qaza), Zikr azkar, streak heatmap, streak count, 3-day points rule.

Also: Quran tracker (choose Pages or Para and type the number; the two are never converted; own streak, 5-week map, khatam progress counted from paras), private Nafl tracker (Duha, Tahajjud, Witr, Sunnah rawatib, Ishraq with own streak), Hadith of the day.

Needs Node.js 22.13 or newer.

## Run locally (two terminals)

Terminal 1 (backend, port 3001):
    cd backend
    npm install
    npm start

Terminal 2 (frontend, port 5173):
    cd frontend
    npm install
    npm run dev

Open http://localhost:5173

## Tests
    cd backend && npm test

## Rules enforced on the server
- First mark within 3 days of the date: Jamaat +10, Alone +4, Qaza +2.
- Older dates: saved as record only (0 pts). Changing a mark later: 0 pts.
- One entry per user, per prayer, per day (database constraint).
- New zikr or nafl: insert a row into zikr_types / nafl_types (no code change needed).
- Quran and Nafl are private: no points, nothing shared.

## Before going live
Set JWT_SECRET and NODE_ENV=production for the backend, and serve both over HTTPS.
