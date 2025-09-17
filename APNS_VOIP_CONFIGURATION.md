# Server-Side APNs Configuration for VoIP Notifications

## Overview
To send VoIP push notifications to iOS devices, your server must be properly configured to communicate with Apple's Push Notification service (APNs) using the correct parameters and authentication.

## Authentication

### Token-Based Authentication (Recommended)
1. **Create a Key**:
   - Go to Apple Developer Portal
   - Navigate to "Keys" under "Certificates, Identifiers & Profiles"
   - Create a new key with "Apple Push Notifications service (APNs)" enabled
   - Download the `.p8` file

2. **Required Information**:
   - **Key ID**: Found in the key details page
   - **Team ID**: Your Apple Developer Team ID
   - **Bundle ID**: Your app's bundle identifier

## APNs Endpoint Configuration

### Server URL
- **Development**: `https://api.sandbox.push.apple.com:443`
- **Production**: `https://api.push.apple.com:443`

### Required Headers
When sending VoIP push notifications, you must include these headers:
```
apns-push-type: voip
apns-priority: 10
apns-topic: {bundle-id}.voip
```

Replace `{bundle-id}` with your actual app bundle identifier.

### Example Request
```http
POST /3/device/{device-token} HTTP/1.1
Host: api.push.apple.com
apns-push-type: voip
apns-priority: 10
apns-topic: app.lovable.a4b57244d3ad47ea85cac99941e17d30.voip
Authorization: bearer {jwt-token}
Content-Type: application/json

{
  "aps": {
    "alert": {
      "title": "Incoming Call",
      "body": "You have an incoming call"
    },
    "sound": "default"
  },
  "type": "incoming_call",
  "caller": {
    "name": "Family Member",
    "number": "+1234567890"
  }
}
```

## JWT Token Generation

To authenticate with APNs, generate a JWT token with:
1. **Header**:
   ```json
   {
     "alg": "ES256",
     "kid": "{key-id}"
   }
   ```

2. **Payload**:
   ```json
   {
     "iss": "{team-id}",
     "iat": {issued-at-time}
   }
   ```

3. **Signature**: Sign with your `.p8` private key

## Important Notes

1. **VoIP Token vs Regular Token**: iOS provides two different tokens - one for regular push notifications and one for VoIP. Make sure you're using the VoIP token for VoIP notifications.

2. **Immediate Delivery**: VoIP pushes have the highest priority and should be delivered immediately. They must wake the app to handle incoming calls.

3. **Payload Size**: VoIP push payloads are limited to 5KB.

4. **No Silent Push**: VoIP pushes cannot be silent - they must display an alert or play a sound.

5. **Rate Limiting**: APNs may rate limit your notifications if sent too frequently.

## Error Handling

Common APNs error responses:
- `400`: Bad request - check payload format
- `403`: Authentication error - check JWT token
- `410`: Device token is no longer valid
- `429`: Rate limited - reduce notification frequency
- `503`: APNs service unavailable - retry with exponential backoff

## Testing

1. Use the development endpoint with a development build of your app
2. Ensure your app properly registers for VoIP notifications
3. Verify the VoIP token is being sent to your server
4. Send test notifications and verify receipt in the app