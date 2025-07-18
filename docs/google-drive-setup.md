# Google Drive Integration Setup Guide

## Overview

This application integrates with Google Drive to access and process manga/comic chapter images. This guide will help you configure the Google Drive integration properly.

## Required Environment Variables

Add these to your `.env.local` file:

```env
# Google Drive Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_oauth_client_id_here
GOOGLE_API_KEY=your_google_api_key_here
```

## Step-by-Step Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID for later use

### 2. Enable Required APIs

1. Navigate to **APIs & Services** > **Library**
2. Search for and enable the following APIs:
   - **Google Drive API**
   - **Google Picker API** (optional, for file picker functionality)

### 3. Create API Credentials

#### OAuth 2.0 Client ID (for user authentication)

1. Go to **APIs & Services** > **Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. Choose **Web application**
4. Add your authorized JavaScript origins:
   - `http://localhost:3000` (for development)
   - `https://yourdomain.com` (for production)
5. Add authorized redirect URIs:
   - `http://localhost:3000` (for development)
   - `https://yourdomain.com` (for production)
6. Copy the **Client ID** and set it as `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

#### API Key (for server-side Drive API calls)

1. Click **+ CREATE CREDENTIALS** > **API key**
2. (Optional) Restrict the key:
   - **Application restrictions**: Set to your domain
   - **API restrictions**: Limit to Google Drive API
3. Copy the **API Key** and set it as `GOOGLE_API_KEY`

### 4. Configure API Key Management

This application supports multiple API keys for load balancing and quota management:

1. Go to the Admin panel in your application
2. Navigate to the **API Keys** section
3. Add multiple Google API keys for better performance
4. The system will automatically rotate between keys

## Environment Configuration

Create a `.env.local` file in your project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google Drive Configuration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=1234567890-abcdef1234567890abcdef1234567890.apps.googleusercontent.com
GOOGLE_API_KEY=AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## API Quotas and Limits

### Google Drive API Limits

- **Queries per 100 seconds per user**: 1,000
- **Queries per 100 seconds**: 100,000,000
- **Queries per day**: 1,000,000,000

### Best Practices

1. **Use multiple API keys** - Configure multiple keys in the admin panel
2. **Implement caching** - The app caches images and metadata
3. **Batch requests** - Group related operations when possible
4. **Handle rate limits** - The app includes retry logic for 429 errors

## Folder Structure Requirements

For proper chapter detection, organize your Google Drive folders like this:

```
Series Root Folder/
├── Chapter 01/
│   ├── page001.jpg
│   ├── page002.jpg
│   └── ...
├── Chapter 02/
│   ├── page001.jpg
│   ├── page002.jpg
│   └── ...
└── ...
```

## Permissions and Sharing

### File Permissions

- Ensure the Google Drive folders are **shared** with appropriate permissions
- Use "Anyone with the link can view" for public access
- Or share specifically with the Google account used for API access

### Service Account (Alternative)

For production environments, consider using a service account:

1. Create a service account in Google Cloud Console
2. Download the JSON key file
3. Share Drive folders with the service account email
4. Configure the app to use service account authentication

## Troubleshooting

### Common Issues

#### "Client ID not configured"

- Check that `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is set correctly
- Verify the Client ID is valid and from a web application credential

#### "API key not configured"

- Ensure `GOOGLE_API_KEY` is set in environment variables
- Or configure API keys in the admin panel
- Verify the API key has Google Drive API access

#### "Access denied" errors

- Check that Drive folders are properly shared
- Verify the API key has the correct restrictions
- Ensure the OAuth client has the correct authorized origins

#### "Quota exceeded" errors

- Add multiple API keys in the admin panel
- Check your Google Cloud Console quota usage
- Consider requesting quota increases if needed

### Error Codes

- **401**: Authentication failed - check tokens and credentials
- **403**: Access denied - check permissions and quotas
- **404**: File/folder not found - verify URLs and sharing
- **429**: Rate limit exceeded - implement backoff or use multiple keys

## Security Considerations

1. **Never expose API keys** in client-side code
2. **Use environment variables** for sensitive configuration
3. **Implement proper CORS** headers for web origins
4. **Regularly rotate API keys** for security
5. **Monitor API usage** in Google Cloud Console

## Testing the Integration

1. Start your development server: `npm run dev`
2. Navigate to a series page
3. Try creating a new chapter with Google Drive integration
4. Verify that:
   - Authentication works properly
   - Folders load correctly
   - Images display properly
   - Error handling works as expected

## Production Deployment

Before deploying to production:

1. Update authorized origins in Google Cloud Console
2. Set production environment variables
3. Configure multiple API keys for redundancy
4. Test all Google Drive functionality
5. Monitor API usage and quotas
