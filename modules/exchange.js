
/**
 * Modoule Dependencies
 */

const _             = require("underscore");
const winston       = require("winston");
const mongoRequests = require("../dbQueries/mongoRequests");
const Helper        = require("../modules/helper");
const FlightHelper  = require("../modules/flightHelper");
const successTexts  = require("../texts/successTexts");
const errorTexts    = require("../texts/errorTexts");
const ObjectID      = require('mongodb').ObjectID;

const exchange = {

    rateByRange: async (req) => {
        let possibleFields = {
            startDate: {
                name: "Start Date",
                type: "onlyDate",
                minLength: 10,
                maxLength: 10,
                required: true
            },
            endDate: {
                name: "End Date",
                type: "onlyDate",
                minLength: 10,
                maxLength: 10,
                required: true
            }
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            possibleForm: possibleFields,
            editableFields: possibleFields,
            editableFieldsValues: req.body,
        };

        await Helper.validateData(data);

        // try to get data from db
        let documentInfo = {};
        documentInfo.collectionName = "exchangeRate";
        documentInfo.filterInfo = {
            "$and": [
                {"date": {"$gte": data.body.startDate}},
                {"date": {"$lte": data.body.endDate}}
            ]
        };
        documentInfo.optionInfo = {
            sort: {
                "date": 1
            }
        };
        documentInfo.projectionInfo = {
            "_id": 0,
            "date": 1,
            "festaRate": 1
        };

        return new Promise((resolve, reject) => {
            mongoRequests.findDocuments(documentInfo)
                .then(documents => {
                    resolve(documents)
                })
                .catch(err => {
                    winston.log("error", err);
                    reject(errorTexts.forEnyCase)
                })
        });
    },

    addManual: async (req) => {
        let data = {
            userInfo: req.userInfo,
            date: req.params.date.toString(),
        };

        if (data.date === undefined || data.date === '') {
            return {
                code: 556
            }
        }

        let exchangeRateDoc = {
            collectionName: "exchangeRate",
            documentInfo: {
                date: data.date,
                festaRate: {},
                cbRate: {}
            }
        };

        try {
            let exchangeRateResult = await mongoRequests.insertDocument(exchangeRateDoc);

            return "successfully added"
        }
        catch (err) {
            return "cant add to db"
        }
    }

};

module.exports = exchange;