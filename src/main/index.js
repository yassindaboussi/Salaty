"use strict";

const { initCrashHandlers } = require("./app/crash-handler");
initCrashHandlers();

const { startApplication } = require("./app/bootstrap");

startApplication();
