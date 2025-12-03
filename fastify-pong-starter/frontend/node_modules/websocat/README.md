# Node Websocat (websocat)

> Netcat, curl and socat for WebSockets.

Use [websocat](https://github.com/vi/websocat) as an npm module for tighter integration with node apps. Automatically downloads websocat.

## Usage

```bash
npm install websocat
```

```javascript
const websocat = require("websocat")

// Web service to proxy (on client)
const webService = micro((req, res) => res.end("Hello world!"))
webService.listen(3000)

// Start websocat that ingests a tcp/http request and hosts a websocket
const httpInWebSocketOut = await websocat.create({
  listen: "tcp-l:127.0.0.1:3001",
  host: "ws://127.0.0.1:3002",
  exitOnEOF: true,
  binary: true,
})

// Start a websocat that ingests messages from a websocket and forwards
// to our hello world server
const websocketIn = await websocat.create({
  listen: "ws-l:127.0.0.1:3002",
  host: "tcp:127.0.0.1:5000",
  exitOnEOF: true,
  binary: true,
})

const response = await request(`http://127.0.0.1:2000`)
// response === "Hello world!"

await httpInWebSocketOut.stop()
await websocketIn.stop()
```

## Options

```javascript
await websocat.create({
  // Alias: listen
  addr1: "tcp-l:127.0.0.1:3000",

  // Alias: host
  addr2: "ws://127.0.0.1:4000",

  // Close a data transfer direction if the other one reached EOF
  exitOnEOF: false,

  // strict line/message mode: drop too long messages instead of
  // splitting them, drop incomplete lines.
  strict: false,

  // Use \0 instead of \n for linemode
  nullTerminated: false,

  // Serve only once. Not to be confused with -1 (--one-message)
  oneshot: false,

  // Send and/or receive only one message. Use with --no-close and/or -u/-U.
  oneMessage: false,

  // Send message to WebSockets as binary messages
  binary: false,

  // Don't send Close message to websocket on EOF
  noClose: false,

  // Send message to WebSockets as text messages
  text: false,

  // Accept invalid certificates and hostnames while connecting to TLS
  insecure: false,

  // Inhibit copying data in one direction
  unidirectional: false,

  // Inhibit copying data in the other direction (or maybe in
  // both directions if combined with -u)
  unidirectionalReverse: false,

  // Add custom HTTP headers to websocket client request.
  headers: {
    Authorization: "Bearer SomeToken",
  },

  // Add custom HTTP header to websocket upgrade reply.
  serverHeaders: {
    Authorization: "Bearer SomeToken",
  },
})
```
