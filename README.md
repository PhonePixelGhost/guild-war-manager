# Guild War Manager

จัดทีมสงครามกิลด์ จัดปาร์ตี้ด้วย Drag & Drop และบันทึกสถิติการต่อสู้

## Features

- 🎮 Guild management with roles (Leader, Commander, Party Leader, Member)
- ⚔️ War session tracking with party assignments
- 📊 Battle statistics (kills, damage, healing, etc.)
- 🎯 Discord integration for check-ins
- 📈 Stats dashboard with all features free
- 🔐 Discord & Google OAuth login

## Tech Stack

- **Frontend**: React 18 + Vite
- **Backend**: Supabase (PostgreSQL + Auth + Storage)
- **Deployment**: Vercel
- **Styling**: Tailwind CSS (in production)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_API_URL=http://localhost:3000
```

### 3. Run Development Server

```bash
npm run dev
```

### 4. Build for Production

```bash
npm run build
```

## Supabase Setup

1. Create a Supabase project
2. Run SQL migrations from `deployment/` folder
3. Enable Discord OAuth provider
4. Create storage buckets: `guild-logos`, `skill-icons` (public)

## Deploy to Vercel

1. Push to GitHub
2. Import repo on Vercel
3. Set environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy

## License

Free to use - no monetization
