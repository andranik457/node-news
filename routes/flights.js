
/**
 * Module Dependencies
 */

const router        = require("express").Router();
const url           = require('url');
const flightFunc    = require("../modules/flight");
const winston       = require("winston");

/**
 * Create Flight
 */
router.post("/create", (req, res) => {
    flightFunc.create(req)
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
 * Edit Flight
 */
router.post("/edit/:flightId", async (req, res, next) => {
    try {
        res.send(await flightFunc.edit(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

/**
 * Delete Flight
 */
router.get("/delete/:flightId", (req, res) => {
    flightFunc.delete(req)
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
 * Get Flights
 */
router.post("/get", (req, res) => {
    flightFunc.getFlights(req)
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
 * Get Flight
 */
router.get("/get/:flightId", (req, res) => {
    flightFunc.getFlight(req)
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