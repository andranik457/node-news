
/**
 * Module Dependencies
 */

const router        = require("express").Router();
const winston       = require("winston");
const messagesFunc  = require("../modules/messages");

/**
 * Make pre-order
 */
router.post("/compose", async (req, res, next) => {
    try {
        res.send(await messagesFunc.compose(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

/**
 * Get messages
 */
router.post("/get", async (req, res, next) => {
    try {
        res.send(await messagesFunc.getMessages(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

/**
 * Edit message
 */
router.post("/edit/message/:messageId", async (req, res, next) => {
    try {
        res.send(await messagesFunc.editMessage(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

/**
 * Edit message conversation
 */
router.post("/edit/conversation/:conversationId", async (req, res, next) => {
    try {
        res.send(await messagesFunc.editConversation(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});


module.exports = router;