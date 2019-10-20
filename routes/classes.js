
/**
 * Module Dependencies
 */

const router    = require("express").Router();
const url       = require('url');
const classFunc = require("../modules/class");
const winston   = require("winston");

/**
 * Create Class
 */
router.post("/create/:flightId", (req, res) => {
    classFunc.create(req)
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
 * Edit Class
 */
router.post("/edit/:classId", async (req, res, next) => {
    try {
        res.send(await classFunc.edit(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

/**
 * Delete Class
 */
router.get("/delete/:classId", (req, res) => {
    classFunc.delete(req)
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
 * Get classes by flightId
 */
router.get("/get-by-flightId/:flightId", (req, res) => {
    classFunc.getByFlightId(req)
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