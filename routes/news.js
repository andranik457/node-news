
/**
 * Module Dependencies
 */

const router    = require("express").Router();
const winston   = require("winston");
const newsFunc  = require("../modules/news");

/**
 * Make pre-order
 */
router.post("/compose", async (req, res, next) => {
    try {
        res.send(await newsFunc.compose(req));
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
        res.send(await newsFunc.getNews(req));
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
        res.send(await newsFunc.editMessage(req));
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
        res.send(await newsFunc.editConversation(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});


module.exports = router;