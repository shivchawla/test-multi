require('dotenv').config()

// External Dependencies
import express from "express";
import cors from "cors";
import { urlencoded, json } from "body-parser";
import { accessibleRecordsPlugin } from '@casl/mongoose';

import mongoose from 'mongoose';
import MongooseDelete from 'mongoose-delete';
mongoose.plugin(MongooseDelete, {deletedBy: true, deletedAt: true});
mongoose.plugin(accessibleRecordsPlugin);

// Local dependencies
import { Logger } from "./middlewares/log.middleware"
import { configureConnectionManager } from "./config/connectionManager";

import routes  from "./routes";
import { sendErrorResponse } from "./utils/response";

/**
 * Configure the Express App with middleware, routes, and a database connection
 * @returns {Object} -- Express App and Winston Logger
 */
export async function configure(apiVersion) {
  // Create the Express App
  const app = express();

  // parse application/x-www-form-urlencoded
  app.use(urlencoded({ extended: false }));

  // parse application/json
  app.use(json());

  // Allow CORS requests
  app.use(cors({ origin: process.env.CORS || "*" }));

  // Attach the log handlers
  const { routeLogger, log, logMiddleware } = Logger();
  app.use(logMiddleware);
  app.use(routeLogger);

  log.info("Configuring multitenant connection manager");
  await configureConnectionManager();

  log.info("Configuring event manager");
  await setupEvents();

  // Attach the router
  app.use(`/api`, routes());

  app.use((err, req, res, next) => {
    console.log(err);
    sendErrorResponse(res, {code: 500, e: err, message: err?.message ?? 'Internal Server Error'});
  })

  // Return the configured Express App
  return { app, log };
}

export function stop({ server, log }) {
  return async () => {
    log.info(MESSAGES.SHUTDOWN_START);
    await server.close();
    log.info(MESSAGES.SHUTDOWN_COMPLETE);
  };
}

export async function start() {
  // Set the Port and Host
  const port = process.env.PORT
  const apiVersion = process.env.API_VERSION;

  // Create the custom Express App
  const { app, log } = await configure(apiVersion);

  // Start the service
  const server = await app.listen(port, function (err) {
    if (err) log.info("Error in server setup");
    log.info(MESSAGES.STARTUP.replace("%port", port));
  });

  // Listen for sigterm command and gracefully shutdown
  process.on("SIGINT", stop({ server, log }));
}

/* istanbul ignore if */
if (!module.parent) {
  // Start the service if not imported as a module and ignore this statement in test coverage
  start();
}
