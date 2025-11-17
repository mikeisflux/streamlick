# Facebook App Setup Guide for Streamlick

This guide walks you through creating and configuring a Facebook App on Meta's Developer Platform to enable Facebook Live streaming for your Streamlick users.

---

## Overview

Your Streamlick platform will use **one central Facebook App** to handle OAuth for all users. Each user authenticates through your app, but streams to their own Facebook profiles or Pages. The app credentials (App ID and App Secret) are stored in your server's environment variables.

---

## Prerequisites

- A Facebook account (preferably a business account)
- Admin or developer access to create apps
- Your Streamlick backend URL (e.g., `https://api.yourdomain.com` or `http://localhost:3000` for development)
- Your Streamlick frontend URL (e.g., `https://yourdomain.com` or `http://localhost:3002` for development)

---

## Step-by-Step Setup

### 1. Create a Meta Developer Account

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click **"Get Started"** in the top right
3. Log in with your Facebook account
4. Complete the registration process:
   - Accept the Meta Platform Terms
   - Verify your email address if prompted
   - Complete your developer profile

### 2. Create a New App

1. From the [Meta for Developers Dashboard](https://developers.facebook.com/apps/), click **"Create App"**
2. Select your app type:
   - Choose **"Business"** if you're running this commercially
   - Choose **"Consumer"** for testing/personal use
3. Click **"Next"**
4. Fill in the app details:
   - **Display Name**: `Streamlick` (or your platform name)
   - **App Contact Email**: Your support email
   - **Business Account** (optional): Select if you have a Meta Business account
5. Click **"Create App"**
6. Complete the security check if prompted

### 3. Get Your App Credentials

1. On your new app's dashboard, look for the **App ID** and **App Secret**
2. **App ID**: Visible on the dashboard (e.g., `123456789012345`)
3. **App Secret**: Click **"Show"** next to App Secret
   - ⚠️ **Keep this secret!** Never expose it client-side or in public repos
4. Copy both values - you'll add them to your `.env` file later

### 4. Configure App Settings

#### Basic Settings

1. From the left sidebar, click **"Settings"** → **"Basic"**
2. Scroll down and fill in:
   - **App Domains**: Add your domain(s)
     - Example: `yourdomain.com` (no `http://` or `https://`)
     - For local dev: `localhost`
   - **Privacy Policy URL**: Link to your privacy policy (required for live apps)
   - **Terms of Service URL**: Link to your terms (optional but recommended)
   - **Data Deletion Instructions URL**: Required - create a page explaining how users can delete their data
3. Save changes

#### Platform Setup

1. Scroll down to **"Add Platform"**
2. Click **"Website"**
3. Enter your **Site URL**:
   - Production: `https://yourdomain.com`
   - Development: `http://localhost:3002` (your frontend URL)
4. Save changes

### 5. Add Facebook Login Product

1. From the left sidebar, find **"Products"** (or click **"Add Products"** in the dashboard)
2. Find **"Facebook Login"** and click **"Set Up"**
3. Choose **"Web"** as your platform
4. Configure OAuth Redirect URIs:
   - Click **"Settings"** under **"Facebook Login"** in the left sidebar
   - Scroll to **"Valid OAuth Redirect URIs"**
   - Add your callback URL(s):
     ```
     https://api.yourdomain.com/api/oauth/facebook/callback
     ```
     For local development, also add:
     ```
     http://localhost:3000/api/oauth/facebook/callback
     ```
   - ⚠️ **Important**: Match these URLs exactly to what's in your code (backend/src/api/oauth.routes.ts)
5. Scroll down to **"Client OAuth Settings"**:
   - **Enable** "Web OAuth Login"
   - Set **"Valid OAuth Redirect URIs"** (should already be set above)
6. Save changes

### 6. Add Required Permissions

Your app needs specific permissions to create live videos. Here's how to add them:

1. From the left sidebar, click **"App Review"** → **"Permissions and Features"**
2. Search for and request the following permissions:

   #### Required Permissions (Auto-Approved for Development):
   - **`pages_show_list`** - To list user's pages
     - Auto-approved, no review needed

   - **`pages_read_engagement`** - To read page data
     - Auto-approved, no review needed

   - **`pages_read_user_content`** - To read comments on live videos
     - Usually auto-approved

   #### Required Permissions (Need App Review for Production):
   - **`publish_video`** - To create live videos
     - Click **"Request Advanced Access"**
     - **REQUIRES App Review** (see section 7)
     - Essential for live streaming functionality

   - **`pages_manage_posts`** - To manage posts and comments
     - Click **"Request Advanced Access"**
     - **REQUIRES App Review**
     - Needed for advanced comment/post management

   #### Optional Permissions:
   - **`read_insights`** - For analytics and viewer stats
     - May require app review for production
     - Optional, only needed for detailed analytics

   #### Deprecated/Invalid Scopes (DO NOT REQUEST):
   - ❌ `pages_manage_engagement` - Deprecated and removed
   - ❌ `pages_messaging` - Not supported for live streaming use case

3. Some permissions are auto-approved; others require **App Review** (see Step 7)

### 7. Submit for App Review (Production Only)

⚠️ **For Development**: You can skip this step and use "Development Mode" to test with up to 5 test users.

For production, you must submit your app for review to use live streaming permissions:

1. Click **"App Review"** → **"Permissions and Features"**
2. For each permission marked "Requires Review" (like `publish_video`):
   - Click **"Request Advanced Access"**
   - Fill out the review form:
     - **Use Case**: Describe how users will stream (e.g., "Users can broadcast live videos to their Facebook pages through our platform")
     - **Screencast**: Record a 2-3 minute video showing:
       - User logging in via Facebook OAuth
       - User selecting a Facebook page
       - User clicking "Go Live" and stream starting on Facebook
       - Stream appearing live on the Facebook page
     - **Step-by-Step Instructions**: Write clear steps for reviewers to test
     - **Verification**: Provide test credentials if needed

3. Submit the review
   - ⏱️ Review typically takes **1-2 weeks**
   - Meta will test your app and may ask questions
   - Ensure your staging environment is accessible for reviewers

#### Tips for Approval:
- Make your demo video **clear and comprehensive**
- Show the entire user flow from login to live stream
- Ensure your privacy policy mentions Facebook data usage
- Respond promptly to any reviewer questions

### 8. Configure App Mode

#### Development Mode (For Testing)

1. At the top of your app dashboard, you'll see a toggle for **"App Mode"**
2. If it says **"Development"**:
   - Only you and added test users/testers/admins can use the app
   - No app review needed
   - Great for initial testing
3. To add test users:
   - Go to **"Roles"** → **"Test Users"**
   - Click **"Add"** and create test users
   - These users can log in and test streaming

#### Live Mode (For Production)

1. Once your app review is **approved**, switch to **"Live"** mode
2. Click the toggle at the top of the dashboard
3. Confirm the switch
4. Your app is now available to all Facebook users

### 9. API Version

1. From **"Settings"** → **"Advanced"**
2. Note the **API Version** (e.g., `v24.0`)
3. Ensure your Streamlick code uses this version
   - Current code uses: `v24.0` (in `backend/src/api/oauth.routes.ts`)
   - Update if Facebook releases a new version

### 10. Configure Environment Variables

Copy your app credentials to your Streamlick backend `.env` file:

```bash
# Facebook OAuth Configuration
FACEBOOK_APP_ID=your_app_id_here
FACEBOOK_APP_SECRET=your_app_secret_here
FACEBOOK_REDIRECT_URI=https://api.yourdomain.com/api/oauth/facebook/callback

# For local development:
# FACEBOOK_REDIRECT_URI=http://localhost:3000/api/oauth/facebook/callback
```

⚠️ **Security**: Never commit your `.env` file to git. Use `.env.example` as a template.

---

## Testing Your Setup

### Test in Development Mode

1. Ensure your app is in **Development Mode**
2. Add yourself as an **Admin** or **Developer** under **"Roles"**
3. Start your Streamlick backend: `npm run dev`
4. Open your Streamlick frontend
5. Navigate to Settings → Destinations
6. Click **"Connect Facebook"**
7. You should see Facebook's OAuth dialog
8. Authorize the app
9. Select a Facebook Page to stream to
10. Verify the connection appears in your destinations list

### Test Live Streaming

1. Create a test broadcast in Streamlick
2. Select your Facebook destination
3. Click **"Go Live"**
4. Your backend should:
   - Create a Facebook live video
   - Return an RTMP URL and stream key
5. Check your Facebook page - you should see a live video starting
6. End the broadcast
7. Verify the video ends on Facebook

---

## Common Issues & Troubleshooting

### "App Not Set Up: This app is still in development mode"

- **Solution**: Add your test account as a developer/tester in **Roles**, or submit for app review to go live

### "Invalid Scopes: pages_manage_engagement" or "Invalid Scopes: pages_messaging"

- **Issue**: These scopes have been deprecated or are not applicable for live streaming
- **Solution**:
  - `pages_manage_engagement` was deprecated by Facebook and replaced by `pages_manage_posts`
  - `pages_messaging` is not needed for live video streaming functionality
  - Update your code to remove these scopes (already fixed in latest version)
  - Pull the latest changes and rebuild your application
- **Note**: If you see "This message is only shown to developers", it means Facebook will ignore these invalid scopes, but they should be removed from your OAuth configuration

### "Invalid OAuth Redirect URI"

- **Solution**: Ensure the redirect URI in **Facebook Login Settings** exactly matches what's in your code
- Check for `http` vs `https`, trailing slashes, port numbers

### "Insufficient Permissions: publish_video"

- **Solution**: Request the permission in **App Review** → **Permissions and Features**, or ensure you're logged in as an admin/test user

### "Error 190: Access Token Has Expired"

- **Solution**: This is expected after 60 days. Implement token refresh (already done in the updated code)
- Users will need to reconnect their Facebook account

### "Can't Load URL: The domain of this URL isn't included in the app's domains"

- **Solution**: Add your domain to **App Domains** in **Settings** → **Basic**

### Long-Lived Tokens Not Working

- **Solution**: Ensure you're exchanging short-lived for long-lived tokens (updated code does this automatically)
- Check that your App Secret is correct in `.env`

---

## Security Best Practices

1. **Never expose App Secret**: Keep it server-side only in `.env`
2. **Use HTTPS in production**: Facebook requires secure redirect URIs for live apps
3. **Rotate secrets regularly**: Change your App Secret periodically in Facebook settings
4. **Validate tokens**: Always check token expiration before use (implemented in new code)
5. **Encrypt stored tokens**: Tokens are encrypted in the database using AES-256-GCM
6. **Set up ENCRYPTION_KEY**: Generate with `openssl rand -hex 32` and add to `.env`

---

## Production Checklist

Before going live with your app:

- [ ] App reviewed and approved by Meta
- [ ] App switched to "Live" mode
- [ ] Privacy policy URL added and accessible
- [ ] Terms of service URL added
- [ ] Data deletion instructions URL added
- [ ] All permissions approved (`publish_video`, `pages_manage_posts`, etc.)
- [ ] Valid OAuth Redirect URIs set for production domain
- [ ] App credentials added to production `.env`
- [ ] HTTPS enabled on production backend
- [ ] ENCRYPTION_KEY set in production environment
- [ ] Test end-to-end flow in production environment
- [ ] Error handling and user notifications tested
- [ ] Token expiration warnings implemented and tested

---

## Additional Resources

- [Meta for Developers Documentation](https://developers.facebook.com/docs/)
- [Facebook Login for Web](https://developers.facebook.com/docs/facebook-login/web)
- [Live Video API Reference](https://developers.facebook.com/docs/video-api/guides/live)
- [App Review Process](https://developers.facebook.com/docs/app-review)
- [OAuth Best Practices](https://developers.facebook.com/docs/facebook-login/security/)

---

## Support

If you encounter issues:

1. Check the [Meta Developer Community](https://developers.facebook.com/community/)
2. Review Facebook's [changelog](https://developers.facebook.com/docs/graph-api/changelog) for API changes
3. Ensure you're using the latest API version compatible with your code
4. For Streamlick-specific issues, check the backend logs: `backend/logs/`

---

## Summary

You've now created a Facebook App configured for live streaming! Your app can:

- Authenticate users via OAuth
- Access user's Facebook Pages
- Create live videos on their behalf
- Manage long-lived tokens (~60 days)
- Automatically end live streams

Users can now connect their Facebook accounts and stream directly to Facebook Live from your Streamlick platform. 🎉
