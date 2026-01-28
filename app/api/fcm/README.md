# FCM API Documentation

This directory contains centralized Firebase Cloud Messaging (FCM) APIs that can be used by both web and mobile applications.

## Base URL
```
/api/fcm
```

## Authentication

All endpoints support authentication via:
1. **Authorization Header**: `Authorization: Bearer <token>`
2. **Query Parameter**: `user_id` (for server-to-server calls)

## Endpoints

### 1. Register FCM Token
Register or update an FCM token for a user device.

**Endpoint:** `POST /api/fcm/register`

**Request Body:**
```json
{
  "fcm_token": "string (required)",
  "device_type": "web" | "ios" | "android" (required),
  "device_id": "string (required)",
  "user_id": "string (optional, if not provided, will use authenticated user)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "FCM token registered successfully",
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "fcm_token": "string",
    "device_type": "web",
    "device_id": "string",
    "is_active": true,
    "updated_at": "ISO string"
  }
}
```

**Example:**
```bash
curl -X POST https://your-domain.com/api/fcm/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "fcm_token": "dGVzdF90b2tlbg...",
    "device_type": "android",
    "device_id": "device_123456"
  }'
```

---

### 2. Get FCM Token Status
Get all FCM tokens for a user (active and inactive).

**Endpoint:** `GET /api/fcm/token?user_id=<user_id>`

**Query Parameters:**
- `user_id` (optional): User ID. If not provided, will use authenticated user from token.

**Response:**
```json
{
  "success": true,
  "tokens": [
    {
      "id": "uuid",
      "fcm_token": "string",
      "device_type": "android",
      "device_id": "string",
      "is_active": true,
      "updated_at": "ISO string",
      "created_at": "ISO string"
    }
  ],
  "count": 2,
  "active_count": 1
}
```

**Example:**
```bash
curl -X GET "https://your-domain.com/api/fcm/token?user_id=user_123" \
  -H "Authorization: Bearer <token>"
```

---

### 3. Remove/Deactivate FCM Token
Remove or deactivate an FCM token for a user.

**Endpoint:** `DELETE /api/fcm/token?user_id=<user_id>&fcm_token=<token>&device_id=<device_id>`

**Query Parameters:**
- `user_id` (optional): User ID. If not provided, will use authenticated user from token.
- `fcm_token` (optional): Specific FCM token to remove. If not provided, removes all tokens for the user.
- `device_id` (optional): Specific device ID to remove. If not provided, removes all tokens for the user.

**Response:**
```json
{
  "success": true,
  "message": "FCM token deactivated successfully"
}
```

**Example:**
```bash
curl -X DELETE "https://your-domain.com/api/fcm/token?user_id=user_123&device_id=device_123" \
  -H "Authorization: Bearer <token>"
```

---

### 4. Send FCM Notification
Send a push notification to a user's devices.

**Endpoint:** `POST /api/fcm/send`

**Request Body:**
```json
{
  "user_id": "string (required)",
  "title": "string (required)",
  "body": "string (required)",
  "icon": "string (optional)",
  "image": "string (optional)",
  "badge": "string (optional)",
  "tag": "string (optional)",
  "data": {
    "url": "string (optional)",
    "custom_field": "any (optional)"
  },
  "actions": [
    {
      "action": "string",
      "title": "string",
      "icon": "string (optional)"
    }
  ],
  "requireInteraction": "boolean (optional)",
  "silent": "boolean (optional)",
  "vibrate": [200, 100, 200] (optional)
}
```

**Response:**
```json
{
  "success": true,
  "sent": 2,
  "failed": 0,
  "total": 2,
  "results": [
    {
      "success": true,
      "endpoint": "device_123",
      "device_type": "android",
      "messageId": "projects/xxx/messages/yyy"
    }
  ]
}
```

**Example:**
```bash
curl -X POST https://your-domain.com/api/fcm/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "user_id": "user_123",
    "title": "New Message",
    "body": "You have a new message from John",
    "data": {
      "url": "/messages/123"
    }
  }'
```

---

## Legacy Endpoint

### Push Notifications (Legacy)
The `/api/push-notifications` endpoint is still available for backward compatibility but uses the centralized FCM service internally.

**Endpoint:** `POST /api/push-notifications`

This endpoint has the same request/response format as `/api/fcm/send` but is maintained for backward compatibility.

---

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (missing or invalid parameters)
- `401` - Unauthorized (invalid or missing authentication)
- `500` - Internal Server Error

---

## Mobile Integration Examples

### Android (Kotlin)
```kotlin
// Register FCM token
val token = FirebaseMessaging.getInstance().token.await()
val response = httpClient.post("https://your-domain.com/api/fcm/register") {
    header("Authorization", "Bearer $authToken")
    contentType(ContentType.Application.Json)
    body = mapOf(
        "fcm_token" to token,
        "device_type" to "android",
        "device_id" to getDeviceId()
    )
}
```

### iOS (Swift)
```swift
// Register FCM token
Messaging.messaging().token { token, error in
    guard let token = token else { return }
    
    let url = URL(string: "https://your-domain.com/api/fcm/register")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let body: [String: Any] = [
        "fcm_token": token,
        "device_type": "ios",
        "device_id": getDeviceId()
    ]
    request.httpBody = try? JSONSerialization.data(withJSONObject: body)
    
    URLSession.shared.dataTask(with: request).resume()
}
```

---

## Notes

1. **Device ID**: Each device should have a unique `device_id`. This allows multiple devices per user.
2. **Token Updates**: If a token is registered for the same `user_id` + `device_id` combination, it will be updated rather than creating a duplicate.
3. **Token Deactivation**: Tokens are soft-deleted (marked as inactive) rather than hard-deleted, allowing for better tracking and debugging.
4. **Invalid Tokens**: If a notification fails due to an invalid token, the token is automatically deactivated in the database.
