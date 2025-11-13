# Branding Image Display Fix

## Issue
Branding images (logo, favicon, hero) are not displaying properly in the Admin Settings page.

## Root Cause
The frontend's `VITE_API_URL` environment variable is not set, so it defaults to `http://localhost:3000`. In production, this needs to point to your actual backend API URL.

## Solution

### 1. Create Frontend Environment File

Create `/home/streamlick/frontend/.env` with your production settings:

```bash
cd /home/streamlick/frontend
cat > .env << 'EOF'
VITE_API_URL=http://localhost:3000
VITE_MEDIA_SERVER_URL=http://localhost:3001
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
EOF
```

**For production:** Replace with your actual domain:
```bash
VITE_API_URL=https://api.streamlick.com
# OR if backend is on same server:
VITE_API_URL=http://localhost:3000
```

### 2. Rebuild Frontend

After setting the environment variable, rebuild the frontend:

```bash
cd /home/streamlick
npm run build --workspace=frontend
pm2 restart streamlick-frontend
```

### 3. Verify Backend is Serving Images

Check that the uploads directory exists and has proper permissions:

```bash
ls -la /home/streamlick/backend/uploads/site-images/
```

If the directory doesn't exist:
```bash
mkdir -p /home/streamlick/backend/uploads/site-images
chmod 755 /home/streamlick/backend/uploads/site-images
```

### 4. Test Image Upload

1. Open browser console (F12)
2. Go to Admin Settings → Branding tab
3. Upload a logo
4. Check console for debug logs:
   - `[Branding Debug] API_URL: ...` - Should show your API URL
   - `[Branding Debug] Current logo URL: ...` - Should show `/uploads/site-images/logo-xxxxx.ext`
5. If image fails to load, check the error in console

### 5. Common Issues

**Issue:** Images return 404
- **Fix:** Ensure backend is running and serving static files from `uploads/` directory
- **Check:** `curl http://localhost:3000/uploads/site-images/logo-xxx.png`

**Issue:** CORS errors
- **Fix:** Backend already sets CORS headers for `/uploads`. Check nginx isn't blocking

**Issue:** Wrong API_URL in browser
- **Fix:** Rebuild frontend after changing `.env` file
- **Vite only reads .env at build time, not runtime**

**Issue:** Image previews not working
- **Fix:** This should work now with the FileReader implementation. Check browser console for errors.

## Image URL Structure

Backend serves images at: `http://your-api-url/uploads/site-images/logo-xxxxx.png`

Frontend constructs full URL as:
- If URL starts with `http`: use as-is (external URL)
- Otherwise: `${API_URL}${path}` → `http://localhost:3000/uploads/site-images/logo-xxxxx.png`

## Testing

```bash
# Test from server
curl -I http://localhost:3000/uploads/site-images/logo-1234567890.png

# Should return:
# HTTP/1.1 200 OK
# Access-Control-Allow-Origin: *
# Content-Type: image/png
```

## Files Modified

1. `/home/user/streamlick/frontend/src/pages/AdminSettings.tsx`
   - Added error handlers with fallback images
   - Added debug logging for troubleshooting
   - Shows "Logo Error", "Error", or "Hero Image Error" if image fails to load

2. `/home/user/streamlick/backend/src/api/branding.routes.ts`
   - Already configured to serve images from `/uploads/site-images/`
   - CORS headers set in backend `index.ts`

## Next Steps

1. Set `VITE_API_URL` in frontend/.env
2. Rebuild frontend
3. Restart PM2
4. Test image upload
5. Check browser console for debug logs
