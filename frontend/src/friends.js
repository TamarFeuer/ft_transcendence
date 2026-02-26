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
			sendButton.addEventListener('click', function(){
				const friendUsername = friendInput.value;
				fetch('/api/friends/send', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json'},
					body: JSON.stringify({to_username: friendUsername})
				})
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
	handleSendingRequest(addFriendSection, addFriendButton);
	expandPendingRequests(pendingRequestsSection, pendingRequestsButton);
	// const me = FAKE_USERS[currentUserId];
	// if (!me || !me.friends || me.friends.length === 0) {
	// 	friendsPanel.textContent = "No friends yet";
	// 	return;
	// }

	// me.friends.forEach(friendId => {
	// 	const friend = FAKE_USERS[friendId];
	// 	if (!friend) return;

	// 	const div = document.createElement("div");
	// 	div.className = "py-1 px-2 flex items-center gap-2";

	// 	const isOnline = onlineUsers.includes(friendId);

	// 	div.innerHTML = `
	// 		<span class="font-semibold">${friend.name}</span>
	// 		<span>${friend.avatar}</span>
	// 		<span class="text-sm ${isOnline ? "text-green-400" : "text-gray-400"
	// 		}">
	// 			${isOnline ? "online" : "offline"}
	// 		</span>
	// 	`;

	// 	friendsListSection.appendChild(div);
	// });
}