
/**
 * Module Dependencies
 */

const router        = require("express").Router();
const url           = require('url');
const orderFunc     = require("../modules/order");
const winston       = require("winston");

/**
 * Make pre-order
 */
router.post("/pre-order", async (req, res, next) => {
    try {
        res.send(await orderFunc.preOrder(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

/**
 * Make booking / order
 */
router.post("/order", async (req, res, next) => {
    try {
        res.send(await orderFunc.order(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

router.post("/get-orders", async (req, res, next) => {
    try {
        res.send(await orderFunc.getOrders(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

router.get("/get-order-by-pnr/:pnr", async (req, res, next) => {
    try {
        res.send(await orderFunc.getOrderByPnr(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

router.post("/edit/:pnr", async (req, res, next) => {
    try {
        res.send(await orderFunc.editOrder(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

router.post("/cancel/:pnr", async (req, res, next) => {
    try {
        res.send(await orderFunc.cancelOrder(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

router.post("/cancel-pre-order/:pnr", async (req, res, next) => {
    try {
        res.send(await orderFunc.cancelPreOrder(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

router.post("/refund/:pnr", async (req, res, next) => {
    try {
        res.send(await orderFunc.refundOrder(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

router.post("/booking-to-ticketing/:pnr", async (req, res, next) => {
    try {
        res.send(await orderFunc.bookingToTicketing(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

router.post("/split/:pnr", async (req, res, next) => {
    try {
        res.send(await orderFunc.split(req));
    }
    catch (err) {
        winston.log("error", err);
        next(err);
    }
});

module.exports = router;