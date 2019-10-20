
/**
 * Module Dependencies
 */

const router        = require("express").Router();
const reportFunc    = require("../modules/reports");
const winston       = require("winston");

/**
 * Get Agent balance change actions
 */
router.post("/:agentId/balance-changes", (req, res) => {
    reportFunc.balanceChanges(req)
        .then(result => {
            res.status(result.code);
            res.send(result)
        })
        .catch(err => {
            winston.log("error", err);

            res.status(err.code);
            return res.json(err);
        });
});

/**
 * Get orders Full Data
 */
router.post("/orders-full-data", (req, res) => {
    reportFunc.ordersFullData(req)
        .then(result => {
            res.status(result.code);
            res.send(result)
        })
        .catch(err => {
            winston.log("error", err);

            res.status(err.code);
            return res.json(err);
        });
});

module.exports = router;