import { onlineUsers } from "./chat";
import { fetchWithRefreshAuth } from "./usermanagement";
// creates the add friend Button
function renderAddFriendsButton(addFriendSection){
	const addFriendButton = document.createElement('button');
	addFriendButton.style.display = 'block';
	addFriendButton.textContent = 'Add New Friend';
	addFriendSection.appendChild(addFriendButton);
	return addFriendButton;
}

function clearOnNextClick(message){
	function handler(){
		message.textContent = '';
		document.removeEventListener('click', handler);
	}
	setTimeout(() => {
		document.addEventListener('click', handler);
	}, 0);
}

function sendFriendRequest(friendInput, status) {
	const friendUsername = friendInput.value;
	if (!friendUsername) return;
  
	status.textContent = '';
  
	fetch('/api/friends/send', {
	  method: 'POST',
	  headers: { 'Content-Type': 'application/json' },
	  body: JSON.stringify({ to_username: friendUsername })
	})
	  .then(response => response.json())
	  .then(data => {
		if (data.success) {
		  status.style.color = 'lightgreen';
		  status.textContent = 'Friend Request Sent';
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
		status.textContent = 'Could not send friend request';
		clearOnNextClick(status);
	  });
  }

function handleSendingRequest(addFriendSection, addFriendButton){
	let container = null;
		addFriendButton.addEventListener('click', function(){
		// addFriendButton.remove();
		if (container){
			container.remove();
			container = null;
		} else{
			console.log('Add friend clicked');
			container = document.createElement('div');
			container.style.display = 'flex';
			container.style.gap = '12px';
			addFriendSection.appendChild(container);
			const friendInput = document.createElement('input');
			friendInput.id = 'friendUsernameInput';
			friendInput.placeholder = 'Enter Username';
			friendInput.style.color = 'black';
			container.appendChild(friendInput);
	
			const sendButton = document.createElement('button');
			sendButton.textContent = '➤';
			sendButton.style.color = 'lightblue';
			sendButton.style.fontSize = '30px';
			container.appendChild(sendButton);

			//message showing success or failure of send request
			const status = document.createElement('div');
			status.style.color = 'lightgreen';
			container.appendChild(status);

			//clear old message
			sendButton.addEventListener('click', function(){
				sendFriendRequest(friendInput, status);
			});

			friendInput.addEventListener('keydown', function(event){
				if (event.key === 'Enter'){
					sendFriendRequest(friendInput, status);
				}
			})
		}

	})
}

function handleAccept(requestId){
	fetchWithRefreshAuth('/api/friends/accept', {
		method: 'POST',
		headers: {'Content-Type': 'application/json'},
		credentials: 'include',
		body: JSON.stringify({request_id: requestId})
	});
}

function handleDelete(requestId){
	fetchWithRefreshAuth('/api/friends/delete', {
		method: 'POST',
		headers: {'Content-Type' : 'application/json'},
		credentials: 'include',
		body: JSON.stringify({request_id: requestId})
	});
}

function createPendingRequestsElements(requestsList, data){
	data.requests.forEach(request => {
		const singlePendingRequest = document.createElement('div');
		const acceptButton = document.createElement('button');
		const declineButton = document.createElement('button');
		const friendUsername = document.createElement('span');

		friendUsername.textContent = request['from_user__username'];
		singlePendingRequest.style.display = 'flex';
		singlePendingRequest.style.gap = '12px';
		acceptButton.textContent = '✅';
		acceptButton.addEventListener('click', () => handleAccept(request.id));
		declineButton.textContent = '❌';
		declineButton.addEventListener('click', () => handleDelete(request.id));	
		singlePendingRequest.appendChild(friendUsername);
		singlePendingRequest.appendChild(acceptButton);
		singlePendingRequest.appendChild(declineButton);
		requestsList.appendChild(singlePendingRequest);
	});
}

function expandPendingRequests(pendingRequestsSection, pendingRequestsButton){
	let requestsList = null;
	pendingRequestsButton.addEventListener('click', function(){
		if (requestsList){
			requestsList.remove();
			requestsList = null;
		} else {
			requestsList = document.createElement('div');
			requestsList.textContent = 'requests will appear here'
			pendingRequestsSection.appendChild(requestsList);
			
			fetchWithRefreshAuth('/api/friends/pending')
			.then(response => response.json()).then(data => {
				console.log(data);
				createPendingRequestsElements(requestsList, data);
			});
		}
	})
}

function renderPendingRequestsButton(pendingRequestsSection){
	const pendingRequestsButton = document.createElement('button');
	pendingRequestsButton.style.display = 'block';
	pendingRequestsButton.textContent = 'Pending Requests';
	pendingRequestsSection.appendChild(pendingRequestsButton);
	return pendingRequestsButton;
}

function renderFriendsButton(section){
	const button = document.createElement('button');
	button.style.display = 'block';
	button.textContent = 'Friends';
	section.appendChild(button);
	return button;
}

function renderFriends(friendsList, onlineFriends, offlineFriends){
	onlineFriends.forEach(friend => {
		const row = document.createElement('div');
		//green dot
		const dot = document.createElement('span');
		dot.className = 'inline-block w-2 h-2 rounded-full bg-green-400 mr-2';
		row.appendChild(dot);
		row.appendChild(document.createTextNode(friend.username));
		friendsList.appendChild(row);
	})

	offlineFriends.forEach(friend => {
		const row = document.createElement('div');
		row.appendChild(document.createTextNode(friend.username));
		friendsList.appendChild(row);
	})

}

function expandFriendsList(friendsListSection, button){
	let friendsList = null;
	button.addEventListener('click', function(){
		if (friendsList){
			friendsList.remove();
			friendsList = null;
		}
		else{
			friendsList = document.createElement('div');
			friendsListSection.appendChild(friendsList);

			fetchWithRefreshAuth('/api/friends/list').then(response => response.json())
			.then(data => {
				friendsList.innerHTML = '';
				
				if (!data.friends || data.friends.length === 0){
					friendsList.textContent = 'No friends yet';
					return;
				}
				//logic to show online friends first and then offline
				const onlineFriends = [];
				const offlineFriends = [];
				data.friends.forEach(friend => {
				const idStr = String(friend.id);
				const isOnline = onlineUsers.some(user => user.id === idStr);
				if (isOnline){
					onlineFriends.push(friend);
				} else {
					offlineFriends.push(friend);
				}
			});
			renderFriends(friendsList, onlineFriends, offlineFriends);
		});


		}
	})
}

export function renderFriendsPanel(currentUserId, targetElementId) {
	console.log('renderFriendsPanel called with', currentUserId, targetElementId);

	const friendsPanel = document.getElementById(targetElementId);

	if (!friendsPanel){
		console.error("Could not find element with id: ", targetElementId);
		return ;
	}
	friendsPanel.innerHTML = "";

	const addFriendSection = document.createElement('div');
	const pendingRequestsSection = document.createElement('div');
	const friendsListSection = document.createElement('div');
	friendsPanel.appendChild(addFriendSection);
	friendsPanel.appendChild(pendingRequestsSection);
	friendsPanel.appendChild(friendsListSection);

	const addFriendButton = renderAddFriendsButton(addFriendSection);
	const pendingRequestsButton = renderPendingRequestsButton(pendingRequestsSection);
	const friendsListButton = renderFriendsButton(friendsListSection);
	handleSendingRequest(addFriendSection, addFriendButton);
	expandPendingRequests(pendingRequestsSection, pendingRequestsButton);
	expandFriendsList(friendsListSection, friendsListButton);
	
}