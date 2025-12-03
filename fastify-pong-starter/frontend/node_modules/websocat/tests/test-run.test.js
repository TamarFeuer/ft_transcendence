const test = require("ava")
const bent = require("bent")
const websocat = require("../")
const getPort = require("get-port")
const micro = require("micro")
const request = bent("string")

test("requests should be piped through websocats", async (t) => {
  // Web service to proxy (on client)
  const webService = micro((req, res) => "Hello world!")
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

  const response = await request(`http://127.0.0.1:3000`)
  t.assert(response === "Hello world!")

  await httpInWebSocketOut.stop()
  await websocketIn.stop()
})
