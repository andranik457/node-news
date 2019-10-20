
/**
 * Module Dependencies
 */

const router        = require("express").Router();
const url           = require('url');
const winston       = require("winston");
const searchFunc    = require("../modules/search");

/**
 * Search
 */
router.post("/mainSearch", (req, res) => {
    searchFunc.search(req)
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