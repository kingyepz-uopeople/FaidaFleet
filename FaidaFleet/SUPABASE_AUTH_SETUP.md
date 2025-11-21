# Supabase Authentication Setup

This project now includes complete authentication using Supabase.

## Features

- ✅ Email/Password authentication
- ✅ Google OAuth authentication
- ✅ Password reset functionality
- ✅ Protected routes with middleware
- ✅ User session management
- ✅ Logout functionality

## Setup Instructions

### 1. Install Dependencies

The required packages have been installed:
- `@supabase/supabase-js`
- `@supabase/ssr`

### 2. Configure Supabase

1. Create a Supabase project at [https://supabase.com](https://supabase.com)
2. Go to Project Settings > API
3. Copy your project URL and anon public key
4. Update `.env.local` with your credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Configure Email Templates (Optional)

In your Supabase dashboard:
1. Go to Authentication > Email Templates
2. Customize the templates for:
   - Confirmation email
   - Password reset email
   - Magic link email

### 4. Configure OAuth Providers (Optional)

To enable Google sign-in:

1. Go to Authentication > Providers in Supabase
2. Enable Google provider
3. Add your OAuth credentials from Google Cloud Console
4. Add authorized redirect URLs:
   - `http://localhost:9002/auth/callback` (development)
   - `https://your-domain.com/auth/callback` (production)

### 5. Configure Site URL and Redirect URLs

In Supabase Project Settings > Authentication:

1. Set **Site URL** to:
   - Development: `http://localhost:9002`
   - Production: `https://your-domain.com`

2. Add **Redirect URLs**:
   - `http://localhost:9002/auth/callback`
   - `https://your-domain.com/auth/callback`

## Available Pages

- `/login` - Sign in page
- `/signup` - Sign up page
- `/reset-password` - Password reset request
- `/auth/update-password` - Set new password (from email link)
- `/auth/callback` - OAuth callback handler
- `/auth/auth-code-error` - Error page for failed authentication

## How It Works

### Authentication Flow

1. **Sign Up**:
   - User enters email and password
   - Supabase sends confirmation email
   - User clicks link to verify account
   - User can now log in

2. **Sign In**:
   - User enters credentials
   - On success, redirected to `/dashboard`
   - Session stored in cookies

3. **Password Reset**:
   - User requests reset on `/reset-password`
   - Email sent with reset link
   - Link goes to `/auth/update-password`
   - User sets new password

4. **Google OAuth**:
   - User clicks "Continue with Google"
   - Redirected to Google for authentication
   - Returns to `/auth/callback`
   - Redirected to `/dashboard`

### Middleware Protection

The middleware in `src/middleware.ts` protects all routes except:
- `/login`
- `/signup`
- `/reset-password`
- `/auth/*`
- Static files

Unauthenticated users are automatically redirected to `/login`.

### User Data Access

**Client Component:**
```tsx
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const { data: { user } } = await supabase.auth.getUser()
```

**Server Component/Action:**
```tsx
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
```

### Logout

Call the logout action from anywhere:
```tsx
import { logout } from '@/app/auth/actions'

// In a form or button
<form action={logout}>
  <button type="submit">Logout</button>
</form>

// Or programmatically
await logout()
```

## Development

Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:9002`

## Testing Authentication

1. Start your development server
2. Navigate to `http://localhost:9002`
3. You'll be redirected to `/login`
4. Click "Sign up" to create an account
5. Check your email for verification (if email confirmation is enabled)
6. Log in with your credentials
7. You'll be redirected to `/dashboard`

## Troubleshooting

### Users not receiving emails
- Check your Supabase email settings
- Verify SMTP configuration in production
- Check spam folder

### OAuth not working
- Verify redirect URLs are correctly configured
- Check OAuth credentials are valid
- Ensure Site URL is set correctly

### Session expires too quickly
- Adjust session settings in Supabase dashboard
- Check cookie configuration in middleware

## Security Notes

- Never commit `.env.local` to version control
- The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is safe to expose (it's public)
- Use Row Level Security (RLS) in Supabase for data access control
- The middleware ensures protected routes are only accessible when authenticated

## Next Steps

1. Set up Row Level Security policies in Supabase
2. Create user profile tables
3. Add role-based access control
4. Implement email verification enforcement
5. Add multi-factor authentication (MFA)
