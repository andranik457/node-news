
/**
 * Modoule Dependencies
 */
const _             = require("underscore");
const winston       = require("winston");
const mongoRequests = require("../dbQueries/mongoRequests");
const Helper        = require("../modules/helper");
const moment        = require("moment");
const successTexts  = require("../texts/successTexts");
const errorTexts    = require("../texts/errorTexts");
const ObjectID      = require('mongodb').ObjectID;

const userHelper = {
    asyncGetUserInfoById,
    asyncGetUserInfoByEmail,
    asyncUseUserBalance,
    getBalanceUpdateInfo,
    useBalanceByAdmin,
    getBalanceChanges
};

/**
 *
 * @param userId
 * @returns {Promise<any>}
 */
async function asyncGetUserInfoById(userId) {
    let documentInfo = {};
    documentInfo.collectionName = "users";
    documentInfo.filterInfo = {userId: userId.toString()};
    documentInfo.projectionInfo = {};

    return new Promise((resolve, reject) => {
        mongoRequests.findDocument(documentInfo)
            .then(docInfo => {
                resolve(docInfo)
            })
            .catch(err => {
                winston('error', err);
                reject(errorTexts.forEnyCase)
            })
    });
}

/**
 *
 * @param email
 * @returns {Promise<any>}
 */
async function asyncGetUserInfoByEmail(email) {
    let documentInfo = {};
    documentInfo.collectionName = "users";
    documentInfo.filterInfo = {email: email};
    documentInfo.projectionInfo = {};

    return new Promise((resolve, reject) => {
        mongoRequests.findDocument(documentInfo)
            .then(docInfo => {
                resolve(docInfo)
            })
            .catch(err => {
                winston('error', err);
                reject(errorTexts.forEnyCase)
            })
    });
}

/**
 *
 * @param userId
 * @param amount
 * @returns {Promise<*>}
 */
async function asyncUseUserBalance(userId, amount) {
    if ("number" !== typeof amount) {
        return Promise.reject(errorTexts.incorrectAmountType)
    }

    // get userInfo by userId
    let userInfo = await asyncGetUserInfoById(userId);

    let getFromBalance = 0;
    let getFromCredit = 0;
    if ((userInfo.balance.currentBalance + userInfo.balance.maxCredit - userInfo.balance.currentCredit) < amount) {
        return Promise.reject({
            code: 400,
            status: "error",
            message: "You don't have enough money"
        })
    }
    else if (amount > userInfo.balance.currentBalance) {
        getFromBalance = userInfo.balance.currentBalance;
        getFromCredit = amount - getFromBalance;
    }
    else {
        getFromBalance = amount;
    }

    let documentInfo = {};
    documentInfo.collectionName = "users";
    documentInfo.filterInfo = {userId: userId};
    documentInfo.updateInfo = {
        $inc: {
            "balance.currentBalance": -getFromBalance,
            "balance.currentCredit": getFromCredit
        }
    };

    return new Promise((resolve, reject) => {
        mongoRequests.updateDocument(documentInfo)
            .then(docInfo => {
                if (1 === docInfo.ok) {
                    resolve({
                        success: 1
                    })
                }
            })
            .catch(err => {
                winston('error', err);
                reject(errorTexts.forEnyCase)
            })
    });
}

/**
 *
 * @param data
 * @returns {Promise<{currency, rate: *|number, updateInfo: {$inc: {"balance.currentBalance": number, "balance.currentCredit": number}}}>}
 */
async function getBalanceUpdateInfo(data) {
    let payForCredit = 0;
    let payForBalance = 0;

    let balanceInfo = data.editableUserInfo.balance;
    let reqInfo = data.body;

    let amountInfo = await Helper.checkAmount(reqInfo.currency, reqInfo.amount);

    if (balanceInfo.currentCredit > 0) {
        if (amountInfo.amount > balanceInfo.currentCredit) {
            payForCredit = balanceInfo.currentCredit;
            payForBalance = amountInfo.amount - payForCredit;
        }
        else {
            payForCredit = amountInfo.amount;
        }
    }
    else {
        payForBalance = amountInfo.amount;
    }

    let updateBalanceInfo = {
        currency: amountInfo.currency,
        rate: amountInfo.rate,
        updateInfo: {$inc: {
                "balance.currentBalance": payForBalance,
                "balance.currentCredit": -payForCredit
            }}
    };

    return updateBalanceInfo;
}

/**
 *
 * @param data
 * @returns {Promise<*>}
 */
async function useBalanceByAdmin(data) {
    let getFromCredit = 0;
    let getFromBalance = 0;

    let currentBalance = data.editableUserInfo.balance.currentBalance;
    let currentCredit = data.editableUserInfo.balance.currentCredit;
    let maxCredit = data.editableUserInfo.balance.maxCredit;

    let reqInfo = data.body;

    // get amount by default currency
    let amountInfo = await Helper.checkAmount(reqInfo.currency, reqInfo.amount);

    if (amountInfo.amount > currentBalance) {
        getFromBalance = currentBalance;

        if ((amountInfo.amount - getFromBalance) > (maxCredit - currentCredit)) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "Your request cannot be completed: user balance less than you request!"
            })
        }
        else {
            getFromCredit = amountInfo.amount - getFromBalance;
        }
    }
    else {
        getFromBalance = amountInfo.amount;
    }

    return {
        currency: amountInfo.currency,
        rate: amountInfo.rate,
        updateInfo: {
            $inc: {
                "balance.currentBalance": -getFromBalance,
                "balance.currentCredit": getFromCredit
            }
        }
    };
}

async function getBalanceChanges(userId, start, end) {
    if (!userId || !start || !end) {
        return "Please check imput data and try again"
    }

    let documentInfo = {};
    documentInfo.collectionName = "balanceHistory";
    documentInfo.filterInfo = {
        $and: [
            {userId: userId.toString()},
            {createdAt: {$gte: parseInt(moment(start).format("X"))}},
            {createdAt: {$lt: (parseInt(moment(end).format("X")) + 86400)}}
        ]
    };
    documentInfo.projectionInfo = {
        _id: 0
    };
    documentInfo.optionInfo = {
        sort: {
            createdAt: 1
        }
    };

    return new Promise((resolve, reject) => {
        mongoRequests.findDocuments(documentInfo)
            .then(documents => {
                resolve(documents)
            })
            .catch(err => {
                winston('error', err);
                reject(errorTexts.forEnyCase)
            })
    });
}

module.exports = userHelper;