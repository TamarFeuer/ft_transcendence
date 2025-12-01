const express = require('express');
const fs = require('fs');
const app = express();

console.log("Node.js index file executed.");
console.log("Current working directory:", process.cwd());
console.log("Node.js version:", process.version);
console.log("Platform:", process.platform);	

app.get('/', (request, response) => {
	fs.readFile('./home.html', 'utf8', (err, html) => {
		if (err) {
			console.error('Error reading HTML file:', err);
			return response.status(500).send('Internal Server Error');
		}
		response.send(html);
	});
});

app.listen(process.env.PORT || 3000, () => {
	console.log('Server is running on http://localhost:3000');
});