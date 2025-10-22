const express = require("express");
const { connect, subscribeToQueue } = require("./borker/borker");
const setListeners = require("./borker/listners");
const app = express();

connect().then(() => {
    setListeners();
})

app.get("/", (req, res) => {
    res.send("Notification service is up and running");
})



module.exports = app;