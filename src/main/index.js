"use strict";

const startup = require("./app/startup-timing");
startup.mark("main-js");

const { initCrashHandlers } = require("./app/crash-handler");
initCrashHandlers();

const { startApplication } = require("./app/bootstrap");
startup.mark("modules");

startApplication();
