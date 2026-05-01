import { onlineUsers } from "../chat/chat.js";
import { fetchWithRefreshAuth } from "./usermanagement.js";
import { t } from '../i18n/index.js';


function clearOnNextClick(message){
    function handler(){
        message.textContent = '';
        document.removeEventListener('click', handler);
    }
    setTimeout(() => {
        document.addEventListener('click', handler);
    }, 0);
}

export function sendFriendRequest(friendInput, status) {
    status.textContent = '';
  
    fetchWithRefreshAuth('/api/friends/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to_username: friendInput })
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          status.style.color = 'lightgreen';
          status.textContent = data.message || t('FRIEND_REQUEST_SENT');
          clearOnNextClick(status);
        } else if (data.error) {
          status.style.color = 'red';
          status.textContent = data.error;
          clearOnNextClick(status);
        }
      })
      .catch(err => {
        console.error('Error sending friend request', err);
        status.style.color = 'red';
        status.textContent = t('FRIEND_REQUEST_FAILED');
        clearOnNextClick(status);
      });
}

export function handleAccept(requestId){
    return fetchWithRefreshAuth('/api/friends/accept', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        credentials: 'include',
        body: JSON.stringify({request_id: requestId})
    });
}

export function handleDelete(requestId){
    return fetchWithRefreshAuth('/api/friends/delete', {
        method: 'POST',
        headers: {'Content-Type' : 'application/json'},
        credentials: 'include',
        body: JSON.stringify({request_id: requestId})
    });
}

export function removeFriend(friendId){
    return fetchWithRefreshAuth('/api/friends/remove', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ friend_id: friendId})
    });
}

export function fetchFriendsList(){
    return fetchWithRefreshAuth('/api/friends/list').then(response => response.json())
    .then(data => {
        if (!data.friends || data.friends.length === 0)
            return { onlineFriends: [], offlineFriends: [] };

        const onlineFriends = [];
        const offlineFriends = [];
        data.friends.forEach(friend => {
            if (onlineUsers[friend.id]){
                onlineFriends.push(friend);
            } else {
                offlineFriends.push(friend);
            }
        });
        return { onlineFriends, offlineFriends };
    });
}

export function fetchPendingRequests(){
    return fetchWithRefreshAuth('/api/friends/pending').then(res => res.json())
    .then(data => data.requests || []);
}