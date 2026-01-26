# Friendship System Implementation Guide

## Overview
I've created a complete friendship system for your Django backend with the following features:
- Send/receive friend requests
- Accept/reject/cancel friend requests
- Block/unblock users
- List friends, pending requests, and blocked users

## Database Models

### 1. **Friendship Model** (`users/models.py`)
Tracks friend relationships with statuses:
- `pending` - Request sent but not yet accepted
- `accepted` - Users are friends
- `rejected` - Request was rejected
- `blocked` - One user blocked the other

**Key Fields:**
- `requester` - User who sent the request
- `receiver` - User who receives the request
- `status` - Current status of the friendship
- `created_at`, `updated_at` - Timestamps

**Useful Methods:**
- `Friendship.are_friends(user1, user2)` - Check if two users are friends
- `Friendship.get_friends(user)` - Get all friends of a user
- `Friendship.get_pending_requests(user)` - Get pending requests received
- `Friendship.get_sent_requests(user)` - Get pending requests sent

### 2. **BlockedUser Model** (`users/models.py`)
Tracks blocked relationships:

**Key Fields:**
- `blocker` - User who blocked
- `blocked_user` - User who was blocked
- `created_at` - When the block occurred

**Useful Methods:**
- `BlockedUser.is_blocked(user1, user2)` - Check if either user blocked the other

## API Endpoints

### Friend Requests

#### GET/POST `/api/users/friend-requests/`
- **GET**: List pending friend requests received by current user
- **POST**: Send a new friend request
  ```json
  {
    "friend_id": 5
  }
  ```

#### POST `/api/users/friend-requests/<request_id>/accept/`
Accept a pending friend request

#### POST `/api/users/friend-requests/<request_id>/reject/`
Reject a pending friend request

#### POST `/api/users/friend-requests/<request_id>/cancel/`
Cancel a friend request you sent

#### GET `/api/users/sent-requests/`
List all pending requests you've sent

### Friends Management

#### GET `/api/users/friends/`
Get list of all your friends

#### POST `/api/users/friends/<friend_id>/remove/`
Remove a friend

### Blocked Users

#### GET `/api/users/blocked/`
List all users you've blocked

#### POST `/api/users/block/`
Block a user
```json
{
  "friend_id": 5
}
```

#### POST `/api/users/unblock/<blocked_id>/`
Unblock a user

## Setup Instructions

### Step 1: Create and Run Migrations
```bash
cd backend
python manage.py makemigrations users
python manage.py migrate users
```

### Step 2: Test the Endpoints
You can use curl or Postman to test:

```bash
# Send a friend request
curl -X POST http://localhost:8000/api/users/friend-requests/ \
  -H "Content-Type: application/json" \
  -b "access_token=YOUR_TOKEN" \
  -d '{"friend_id": 2}'

# List received requests
curl -X GET http://localhost:8000/api/users/friend-requests/ \
  -b "access_token=YOUR_TOKEN"

# Accept a request
curl -X POST http://localhost:8000/api/users/friend-requests/1/accept/ \
  -b "access_token=YOUR_TOKEN"

# Get friends list
curl -X GET http://localhost:8000/api/users/friends/ \
  -b "access_token=YOUR_TOKEN"

# Block a user
curl -X POST http://localhost:8000/api/users/block/ \
  -H "Content-Type: application/json" \
  -b "access_token=YOUR_TOKEN" \
  -d '{"friend_id": 3}'
```

## Response Examples

### Friendship Object
```json
{
  "id": 1,
  "requester": 1,
  "requester_username": "john",
  "requester_detail": {
    "id": 1,
    "username": "john",
    "email": "john@example.com"
  },
  "receiver": 2,
  "receiver_username": "jane",
  "receiver_detail": {
    "id": 2,
    "username": "jane",
    "email": "jane@example.com"
  },
  "status": "pending",
  "created_at": "2026-01-22T10:30:00Z",
  "updated_at": "2026-01-22T10:30:00Z"
}
```

### Friends List
```json
[
  {
    "id": 2,
    "username": "jane",
    "email": "jane@example.com"
  },
  {
    "id": 3,
    "username": "bob",
    "email": "bob@example.com"
  }
]
```

## Integration with Existing Code

### Using in Views
```python
from users.models import Friendship, BlockedUser

# Check if users are friends
if Friendship.are_friends(user1, user2):
    # They are friends
    pass

# Get all friends
friends = Friendship.get_friends(user)

# Check if user is blocked
if BlockedUser.is_blocked(user1, user2):
    # User is blocked
    pass
```

### Frontend Integration
You can now use these endpoints in your frontend code to:
1. Display friend lists
2. Show pending friend requests
3. Allow users to send/accept/reject requests
4. Manage blocked users

## Error Handling

All endpoints return proper HTTP status codes:
- `200 OK` - Successful GET/POST
- `201 Created` - New resource created
- `204 No Content` - Successful deletion (no response body)
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Not authenticated
- `404 Not Found` - Resource not found

## Best Practices

1. **Always check authentication** - All endpoints validate the access token
2. **Prevent self-actions** - Can't friend/block yourself
3. **Handle duplicates** - Can't send duplicate friend requests
4. **Cascade deletion** - When blocking, friendship is automatically removed
5. **Query optimization** - Models include database indexes for common queries

## Future Enhancements

Consider adding:
- Friendship notifications via WebSockets
- Friend status online/offline tracking
- Friend activity feed
- Friendship statistics
- Friend groups/lists
- Mutual friends detection
