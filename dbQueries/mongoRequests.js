
/**
 * Module Dependencies
 */

const MongoClient   = require("mongodb").MongoClient;
const fs            = require('fs');
const mongo         = require("mongodb");
const _             = require("underscore");
const winston       = require("winston");
const config        = require("../config/config");
const errorTexts    = require("../texts/errorTexts");

/**
 * MongoDB db:Festa Connection
 */
let databaseFesta;

const connectCv = () => {
    mongo.MongoClient.connect(config[process.env.NODE_ENV].mongoConf.url, function(err, db) {
        if(err) {
            winston.log("error", "mongo db:"+ config[process.env.NODE_ENV].mongoConf.dbName +" connection closed");

            setTimeout(connectCv, config[process.env.NODE_ENV].mongoConf.options.server.reconnectInterval);

            return winston.log("error", err);
        }

        databaseFesta = db;
        winston.log("info", "mongo db:"+ config[process.env.NODE_ENV].mongoConf.dbName +" connection ready");
        winston.log("info", "----------------x---------------");

        db.on("close", function () {
            winston.log("error", "mongo db:"+ config[process.env.NODE_ENV].mongoConf.dbName +" connection closed");

            databaseFesta = null;
            setTimeout(connectCv, config[process.env.NODE_ENV].mongoConf.options.server.reconnectInterval);
        });
    });
};

connectCv();


/**
 * ---------------------------------------------------------
 */

const mongoQueries = {

    /**
     * Insert personal info
     * @param data
     * @returns {Promise<any>}
     */
    insertDocument: data => {
        return new Promise(((resolve, reject) => {
            databaseFesta.collection(data.collectionName).insertOne(data.documentInfo)
                .then(resolve, reject)
        }))
    },

    /**
     *
     * @param data
     * @returns {Promise<any>}
     */
    findDocument : data => {
        return new Promise((resolve, reject) => {
            databaseFesta.collection(data.collectionName).findOne(data.filterInfo, data.projectionInfo)
                .then(resolve, reject)
        });
    },

    /**
     *
     * @param data
     * @returns {Promise<any>}
     */
    findDocuments : data => {
        return new Promise((resolve, reject) => {
            databaseFesta.collection(data.collectionName).find(data.filterInfo, data.projectionInfo, data.optionInfo).toArray(function(err, result) {
                err ? reject(err) : resolve(result);
            })
        });
    },

    /**
     *
     * @param data
     * @returns {Promise<any>}
     */
    countDocuments : data => {
        return new Promise((resolve, reject) => {
            databaseFesta.collection(data.collectionName).count(data.filterInfo, null, {lean : true})
                .then(resolve, reject)
        });
    },

    /**
     *
     * @param data
     * @returns {Promise<any>}
     */
    updateDocument : data => {
        return new Promise((resolve, reject) => {
            databaseFesta.collection(data.collectionName).findOneAndUpdate(data.filterInfo, data.updateInfo)
                .then(resolve, reject)
        });
    },

    updateDocuments : data => {
        return new Promise((resolve, reject) => {
            databaseFesta.collection(data.collectionName).updateMany(data.filterInfo, data.updateInfo)
                .then(result => {
                    const { matchedCount, modifiedCount } = result;
                    // console.log(`Successfully matched ${matchedCount} and modified ${modifiedCount} items.`)
                    resolve({
                        modifiedCount: modifiedCount
                    })
                })
                .then(reject)
                .catch(reject)
        });
    },

    /**
     *
     * @param data
     * @returns {Promise<any>}
     */
    removeDocument : data => {
        return new Promise((resolve, reject) => {
            databaseFesta.collection(data.collectionName).remove(data.filterInfo)
                .then(resolve, reject)
        });
    },

    /**
     *
     * @param data
     * @returns {Promise<any>}
     */
    bulkWrite : data => {
        return new Promise((resolve, reject) => {
            databaseFesta.collection(data.collectionName).bulkWrite(data.info)
                .then(resolve, reject)
        });
    },

    /**
     *
     * @param data
     * @returns {Promise<any>}
     */
    aggregate : data => {
        return new Promise((resolve, reject) => {
            databaseFesta.collection(data.collectionName).aggregate(data.filter).toArray((err, result) => {
                err ? reject(err) : resolve(result);
            })
        });
    },

    /**
     *
     * @param bearer
     * @param next
     */
    findToken : (bearer, next) => {
        let filter = {tokens: bearer};

        databaseFesta.collection("users").findOne(filter)
            .then(doc => {
                if (_.isEmpty(doc)) {
                    return next(errorTexts.incorrectToken);
                }
                return next(null, doc);
            }, err => next(err));
    },

};

module.exports = mongoQueries;