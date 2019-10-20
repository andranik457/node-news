
/**
 * Modoule Dependencies
 */

const Busboy                = require("busboy");
const ObjectID              = require('mongodb').ObjectID;
const winston               = require("winston");
const config                = require("../config/config");
const mongoRequests         = require("../dbQueries/mongoRequests");
const mongoRequestsFiles    = require("../dbQueries/mongoRequestsFiles");
const successTexts          = require("../texts/successTexts");
const errorTexts            = require("../texts/errorTexts");
const helperFunc            = require("../modules/helper");
const userHelperFunc        = require("../modules/userHelper");
const resourcesFunc         = require("../modules/resources");


const messagesInfo = {

    /**
     *
     * @param req
     * @returns {Promise<any>}
     */
    async compose (req) {

        let currentDate = Math.floor(Date.now() / 1000);

        let busboy = new Busboy({
            headers: req.headers,
            limits: {
                files: 1,
                fileSize: 2 * 1024 * 1024
            }
        });

        let composeResult = null;
        let fileStoreResult = null;
        let fieldData = {};

        return new Promise((resolve, reject) => {
            busboy.on('file', async (fieldName, file, fileName, encoding, mimeType) => {
                let data = {
                    file: file,
                    filename: fileName,
                    fieldName: fieldName,
                    type: mimeType,
                    fileSize: "2Mb"
                };

                fileStoreResult = await mongoRequestsFiles.storeResource(data);
            });

            busboy.on('field', function (fieldName, fieldValue, truncated, valTruncated, encoding, mimeType) {
                fieldData[fieldName] = fieldValue;
            });

            busboy.on('finish', async () => {
                // create and validate some data
                const possibleFields = {
                    subject: {
                        name: "Subject",
                        type: "text",
                        minLength: 1,
                        maxLength: 264,
                        required: true
                    },
                    text: {
                        name: "Text",
                        type: "text",
                        minLength: 1,
                        maxLength: 2048,
                        required: true
                    },
                    conversationId: {
                        name: "ConversationId",
                        type: "text",
                        minLength: 24,
                        maxLength: 24
                    }
                };

                // check conversationId
                let conversationId = null;
                if (undefined !== fieldData.conversationId) {
                    // check is correct mongoId
                    if (!ObjectID.isValid(fieldData.conversationId)) {
                        return Promise.reject(errorTexts.mongId);
                    }

                    // check is set message
                    let messageDocument = await getMessageById(fieldData.conversationId);
                    if (null === messageDocument) {
                        return Promise.reject({
                            code: 400,
                            status: "error",
                            message: "Please check conversationId and try again (conversationId not found)"
                        });
                    }

                    conversationId = fieldData.conversationId;

                    // unset subject from message
                    delete(possibleFields['subject']);
                    delete(fieldData['subject'])
                }

                let data = {
                    body: fieldData,
                    userInfo: req.userInfo,
                    editableFields: possibleFields,
                    editableFieldsValues: fieldData
                };

                // try to validate data
                let validateError = null;
                await helperFunc.validateData(data)
                    .catch(error => {
                        validateError = true;
                        return reject(error)
                    });
                if (validateError) {
                    return
                }

                let messageInfo = {
                    conversationId: conversationId,
                    status: "Open",
                    creatorId: data.userInfo.userId,
                    subject: data.body.subject,
                    text: data.body.text,
                    createdAt: currentDate
                };

                if (fileStoreResult) {
                    messageInfo.fileUrl = config[process.env.NODE_ENV].httpUrl +'/resource/'+ fileStoreResult;
                }

                composeResult = await composeMessage(messageInfo);

                if (200 === composeResult.code) {
                    return resolve(composeResult)
                }
                else {
                    return reject(composeResult)
                }
            });

            req.pipe(busboy);
        });

    },

    /**
     *
     * @param req
     * @returns {Promise<*>}
     */
    async getMessages (req) {
        let possibleFields = {
            status: {
                name: "Ticket Status",
                type: "text",
                minLength: 3,
                maxLength: 64,
            },
            agentId: {
                name: "AgentId",
                type: "text",
                minLength: 3,
                maxLength: 24,
            },
            subject: {
                name: "Subject",
                type: "text",
                minLength: 5,
                maxLength: 64,
            },
            conversationId: {
                name: "ConversationId",
                type: "text",
                minLength: 24,
                maxLength: 24,
            },
            lastDocumentId: {
                name: "Last DocumentId",
                type: "text",
                minLength: 24,
                maxLength: 24,
            }
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            possibleForm: possibleFields,
            editableFields: possibleFields,
            editableFieldsValues: req.body
        };

        await helperFunc.validateData(data);

        let filter = {
            $and: []
        };

        // check user role
        if ("Admin" !== data.userInfo.role) {
            // filter.$and.push({$or: [{creatorId: data.userInfo.userId}]});

            if (undefined !== data.body.conversationId) {
                if (!ObjectID.isValid(data.body.conversationId)) {
                    return Promise.reject(errorTexts.mongId);
                }

                filter.$and.push({$or: [
                    {creatorId: data.userInfo.userId},
                    {conversationId: data.body.conversationId},
                    {_id: ObjectID(data.body.conversationId)}
                ]});
            }
            else {
                filter.$and.push({creatorId: data.userInfo.userId});
            }
        }
        else {
            // check agentId
            if (undefined !== data.body.agentId) {
                filter.$and.push({agentId: data.body.agentId});
            }
        }

        // check lastDocumentId
        if (undefined !== data.body.lastDocumentId) {
            if (!ObjectID.isValid(data.body.lastDocumentId)) {
                return Promise.reject(errorTexts.mongId);
            }

            filter.$and.push({_id: {$lt: ObjectID(data.body.lastDocumentId)}})
        }

        // check status
        if (undefined !== data.body.status) {
            filter.$and.push({status: data.body.status});
        }

        // check conversationId
        if (undefined !== data.body.conversationId) {
            if (!ObjectID.isValid(data.body.conversationId)) {
                return Promise.reject(errorTexts.mongId);
            }

            filter.$and.push({
                $or: [
                    {conversationId: data.body.conversationId},
                    {_id: ObjectID(data.body.conversationId)}
                ]
            });
        }

        // check subject
        if (undefined !== data.body.subject) {
            filter.$and.push({subject: data.body.subject});
        }

        if (filter.$and.length === 0) {
            filter = {};
        }

        let messages = await getMessages(filter);

        return Promise.resolve({
            code: 200,
            status: "success",
            message: messages
        })
    },

    async editMessage (req) {

        let currentDate = Math.floor(Date.now() / 1000);

        let possibleFields = {
            status: {
                name: "Message Status",
                type: "text",
                minLength: 3,
                maxLength: 64,
            }
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            possibleForm: possibleFields,
            messageId: req.params.messageId.toString()
        };

        // get editable fields
        await helperFunc.getEditableFields(data);

        // get editable fields values
        await helperFunc.getEditableFieldsValues(data);

        // validate data
        await helperFunc.validateData(data);

        // check messageId is correct mongoId
        if (!ObjectID.isValid(data.messageId)) {
            return Promise.reject(errorTexts.mongId);
        }

        // get message by messageId
        let messageInfo = await getMessageById(data.messageId);
        if (null === messageInfo) {
            return Promise.reject(errorTexts.messageNotFound)
        }

        // check user role
        if ("Admin" !== data.userInfo.role && messageInfo.creatorId !== data.userInfo.userId) {
            return Promise.reject(errorTexts.userRole)
        }

        // check status value
        // switch () {
        //
        // }

        data.editableFieldsValues['updatedAt'] = currentDate;
        let asd = await editMessage(data.messageId, data.editableFieldsValues);
        console.log(asd);
    },

    async editConversation (req) {

        let currentDate = Math.floor(Date.now() / 1000);

        let possibleFields = {
            status: {
                name: "Conversation Status",
                type: "text",
                minLength: 3,
                maxLength: 64,
            }
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            possibleForm: possibleFields,
            conversationId: req.params.conversationId.toString()
        };

        // get editable fields
        await helperFunc.getEditableFields(data);

        // get editable fields values
        await helperFunc.getEditableFieldsValues(data);

        // validate data
        await helperFunc.validateData(data);

        // check messageId is correct mongoId
        if (!ObjectID.isValid(data.conversationId)) {
            return Promise.reject(errorTexts.mongId);
        }

        // get message by messageId
        let messageInfo = await getMessageById(data.conversationId);
        if (null === messageInfo) {
            return Promise.reject(errorTexts.messageNotFound)
        }

        // check user role
        if ("Admin" !== data.userInfo.role && messageInfo.creatorId !== data.userInfo.userId) {
            return Promise.reject(errorTexts.userRole)
        }

        // check status value
        // switch () {
        //
        // }

        data.editableFieldsValues['updatedAt'] = currentDate;
        let updateResult = await editConversation(data.conversationId, data.editableFieldsValues);
        return updateResult;
    }

};

module.exports = messagesInfo;

async function composeMessage(messageInfo) {
    let documentInfo = {};
    documentInfo.collectionName = "messages";
    documentInfo.documentInfo = messageInfo;

    return new Promise((resolve, reject) => {
        mongoRequests.insertDocument(documentInfo)
            .then(insertRes => {
                insertRes.insertedCount === 1
                    ? resolve({
                        code: 200,
                        status: "Success",
                        message: "You successfully compose new message",
                        data: messageInfo
                    })
                    : reject(errorTexts.cantSaveDocumentToMongo)
            })
    });
}

async function getMessages(filter) {
    let documentInfo = {};
    documentInfo.collectionName = "messages";
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

async function getMessageById(messageId) {
    let documentInfo = {};
    documentInfo.collectionName = "messages";
    documentInfo.filterInfo = {
        _id: ObjectID(messageId)
    };
    documentInfo.projectionInfo = {};

    return new Promise((resolve, reject) => {
        mongoRequests.findDocument(documentInfo)
            .then(docsInfo => {
                resolve(docsInfo)
            })
            .catch(reject)
    });
}

async function editMessage(messageId, editableFields) {
    let documentInfo = {};
    documentInfo.collectionName = "messages";
    documentInfo.filterInfo = {
        _id: ObjectID(messageId)
    };
    documentInfo.updateInfo = {
        $set: editableFields
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

async function editConversation(conversationId, editableFields) {
    let documentInfo = {};
    documentInfo.collectionName = "messages";
    documentInfo.filterInfo = {
        $or: [
            {_id: ObjectID(conversationId)},
            {conversationId: conversationId}
        ]

    };
    documentInfo.updateInfo = {
        $set: editableFields
    };

    return new Promise((resolve, reject) => {
        mongoRequests.updateDocuments(documentInfo)
            .then(docInfo => {
                resolve({
                    code: 200,
                    status: "success",
                    message: `You successfully updated ${docInfo.modifiedCount} documents`
                })
            })
            .catch(err => {
                winston.log('error', err);
                reject(errorTexts.forEnyCase)
            })
    });
}