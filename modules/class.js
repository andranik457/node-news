
/**
 * Modoule Dependencies
 */

const _             = require("underscore");
const winston       = require("winston");
const mongoRequests = require("../dbQueries/mongoRequests");
const Helper        = require("../modules/helper");
const flightHelper  = require("../modules/flightHelper");
const classHelper   = require("../modules/classHelper");
const orderHelper   = require("../modules/orderHelper");
const successTexts  = require("../texts/successTexts");
const errorTexts    = require("../texts/errorTexts");
const ObjectID      = require('mongodb').ObjectID;

const classInfo = {

    /**
     *
     * @param req
     * @returns {Promise<any>}
     */
    create: req => {

        const possibleFields = {
            onlyForAdmin: {
                name: "Only For Admin",
                type: "text",
                minLength: 1,
                maxLength: 32,
                required: true
            },
            className: {
                name: "Class Name",
                type: "text",
                minLength: 1,
                maxLength: 6,
                required: true
            },
            travelType: {
                name: "Travel Type",
                type: "text",
                format: "latin",
                minLength: 3,
                maxLength: 64,
                required: true
            },
            classType: {
                name: "Class Type",
                type: "text",
                format: "latin",
                minLength: 3,
                maxLength: 64,
                required: true
            },
            numberOfSeats: {
                name: "Number Of Seats",
                type: "number",
                minLength: 1,
                maxLength: 4,
                required: true
            },
            fareRules: {
                name: "Fare Rules",
                type: "text",
                minLength: 1,
                maxLength: 2048,
                required: true
            },
            fareAdult: {
                name: "Fare ADULT",
                type: "float",
                minLength: 1,
                maxLength: 5,
                required: true
            },
            fareChd: {
                name: "Fare CHD",
                type: "float",
                minLength: 1,
                maxLength: 5,
                required: true
            },
            fareInf: {
                name: "Fare INF",
                type: "float",
                minLength: 1,
                maxLength: 5,
                required: true
            },
            taxAdult: {
                name: "Tax ADULT",
                type: "float",
                minLength: 1,
                maxLength: 5,
                required: true
            },
            taxChd: {
                name: "Tax CHD",
                type: "float",
                minLength: 1,
                maxLength: 5,
                required: true
            },
            cat: {
                name: "CAT",
                type: "float",
                minLength: 1,
                maxLength: 5,
                required: true
            },
            surchargeMultiDestination: {
                name: "Surcharge MULTIDEST",
                type: "float",
                minLength: 1,
                maxLength: 5,
                required: true
            },
            surchargeLongRange: {
                name: "Surcharge LONG RANGE",
                type: "float",
                minLength: 1,
                maxLength: 5,
                required: true
            },
            surchargeShortRange: {
                name: "Surcharge SHORT RANGE",
                type: "float",
                minLength: 1,
                maxLength: 5,
                required: true
            },
            commAdult: {
                name: "Comm ADULT",
                type: "float",
                minLength: 1,
                maxLength: 5,
                required: true
            },
            commChd: {
                name: "Comm CHD",
                type: "float",
                minLength: 1,
                maxLength: 5,
                required: true
            }
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            editableFields: possibleFields,
            editableFieldsValues: req.body,
            flightId: req.params.flightId.toString(),
        };

        return new Promise((resolve, reject) => {
            if ("Admin" !== data.userInfo.role) {
                reject(errorTexts.userRole);
                return
            }

            if (!ObjectID.isValid(data.flightId)) {
                reject(errorTexts.mongId)
            }

            Helper.validateData(data)
                .then(flightHelper.getFlight)
                .then(flightHelper.getFlightAvailableSeats)
                .then(validateNumberOfSeats)
                .then(checkClassName)
                .then(saveClass)
                .then(data => {
                    resolve({
                        code: 200,
                        status: "success",
                        message: "Class successfully created"
                    })
                })
                .catch(reject)
        });
    },

    /**
     *
     * @param req
     * @returns {Promise<any>}
     */
    edit: async (req) => {

        const possibleFields = {
            onlyForAdmin: {
                name: "Only For Admin",
                type: "text",
                minLength: 1,
                maxLength: 32
            },
            numberOfSeats: {
                name: "Number Of Seats",
                type: "number",
                minLength: 1,
                maxLength: 4
            },
            fareRules: {
                name: "Fare Rules",
                type: "text",
                minLength: 1,
                maxLength: 2048,
            },
            fareAdult: {
                name: "Fare ADULT",
                type: "float",
                minLength: 1,
                maxLength: 5,
            },
            fareChd: {
                name: "Fare CHD",
                type: "float",
                minLength: 1,
                maxLength: 5,
            },
            fareInf: {
                name: "Fare INF",
                type: "float",
                minLength: 1,
                maxLength: 5,
            },
            taxAdult: {
                name: "Tax ADULT",
                type: "float",
                minLength: 1,
                maxLength: 5,
            },
            taxChd: {
                name: "Tax CHD",
                type: "float",
                minLength: 1,
                maxLength: 5,
            },
            cat: {
                name: "CAT",
                type: "float",
                minLength: 1,
                maxLength: 5,
            },
            surchargeMultiDestination: {
                name: "Surcharge MULTIDEST",
                type: "float",
                minLength: 1,
                maxLength: 5,
            },
            surchargeLongRange: {
                name: "Surcharge LONG RANGE",
                type: "float",
                minLength: 1,
                maxLength: 5,
            },
            surchargeShortRange: {
                name: "Surcharge SHORT RANGE",
                type: "float",
                minLength: 1,
                maxLength: 5,
            },
            commAdult: {
                name: "Comm ADULT",
                type: "float",
                minLength: 1,
                maxLength: 5,
            },
            commChd: {
                name: "Comm CHD",
                type: "float",
                minLength: 1,
                maxLength: 5,
            }
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            possibleForm: possibleFields,
            editableFields: possibleFields,
            editableFieldsValues: req.body,
            classId: req.params.classId.toString(),
        };

        // check action maker role
        if ("Admin" !== data.userInfo.role) {
            return Promise.reject(errorTexts.userRole)
        }

        // check is correct mongoId
        if (!ObjectID.isValid(data.classId)) {
            return Promise.reject(errorTexts.mongId);
        }

        // get editable fields
        await Helper.getEditableFields(data);

        // get editable fields values
        await Helper.getEditableFieldsValues(data);

        // validate data
        await Helper.validateData(data);

        // get flight info by id
        data.classInfo = await classHelper.getClassByClassId(data.classId);
        if (null === data.classInfo || undefined !== data.classInfo.deletedAt) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "Class not found or deleted: please check classId and try again"
            })
        }

        // update Class
        await updateClass(data);

        return Promise.resolve(successTexts.classUpdated)
    },

    /**
     *
     * @param req
     * @returns {Promise<any>}
     */
    delete: req => {
        let data = {
            userInfo: req.userInfo,
            classId: req.params.classId.toString(),
        };

        return new Promise((resolve, reject) => {
            if ("Admin" !== data.userInfo.role) {
                reject(errorTexts.userRole)
            }

            if (!ObjectID.isValid(data.classId)) {
                reject(errorTexts.mongId)
            }

            removeClass(data)
                .then(data => {
                    resolve(successTexts.classDeleted)
                })
                .catch(reject)
        })
    },

    /**
     *
     * @param req
     * @returns {Promise<any>}
     */
    getByFlightId: req => {
        let data = {
            userInfo: req.userInfo,
            flightId: req.params.flightId.toString()
        };

        // try to check class status (is not deleted)
        data.classFilter = {
            deletedAt: null
        };

        return new Promise((resolve, reject) => {
            if ("Admin" !== data.userInfo.role) {
                reject(errorTexts.userRole)
            }

            if (!ObjectID.isValid(data.flightId)) {
                reject(errorTexts.mongId)
            }

            getClassesByFlightId(data)
                .then(data => {
                    resolve({
                        code: 200,
                        status: "Success",
                        message: "Flight info successfully goten!",
                        data: data.result
                    })
                })
                .catch(reject)
        })
    },

    /**
     *
     * @param req
     * @returns {Promise<any>}
     */
    getClassByClassId: req => {
        let data = {
            userInfo: req.userInfo,
            classId: req.params.classId.toString()
        };

        return new Promise((resolve, reject) => {
            if (!ObjectID.isValid(data.classId)) {
                reject(errorTexts.mongId)
            }

            getClassesByClassId(data)
                .then(data => {
                    resolve({
                        code: 200,
                        status: "Success",
                        message: "Flight info successfully goten!",
                        data: data.result
                    })
                })
                .catch(reject)
        })
    }
};

module.exports = classInfo;

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function saveClass(data) {
    let currentTime = Math.floor(Date.now() / 1000);

    // check onlyForAdmin case
    let onlyForAdmin = false;
    if ("True" === data.body.onlyForAdmin) {
        onlyForAdmin = true;
    }

    let classInfo = {
        flightId:                   data.flightId,
        onlyForAdmin:               onlyForAdmin,
        className:                  data.body.className,
        classType:                  data.body.classType,
        travelType:                 data.body.travelType,
        currency:                   data.flightInfo.currency,
        numberOfSeats:              parseFloat(data.body.numberOfSeats),
        availableSeats:             parseFloat(data.body.numberOfSeats),
        fareRules:                  data.body.fareRules,
        fareAdult:                  parseFloat(data.body.fareAdult),
        fareChd:                    parseFloat(data.body.fareChd),
        fareInf:                    parseFloat(data.body.fareInf),
        taxAdult:                   parseFloat(data.body.taxAdult),
        taxChd:                     parseFloat(data.body.taxChd),
        cat:                        parseFloat(data.body.cat),
        surchargeMultiDestination:  parseFloat(data.body.surchargeMultiDestination),
        surchargeLongRange:         parseFloat(data.body.surchargeLongRange),
        surchargeShortRange:        parseFloat(data.body.surchargeShortRange),
        commChd:                    parseFloat(data.body.commChd),
        commAdult:                  parseFloat(data.body.commAdult),
        updatedAt:                  currentTime,
        createdAt:                  currentTime
    };

    data.classDocumetInfo = classInfo;

    let documentInfo = {};
    documentInfo.collectionName = "classes";
    documentInfo.documentInfo = classInfo;

    return new Promise((resolve, reject) => {
        mongoRequests.insertDocument(documentInfo)
            .then(insertRes => {
                insertRes.insertedCount === 1
                    ? resolve(data)
                    : reject(errorTexts.cantSaveDocumentToMongo)
            })
    });
}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function validateNumberOfSeats(data) {
    let usedSeats = data.existedClassesInfo.totalSeats;
    let totalSeats = data.flightInfo.numberOfSeats;
    let requestedSeats = Number(data.body.numberOfSeats);

    return new Promise((resolve, reject) => {
        if (totalSeats < (usedSeats + requestedSeats)) {
            let availableSeatsCount = totalSeats - usedSeats;

            reject({
                code: 401,
                status: "error",
                message: "There is no enough space: You can add only "+ availableSeatsCount
            })
        }
        else {
            resolve(data)
        }
    })

}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function checkClassName(data) {
    return new Promise((resolve, reject) => {
        _.each(data.existedClassesInfo.class, existedClass => {
            if (data.body.className === existedClass.name) {
                reject({
                    code: 401,
                    status: "error",
                    message: "Class with this name already exists!"
                })
            }
        });

        resolve(data)
    });
}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
async function updateClass(data) {
    let currentTime = Math.floor(Date.now() / 1000);
    let updateInfo = {};

    if ('{}' === JSON.stringify(data.editableFieldsValues)) {
        return Promise.reject({
            code: 400,
            status: "error",
            message: "Please check editable fields and try again"
        })
    }
    else if (undefined !== data.body.numberOfSeats) {
        // check new seats count is possible
        let seatsResult = await classHelper.checkIsPossibleSeatsCount(data.classId, data.body.numberOfSeats);

        updateInfo.availableSeats = data.body.numberOfSeats - seatsResult.userSeatsInOrders
    }

    for (let i in data.editableFieldsValues) {
        if ("float" === data.possibleForm[i].type) {
            data.editableFieldsValues[i] = parseFloat(data.editableFieldsValues[i])
        }
        else if ("number" === data.possibleForm[i].type) {
            data.editableFieldsValues[i] = parseInt(data.editableFieldsValues[i])
        }
    }

    updateInfo = await Helper.extend(updateInfo, data.editableFieldsValues);
    // let updateInfo = data.editableFieldsValues;
    updateInfo.updatedAt = currentTime;


    // check only for admin case
    if (undefined !== updateInfo.onlyForAdmin) {
        if ("True" === updateInfo.onlyForAdmin) {
            updateInfo.onlyForAdmin = true
        }
        else {
            updateInfo.onlyForAdmin = false
        }
    }

    let documentInfo = {};
    documentInfo.collectionName = "classes";
    documentInfo.filterInfo = {_id: ObjectID(data.classId)};
    documentInfo.updateInfo = {'$set': updateInfo};

    return new Promise((resolve, reject) => {
        mongoRequests.updateDocument(documentInfo)
            .then(updateRes => {
                updateRes.ok === 1
                    ? resolve(data)
                    : reject(errorTexts.cantUpdateMongoDocument)
            })
    });
}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function removeClass(data) {
    let currentTime = Math.floor(Date.now() / 1000);

    let updateInfo = {
        status: "deleted",
        updatedAt: currentTime,
        deletedAt: currentTime
    };

    let documentInfo = {};
    documentInfo.collectionName = "classes";
    documentInfo.filterInfo = {_id: ObjectID(data.classId)};
    documentInfo.updateInfo = {'$set': updateInfo};

    return new Promise((resolve, reject) => {
        mongoRequests.updateDocument(documentInfo)
            .then(updateRes => {
                if (!updateRes.lastErrorObject.updatedExisting) {
                    reject({
                        code: 400,
                        status: "error",
                        message: "Please check classId and try again (class not found)"
                    })
                }
                else if (updateRes.lastErrorObject.n === 0) {
                    reject({
                        code: 400,
                        status: "error",
                        message: "Please check classId and try again (class not found)"
                    })
                }
                else {
                    resolve(data)
                }
            })
    });
}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function getClassesByFlightId(data) {
    let documentInfo = {};
    documentInfo.collectionName = "classes";
    documentInfo.filterInfo = {
        $and: [
            {flightId: data.flightId},
            data.classFilter
        ]};
    documentInfo.projectionInfo = {};

    return new Promise((resolve, reject) => {
        mongoRequests.findDocuments(documentInfo)
            .then(docInfo => {
                data.result = docInfo;

                resolve(data)
            })
            .catch(reject)
    });
}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function getClassesByClassId(data) {
    let documentInfo = {};
    documentInfo.collectionName = "classes";
    documentInfo.filterInfo = {_id: ObjectID(data.classId)};
    documentInfo.projectionInfo = {};

    return new Promise((resolve, reject) => {
        mongoRequests.findDocument(documentInfo)
            .then(docInfo => {
                data.result = docInfo;

                resolve(data)
            })
            .catch(reject)
    });
}

