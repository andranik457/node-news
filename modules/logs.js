
/**
 * Modoule Dependencies
 */

const mongoRequests     = require("../dbQueries/mongoRequests");
const ObjectID          = require('mongodb').ObjectID;
const moment            = require("moment");
const successTexts      = require("../texts/successTexts");
const errorTexts        = require("../texts/errorTexts");
const helperFunc        = require("../modules/helper");
const userHelperFunc    = require("../modules/userHelper");

const logsInfo = {

    async get (req)  {

        const possibleFields = {
            agentId: {
                name: "AgentId",
                type: "text",
                minLength: 1,
                maxLength: 128,
            },
            action: {
                name: "Action",
                type: "text",
                minLength: 1,
                maxLength: 128,
            }
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            editableFields: possibleFields,
            editableFieldsValues: req.body
        };

        // validate main info
        await helperFunc.validateData(data);

        // create filter
        let filter = {
            $and: []
        };

        // check action maker role
        if ("Admin" !== data.userInfo.role) {
            filter.$and.push({userId: data.userInfo.userId})
        }

        // check start date
        if (undefined !== data.body.start) {
            filter.$and.push({createdAt: {$gt: parseInt(moment(data.body.start).format("X"))}})
        }

        // check end date
        if (undefined !== data.body.end) {
            filter.$and.push({createdAt: {$lt: parseInt(moment(data.body.end).format("X"))}})
        }

        // check agentId
        if (undefined !== data.body.agentId) {
            filter.$and.push({userId: data.body.agentId})
        }

        // check action
        if (undefined !== data.body.action) {
            filter.$and.push({action: data.body.action})
        }

        // check lastDocumentId
        if (undefined !== data.body.lastDocumentId) {
            if (!ObjectID.isValid(data.body.lastDocumentId)) {
                return Promise.reject(errorTexts.mongId);
            }

            filter.$and.push({
                _id: {
                    $lt: ObjectID(data.body.lastDocumentId)
                }
            })
        }

        if (filter.$and.length === 0) {
            filter = {};
        }

        let result = await getLogs(filter);

        for (let i in result) {
            result[i].oldData = JSON.parse(result[i].oldData);
            result[i].newData = JSON.parse(result[i].newData)
        }

        return Promise.resolve({
            code: 200,
            status: "success",
            message: result
        })
    }

};

module.exports = logsInfo;

/**
 *
 * @param filter
 * @returns {Promise<any>}
 */
async function getLogs(filter) {
    let documentInfo = {};
    documentInfo.collectionName = "logs";
    documentInfo.filterInfo = filter;
    documentInfo.optionInfo = {
        sort: {
            _id: -1
        },
        limit: 50
    };
    documentInfo.projectionInfo = {};

    return new Promise((resolve, reject) => {
        mongoRequests.findDocuments(documentInfo)
            .then(docsInfo => {
                resolve(docsInfo)
            })
            .catch(reject)
    });
}