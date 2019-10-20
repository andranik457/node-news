
/**
 * Module Dependencies
 */

const router        = require("express").Router();
const url           = require('url');
const winston       = require("winston");
const userFunc      = require("../modules/user");
const exchangeFunc  = require("../modules/exchange");
const Helper        = require("../modules/helper");
const resourcesFunc = require("../modules/resources");

/**
 * User Register
 */
router.post("/user/register", (req, res) => {
    userFunc.insert(req)
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
 * Verify user registration
 */
router.get("/user/verify", (req, res) => {
    let parts = url.parse(req.url, true);
    let query = parts.query;

    userFunc.verifyUser(query)
        .then(result => {
            res.send(result)
        })
        .catch(err => {
            winston.log("error", err);

            res.status(err.code);
            return res.json(err);
        })
});

/**
 * User Login
 */
router.post("/user/login", (req, res) => {
    userFunc.login(req)
        .then(result => {
            res.send(result)
        })
        .catch(err => {
            winston.log("error", err);
            //
            res.status(err.error.code);
            return res.json(err.error);
        })
});

router.post("/user/forgot-password", async (req, res, next) => {
    try {
        res.send(await userFunc.forgotPassword(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

/**
 * Verify password forgot
 */
router.get("/user/forgot-password/verify", async (req, res, next) => {
    try {
        res.send(await userFunc.forgotPasswordVerify(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

/**
 * Reset password
 */
router.post("/user/forgot-password/reset/:userId", async (req, res, next) => {
    try {
        res.send(await userFunc.forgotPasswordReset(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});


/**
 * Get exchange rate info
 */
router.get("/exchangeRate", async (req, res, next) => {
    try {
        res.send({
            code: 200,
            status: "OK",
            message: "Daily rate info!",
            result : await Helper.getCurrencyInfo()
        })
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});


router.post("/exchange/rate-by-range", async (req, res, next) => {
    try {
        res.send({
            code: 200,
            status: "OK",
            message: "Exchange Rate Info For Selected Range!",
            result : await exchangeFunc.rateByRange(req)
        })
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

router.get("/exchange/add-manual/:date", async (req, res, next) => {
    try {
        res.send({
            code: 200,
            status: "OK",
            message: "Exchange Rate Info successfully added!",
            result : await exchangeFunc.addManual(req)
        })
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

router.get("/orderInfo/:pnr/:lastName", async (req, res, next) => {
    try {
        res.send(await Helper.getOrderByPnrLastName(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

router.get("/resource/:id", (req, res, next) => {
    resourcesFunc.getResource(req, (err, readStream, file) => {
        if (err) return next(err);
        res.header("Content-Type", file.contentType || file);
        readStream.pipe(res);
    });
});

/**
 * Not Found API
 */
router.use((req, res, next) => {
    let err = new Error("Not Found!");
    err.status = 404;
    next(err);
});

module.exports = router;