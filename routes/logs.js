
/**
 * Module Dependencies
 */

const router        = require("express").Router();
const winston       = require("winston");
const logsFunc      = require("../modules/logs");

/**
 * Make pre-order
 */
router.post("/get", async (req, res, next) => {
    try {
        res.send(await logsFunc.get(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

module.exports = router;