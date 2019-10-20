
/**
 * Module dependencies
 */

const platformConfigs   = require("../config/config");
const jwt               = require("jsonwebtoken");
const async             = require("async");
const errorTexts        = require("../texts/errorTexts");

const token = {

    /**
     * Decode JWT
     * @param {Object} auth
     * @returns {{bearer: *, userId: (*|tokenSchema.userId|{type, required}), country: *}}
     */

    decodeToken : auth => {
        const token = auth.split(" ");
        const decoded = jwt.verify(token[1], platformConfigs[process.env.NODE_ENV].jwtSecret);
        return {
            bearer : token[1],
            userId : decoded.userId
        };
    },

    /**
     * Create Token Mask To Store In Redis
     * @param {Object} info
     * @returns {string}
     */

    createTokenMask : info => {
        const tokenType = "bearer";
        const userId = info.userId || info.user.userId;
        return `${tokenType}:${userId}:${info.bearer}`;
    }

};

module.exports = token;




