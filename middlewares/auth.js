
/**
 * Module dependencies
 */

const platformConfigs= require("../config/config");
const mongoRequests  = require("../dbQueries/mongoRequests");
const tokenFunction  = require("../modules/token");
const errorTexts       = require("../texts/errorTexts");
const async          = require("async");
const winston        = require("winston");


const auth = {

    /**
     * Check Token
     * @param {Object} req
     * @param {Object} res
     * @param {Function} next
     */
    isAuth : (req, res, next) => {
        // if (!req.headers.authorization) {
        //     next({
        //         code: 401,
        //         status : "error",
        //         message : errorTexts.unauthorized
        //     });
        //     return;
        // }
        //
        // const decode = tokenFunction.decodeToken(req.headers.authorization);
        //
        // async.series([
        //     callback => {
        //         auth.mongoAuth(decode.bearer, (err, result) => {
        //             err ? callback(err, null) : callback(null, result);
        //         });
        //     }
        // ], (err, result) => {
        //     if (result[0] !== null) {
        //         result[0].token = decode.bearer;
        //     }
        //     req.userInfo = result[0];
        //
        //     if (err) return next(err);
        //     async.parallel([
        //         () => next()
        //     ]);
        // });

        req.userInfo = {};

        async.parallel([
            () => next()
        ]);

    },

    /**
     * Check Token In MongoDB
     * @param {String} token
     * @param {Function} next
     */
    mongoAuth : (token, next) => {
        mongoRequests.findToken(token, (err, result) => next(err, result));
    }

};

module.exports = auth;