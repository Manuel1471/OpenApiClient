const { ipcMain } = require("electron");
const WebSocket = require("ws");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");

const sockets = new Map();

ipcMain.handle("websocket-connect", async (event, { id, url, headers = {} }) => {
  const socket = new WebSocket(url, { headers });
  sockets.set(id, socket);
  socket.on("message", (data) => event.sender.send("websocket-message", { id, data: data.toString() }));
  socket.on("close", (code, reason) => event.sender.send("websocket-status", { id, status: "closed", detail: `${code} ${reason}` }));
  socket.on("error", (error) => event.sender.send("websocket-status", { id, status: "error", detail: error.message }));
  return await new Promise((resolve) => {
    socket.once("open", () => resolve({ success: true }));
    socket.once("error", (error) => resolve({ success: false, error: error.message }));
  });
});

ipcMain.handle("websocket-send", async (_, { id, message }) => {
  const socket = sockets.get(id);
  if (!socket || socket.readyState !== WebSocket.OPEN) return { success: false, error: "WebSocket is not connected." };
  socket.send(message);
  return { success: true };
});
ipcMain.handle("websocket-close", async (_, id) => {
  sockets.get(id)?.close();
  sockets.delete(id);
  return { success: true };
});

ipcMain.handle("grpc-call", async (_, request) => {
  try {
    const definition = protoLoader.loadSync(request.protoPath, { keepCase: true, defaults: true, oneofs: true });
    const descriptor = grpc.loadPackageDefinition(definition);
    const Service = request.service.split(".").reduce((value, key) => value?.[key], descriptor);
    if (!Service) throw new Error(`Service ${request.service} was not found in the proto file.`);
    const client = new Service(request.address, grpc.credentials.createInsecure());
    const payload = request.payload ? JSON.parse(request.payload) : {};
    return await new Promise((resolve) => client[request.method](payload, (error, response) => {
      client.close();
      resolve(error ? { success: false, error: error.message } : { success: true, body: JSON.stringify(response, null, 2) });
    }));
  } catch (error) { return { success: false, error: error.message }; }
});

module.exports = {};
