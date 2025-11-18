# ReseautageClub

A modern social networking platform for entrepreneurs, founders, and innovators to connect, share ideas, and build the future together.

## Features

### Social Networking
- User profiles with customizable information
- Follow and connection system
- Real-time activity feed
- Post creation with media support (images, videos, audio)
- Like, comment, and share functionality
- @mentions and hashtags
- Profile view tracking

### Communication
- Direct messaging with real-time updates
- Media sharing in messages (images, videos, audio)
- Video and audio calling with WebRTC
- Call history and recordings
- Community chat rooms
- Admin support chat

### Communities
- Create and join communities
- Community posts and discussions
- Media channels for different content types
- Live calls within communities
- Course and learning center integration
- Member management

### Events & Networking
- Event creation and management
- RSVP system
- Event chat rooms
- Cofounder matching system
- Networking tools

### Media Features
- Image upload and optimization
- Video upload with compression
- Audio recording and playback
- Media viewer with full-screen support
- Lazy loading for performance
- Storage in Supabase buckets

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui, Radix UI
- **State Management**: React Context API
- **Real-time**: Supabase Realtime
- **WebRTC**: Native WebRTC for video/audio calls

### Backend
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **Real-time**: Supabase Realtime subscriptions
- **Security**: Row Level Security (RLS) policies

### Additional Tools
- **Form Validation**: React Hook Form + Zod
- **Date Handling**: date-fns
- **Notifications**: Sonner toasts
- **Security**: reCAPTCHA v3, DOMPurify
- **Media**: Image optimization, video compression
- **Encryption**: WebRTC DTLS/SRTP for calls

## Getting Started

### Prerequisites

- Node.js 20.x or higher
- npm or yarn package manager
- Supabase account and project

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd reseautageclub
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_RECAPTCHA_SITE_KEY=your_recaptcha_site_key
   ```

   Get these values from:
   - **Supabase**: Dashboard > Settings > API
   - **reCAPTCHA**: Google reCAPTCHA Admin Console

4. **Set up the database**

   The project includes migration files in `supabase/migrations/`. Run them in order:
   ```bash
   # If using Supabase CLI
   supabase db push

   # Or manually apply through Supabase Dashboard > SQL Editor
   ```

5. **Configure Supabase Storage**

   Create the following storage buckets in Supabase Dashboard:
   - `user-media` - For user uploaded media
   - `avatars` - For profile pictures
   - `community-media` - For community content

6. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
reseautageclub/
├── app/                      # Next.js app router pages
│   ├── (auth)/              # Authentication pages
│   ├── admin/               # Admin tools and diagnostics
│   ├── api/                 # API routes
│   ├── communities/         # Community pages
│   ├── feed/                # Main feed
│   ├── messages/            # Messaging
│   ├── network/             # Networking
│   ├── profile/             # User profiles
│   └── ...
├── components/              # React components
│   ├── ui/                  # shadcn/ui components
│   └── ...                  # Feature components
├── lib/                     # Utility functions and contexts
│   ├── auth-context.tsx     # Authentication context
│   ├── db-context.tsx       # Database context
│   ├── supabase.ts          # Supabase client
│   └── ...
├── hooks/                   # Custom React hooks
├── public/                  # Static assets
├── supabase/               # Supabase configuration
│   └── migrations/          # Database migrations
└── scripts/                # Utility scripts
```

## Key Features Implementation

### Authentication
- Email/password authentication via Supabase Auth
- Automatic profile creation on signup
- Protected routes with middleware
- Session management

### Real-time Features
- Live message updates
- Real-time notifications
- Live community chat
- Presence indicators
- Call signaling

### Media Handling
- Client-side image compression
- Video optimization
- Audio recording
- Secure storage with signed URLs
- CDN delivery via Supabase Storage

### Performance Optimizations
- Lazy loading for lists and images
- Infinite scroll pagination
- Database query optimization
- Indexed queries
- Connection pooling

### Security
- Row Level Security (RLS) on all tables
- reCAPTCHA on forms
- XSS protection with DOMPurify
- CSRF protection
- Secure WebRTC with encryption
- Content sanitization

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

## Deployment

See [PRODUCTION_SETUP_GUIDE.md](./PRODUCTION_SETUP_GUIDE.md) for detailed deployment instructions including:
- Environment variable configuration
- Supabase setup
- CORS configuration
- Database migration
- Storage bucket setup
- Troubleshooting common issues

### Quick Deployment Checklist

1. Set environment variables in your hosting platform
2. Configure Supabase CORS for your domain
3. Run database migrations
4. Create storage buckets
5. Set up RLS policies
6. Configure reCAPTCHA
7. Deploy application
8. Test all features

## Database Schema

The application uses PostgreSQL via Supabase with the following main tables:

- `profiles` - User profiles and settings
- `posts` - User posts and content
- `comments` - Post comments
- `post_likes` - Like tracking
- `connections` - User connections
- `followers` - Follow relationships
- `conversations` - Direct messages
- `messages` - Message content
- `communities` - Community information
- `community_members` - Community membership
- `community_posts` - Community content
- `events` - Event information
- `notifications` - User notifications
- `call_requests` - Video/audio call requests
- `webrtc_signals` - WebRTC signaling

All tables have Row Level Security enabled with appropriate policies.

## Environment Variables

### Required
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

### Optional
- `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` - Google reCAPTCHA site key (for form protection)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Troubleshooting

### Common Issues

**Blank page in production**
- Verify environment variables are set correctly
- Check Supabase CORS configuration
- Review browser console for errors
- Use `/admin/db-diagnostic` for database diagnostics

**Authentication not working**
- Verify Supabase URL and keys
- Check RLS policies
- Ensure email confirmation is configured

**Media not loading**
- Check storage bucket configuration
- Verify RLS policies on storage
- Ensure CORS is configured
- Check file upload limits

**Real-time features not working**
- Verify Supabase Realtime is enabled
- Check subscription setup
- Review browser console for connection errors

For detailed troubleshooting, see [PRODUCTION_SETUP_GUIDE.md](./PRODUCTION_SETUP_GUIDE.md).

## License

This project is proprietary software. All rights reserved.

## Support

For support, email support@reseautageclub.com or join our community chat.
