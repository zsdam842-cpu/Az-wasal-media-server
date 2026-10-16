import http from "node:http";
import { Server } from "socket.io";

import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { setupSocket } from "./realtime/socket.js";

const app = createApp();

const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin:
      env.corsOrigin === "*"
        ? true
        : env.corsOrigin,
  },
});

setupSocket(io);

httpServer.listen(
  env.port,
  () => {
    console.log(
      `Wasal server running on port ${env.port}`,
    );
  },
);
