
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

const flight = {

    /**
     *
     * @param req
     * @returns {Promise<any>}
     */
    create: req => {
        const editableFields = {
            from: {
                name: "FROM (City & Airport)",
                type: "text",
                minLength: 3,
                maxLength: 128,
                required: true
            },
            to: {
                name: "TO (City & Airport)",
                type: "text",
                minLength: 3,
                maxLength: 128,
                required: true
            },
            startDate: {
                name: "Start Date (Local time)",
                type: "date",
                minLength: 3,
                maxLength: 64,
                required: true
            },
            // startDateTimeZone: {
            //     name: "Start Date TimeZone (Local time)",
            //     type: "timeZone",
            //     minLength: 3,
            //     maxLength: 64,
            //     required: true
            // },
            endDate: {
                name: "End Date (Local time)",
                type: "date",
                minLength: 3,
                maxLength: 64,
                required: true
            },
            // endDateTimeZone: {
            //     name: "End Date TimeZone (Local time)",
            //     type: "timeZone",
            //     minLength: 3,
            //     maxLength: 64,
            //     required: true
            // },
            flightNumber: {
                name: "Flight Number",
                type: "text",
                minLength: 2,
                maxLength: 64,
                required: true
            },
            duration: {
                name: "Duration",
                type: "number",
                minLength: 1,
                maxLength: 64,
                required: true
            },
            airline: {
                name: "Airline",
                type: "text",
                minLength: 2,
                length: 64,
                required: true
            },
            airlineIataIcao: {
                name: "Airline IATA ICAO",
                type: "text",
                minLength: 2,
                length: 64,
                required: true
            },
            numberOfSeats: {
                name: "Number of seats",
                type: "number",
                minLength: 1,
                length: 5,
                required: true
            },
            currency: {
                name: "Currency",
                type: "text",
                minLength: 3,
                length: 3,
                required: true
            }
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            editableFields: editableFields,
            editableFieldsValues: req.body
        };

        return new Promise((resolve, reject) => {
            if ("Admin" !== data.userInfo.role) {
                reject(errorTexts.userRole);
                return
            }

            Helper.validateData(data)
                .then(Helper.calculateFlightDuration)
                .then(saveFlight)
                .then(data => {
                    resolve(successTexts.flightCreated)
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
        const possibleForm = {
            startDate: {
                name: "Start Date (Local time)",
                type: "date",
                minLength: 3,
                maxLength: 64,
            },
            endDate: {
                name: "End Date (Local time)",
                type: "date",
                minLength: 3,
                maxLength: 64,
            },
            flightNumber: {
                name: "Flight Number",
                type: "text",
                minLength: 2,
                maxLength: 64,
            },
            duration: {
                name: "Duration",
                type: "number",
                minLength: 1,
                maxLength: 64,
            },
            airline: {
                name: "Airline",
                type: "text",
                minLength: 2,
                length: 64,
            },
            airlineIataIcao: {
                name: "Airline IATA ICAO",
                type: "text",
                minLength: 2,
                length: 64,
            },
            numberOfSeats: {
                name: "Number of seats",
                type: "number",
                minLength: 1,
                length: 5,
            },
            editAnyway: {
                name: "Edit Anyway",
                type: "text",
                minLength: 2,
                length: 24,
            }
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            flightId: req.params.flightId.toString(),
            possibleForm: possibleForm
        };

        // check action maker role
        if ("Admin" !== data.userInfo.role) {
            return Promise.reject(errorTexts.userRole)
        }

        // check is correct mongoId
        if (!ObjectID.isValid(data.flightId)) {
            return Promise.reject(errorTexts.mongId);
        }

        // get editable fields
        await Helper.getEditableFields(data);

        // get editable fields values
        await Helper.getEditableFieldsValues(data);

        // validate data
        await Helper.validateData(data);

        // get flight info by id
        data.flightInfo = await flightHelper.getFlightByFlightId(data.flightId);

        // update Flight
        let updateFlightInfoResult = await updateFlight(data);

        return Promise.resolve(updateFlightInfoResult)
        // return Promise.resolve(successTexts.flightUpdated)
    },

    /**
     *
     * @param req
     * @returns {Promise<any>}
     */
    delete: req => {
        let data = {
            userInfo: req.userInfo,
            flightId: req.params.flightId.toString(),
        };

        return new Promise((resolve, reject) => {
            if ("Admin" !== data.userInfo.role) {
                reject(errorTexts.userRole)
            }

            if (!ObjectID.isValid(data.flightId)) {
                reject(errorTexts.mongId)
            }

            removeFlight(data)
                .then(data => {
                    resolve(successTexts.flightDeleted)
                })
                .catch(reject)
        })
    },

    /**
     *
     * @param req
     * @returns {Promise<any>}
     */
    getFlights: req => {
        let data = {
            userInfo: req.userInfo,
            body: req.body
        };

        return new Promise((resolve, reject) => {
            if ("Admin" !== data.userInfo.role) {
                reject(errorTexts.userRole)
            }

            getFlights(data)
                .then(data => {
                    resolve({
                        code: 200,
                        status: "Success",
                        message: "Flights info successfully goten!",
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
    getFlight: req => {
        let data = {
            userInfo: req.userInfo,
            flightId: req.params.flightId.toString()
        };

        return new Promise((resolve, reject) => {
            if (!ObjectID.isValid(data.flightId)) {
                reject(errorTexts.mongId)
            }

            getFlight(data)
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

module.exports = flight;

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function saveFlight(data) {
    let currentTime = Math.floor(Date.now() / 1000);

    let flightInfo = {
        from:               data.body.from,
        to:                 data.body.to,
        duration:           data.body.duration,
        dateInfo:           data.body.dateinfo,
        flightNumber:       data.body.flightNumber,
        airline:            data.body.airline,
        airlineIataIcao:    data.body.airlineIataIcao,
        numberOfSeats:      Number(data.body.numberOfSeats),
        currency:           data.body.currency,
        status:             "upcoming",
        updatedAt:          currentTime,
        createdAt:          currentTime
    };

    data.flightDocumetInfo = flightInfo;

    let documentInfo = {};
    documentInfo.collectionName = "flights";
    documentInfo.documentInfo = flightInfo;

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
async function updateFlight(data) {
    let bulkWriteOrders = [];
    let bulkWritePreOrders = [];
    let ordersPossibleEditedData = {};
    let preOrdersPossibleEditedData = {};

    if ('{}' === JSON.stringify(data.editableFieldsValues)) {
        return Promise.reject({
            code: 400,
            status: "error",
            message: "Please check editable fields and try again"
        })
    }

    // check for case: edit number of seats
    if (undefined !== data.editableFieldsValues.numberOfSeats) {
        // check classes number of seats | if new value les than total number of seats in classes return error
        let classesInfo = await classHelper.getClassesByFlightId(data.flightId);
        let placesInClasses = 0;
        for (let i in classesInfo) {
            placesInClasses += classesInfo[i].numberOfSeats;
        }

        //
        if (data.editableFieldsValues.numberOfSeats < placesInClasses) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "Incorrect Number Of Seats: Number of seats can't be les than total number of seats in classes"
            })
        }
    }

    if (undefined !== data.editableFieldsValues.startDate) {
        let startDateInfo = data.editableFieldsValues.startDate.split(" ");

        data.editableFieldsValues["dateInfo.startDate"] = startDateInfo[0];
        data.editableFieldsValues["dateInfo.startTime"] = startDateInfo[1];
        data.editableFieldsValues["dateInfo.startDateTime"] = data.editableFieldsValues.startDate;

        delete data.editableFieldsValues.startDate;
    }
    if (undefined !== data.editableFieldsValues.endDate) {
        let endDateInfo = data.editableFieldsValues.endDate.split(" ");

        data.editableFieldsValues["dateInfo.endDate"] = endDateInfo[0];
        data.editableFieldsValues["dateInfo.endTime"] = endDateInfo[1];
        data.editableFieldsValues["dateInfo.endDateTime"] = data.editableFieldsValues.endDate;

        delete data.editableFieldsValues.endDate;
    }

    // check flight depend orders
    if (undefined !== data.editableFieldsValues.startDate
        || undefined !== data.editableFieldsValues.endDate
        || undefined !== data.editableFieldsValues.flightNumber
        || undefined !== data.editableFieldsValues.airline
        || undefined !== data.editableFieldsValues.duration
        || undefined !== data.editableFieldsValues.airlineIataIcao) {
        // check orders with flightId | get orders with flightId
        let ordersInfo = await orderHelper.getOrdersByFlightId(data.flightId);
        let preOrdersInfo = await orderHelper.getPreOrdersByFlightId(data.flightId);

        // check orders info
        for (let i in ordersInfo) {
            if (data.flightId === ordersInfo[i].travelInfo.departureFlightInfo._id.toString()) {
                ordersPossibleEditedData[ordersInfo[i].pnr] = {
                    passengersCount: ordersInfo[i].travelInfo.passengersCount,
                    contactPersonInfo: ordersInfo[i].contactPersonInfo
                };

                let departureUpdateInfo = await generateOrderEditDataByPnr(ordersInfo[i].pnr, 'departureFlightInfo', data.editableFieldsValues);
                bulkWriteOrders.push(departureUpdateInfo)
            }
            else if (undefined !== ordersInfo[i].travelInfo.returnFlightInfo) {
                if (data.flightId === ordersInfo[i].travelInfo.returnFlightInfo._id.toString()) {
                    ordersPossibleEditedData[ordersInfo[i].pnr] = {
                        passengersCount: ordersInfo[i].travelInfo.passengersCount,
                        contactPersonInfo: ordersInfo[i].contactPersonInfo
                    }
                }

                let returnUpdateInfo = await generateOrderEditDataByPnr(ordersInfo[i].pnr, 'returnFlightInfo', data.editableFieldsValues);
                bulkWriteOrders.push(returnUpdateInfo)
            }
        }

        // check preOrders info
        for (let j in preOrdersInfo) {
            if (data.flightId === preOrdersInfo[j].departureFlightInfo._id.toString()) {
                preOrdersPossibleEditedData[preOrdersInfo[j].pnr] = {
                    passengersCount: preOrdersInfo[j].passengersCount,
                };

                let departureUpdateInfo1 = await generatePreOrderEditDataByPnr(preOrdersInfo[j].pnr, 'departureFlightInfo', data.editableFieldsValues);
                bulkWritePreOrders.push(departureUpdateInfo1)
            }
            else if (undefined !== preOrdersInfo[j].returnFlightInfo) {
                if (data.flightId === preOrdersInfo[j].returnFlightInfo._id.toString()) {
                    preOrdersPossibleEditedData[preOrdersInfo[j].pnr] = {
                        passengersCount: preOrdersInfo[j].passengersCount,
                    };

                    let returnUpdateInfo1 = await generatePreOrderEditDataByPnr(preOrdersInfo[j].pnr, 'returnFlightInfo', data.editableFieldsValues);
                    bulkWritePreOrders.push(returnUpdateInfo1)
                }
            }
        }

        if ('{}' !== ordersPossibleEditedData || '{}' !== preOrdersPossibleEditedData) {
            if (undefined === data.editableFieldsValues.editAnyway || 'yes' !== data.editableFieldsValues.editAnyway) {
                return Promise.reject({
                    code: 400,
                    status: "error",
                    message: "You have some complete or pending orders with this flight: please check them and try again",
                    logs: {
                        orders: ordersPossibleEditedData,
                        preOrders: preOrdersPossibleEditedData
                    }
                })
            }
        }
    }


    let logData = {
        userId:     data.userInfo.userId,
        action:     "Flight Edit",
        oldData:    data.flightInfo,
        newData:    {
            editableFields: data.editableFieldsValues,
            orders: bulkWriteOrders,
            preOrders: bulkWritePreOrders,
        },
    };

    let resultInfo = await Promise.all([
        bulkUpdateOrders(bulkWriteOrders),
        bulkUpdatePreOrders(bulkWritePreOrders),
        updateFlightInfo(data.flightId, data.editableFieldsValues),
        Helper.addToLogs(logData)
    ]);

    return Promise.resolve({
        code: 200,
        status: "success",
        message: "Flights successfully updated!",
        logs: {
            orders: ordersPossibleEditedData,
            preOrders: preOrdersPossibleEditedData
        }
    })

}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function removeFlight(data) {
    let currentTime = Math.floor(Date.now() / 1000);

    let updateInfo = {
        status: "deleted",
        updatedAt: currentTime,
        deletedAt: currentTime
    };

    let documentInfo = {};
    documentInfo.collectionName = "flights";
    documentInfo.filterInfo = {_id: ObjectID(data.flightId)};
    documentInfo.updateInfo = {'$set': updateInfo};

    return new Promise((resolve, reject) => {
        mongoRequests.updateDocument(documentInfo)
            .then(updateRes => {
                updateRes.ok === 1
                    ? resolve(data)
                    : reject(errTexts.cantUpdateMongoDocument)
            })
    });
}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function getFlights(data) {
    let documentInfo = {};
    documentInfo.collectionName = "flights";
    documentInfo.filterInfo = {status: data.body.status || {$exists: true}};
    documentInfo.optionInfo = {sort: {createdAt: -1}};
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
function getFlight(data) {
    let documentInfo = {};
    documentInfo.collectionName = "flights";
    documentInfo.filterInfo = {_id: ObjectID(data.flightId)};
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

/**
 *
 * @param pnr
 * @param flightType
 * @param editableFieldsValues
 * @returns {Promise<{updateOne: {filter: {pnr: *}, update: {$set: {}}}}>}
 */
async function generateOrderEditDataByPnr(pnr, flightType, editableFieldsValues) {
    let updateData = {};

    // start date
    if (undefined !== editableFieldsValues['dateInfo.startDate']) {
        updateData['travelInfo.'+ flightType +'.dateInfo.startDate'] = editableFieldsValues['dateInfo.startDate'];
        updateData['travelInfo.'+ flightType +'.dateInfo.startTime'] = editableFieldsValues['dateInfo.startTime'];
        updateData['travelInfo.'+ flightType +'.dateInfo.startDateTime'] = editableFieldsValues['dateInfo.startDateTime'];
    }

    // end date
    if (undefined !== editableFieldsValues['dateInfo.endDate']) {
        updateData['travelInfo.'+ flightType +'.dateInfo.endDate'] = editableFieldsValues['dateInfo.endDate'];
        updateData['travelInfo.'+ flightType +'.dateInfo.endTime'] = editableFieldsValues['dateInfo.endTime'];
        updateData['travelInfo.'+ flightType +'.dateInfo.endDateTime'] = editableFieldsValues['dateInfo.endDateTime'];
    }

    // flightNumber
    if (undefined !== editableFieldsValues['flightNumber']) {
        updateData['travelInfo.'+ flightType +'.flightNumber'] = editableFieldsValues['flightNumber'];
    }

    // airline
    if (undefined !== editableFieldsValues['airline']) {
        updateData['travelInfo.'+ flightType +'.airline'] = editableFieldsValues['airline'];
    }

    // numberOfSeats
    if (undefined !== editableFieldsValues['numberOfSeats']) {
        updateData['travelInfo.'+ flightType +'.numberOfSeats'] = editableFieldsValues['numberOfSeats'];
    }

    // duration
    if (undefined !== editableFieldsValues['duration']) {
        updateData['travelInfo.'+ flightType +'.duration'] = editableFieldsValues['duration'];
    }

    // airlineIataIcao
    if (undefined !== editableFieldsValues['airlineIataIcao']) {
        updateData['travelInfo.'+ flightType +'.airlineIataIcao'] = editableFieldsValues['airlineIataIcao'];
    }

    return {
        updateOne: {
            filter: {
                pnr: pnr
            },
            update: {
                $set: updateData
            }
        }
    };

}

/**
 *
 * @param pnr
 * @param flightType
 * @param editableFieldsValues
 * @returns {Promise<{updateOne: {filter: {pnr: *}, update: {$set: {}}}}>}
 */
async function generatePreOrderEditDataByPnr(pnr, flightType, editableFieldsValues) {
    let updateData = {};

    // start date
    if (undefined !== editableFieldsValues['dateInfo.startDate']) {
        updateData[flightType +'.dateInfo.startDate'] = editableFieldsValues['dateInfo.startDate'];
        updateData[flightType +'.dateInfo.startTime'] = editableFieldsValues['dateInfo.startTime'];
        updateData[flightType +'.dateInfo.startDateTime'] = editableFieldsValues['dateInfo.startDateTime'];
    }

    // end date
    if (undefined !== editableFieldsValues['dateInfo.endDate']) {
        updateData[flightType +'.dateInfo.endDate'] = editableFieldsValues['dateInfo.endDate'];
        updateData[flightType +'.dateInfo.endTime'] = editableFieldsValues['dateInfo.endTime'];
        updateData[flightType +'.dateInfo.endDateTime'] = editableFieldsValues['dateInfo.endDateTime'];
    }

    // flightNumber
    if (undefined !== editableFieldsValues['flightNumber']) {
        updateData[flightType +'.flightNumber'] = editableFieldsValues['flightNumber'];
    }

    // airline
    if (undefined !== editableFieldsValues['airline']) {
        updateData[flightType +'.airline'] = editableFieldsValues['airline'];
    }

    // numberOfSeats
    if (undefined !== editableFieldsValues['numberOfSeats']) {
        updateData[flightType +'.numberOfSeats'] = editableFieldsValues['numberOfSeats'];
    }

    // duration
    if (undefined !== editableFieldsValues['duration']) {
        updateData[flightType +'.duration'] = editableFieldsValues['duration'];
    }

    // airlineIataIcao
    if (undefined !== editableFieldsValues['airlineIataIcao']) {
        updateData[flightType +'.airlineIataIcao'] = editableFieldsValues['airlineIataIcao'];
    }

    return {
        updateOne: {
            filter: {
                pnr: pnr
            },
            update: {
                $set: updateData
            }
        }
    };
}

async function bulkUpdateOrders(bulkWriteOrders) {
    if (bulkWriteOrders.length === 0) {
        return "success"
    }

    // bulk update all connected orders
    let documentInfo = {};
    documentInfo.collectionName = "orders";
    documentInfo.info = bulkWriteOrders;
    return new Promise((resolve, reject) => {
        mongoRequests.bulkWrite(documentInfo)
            .then(resolve, reject)
    });
}

async function bulkUpdatePreOrders(bulkWritePreOrders) {
    if (bulkWritePreOrders.length === 0) {
        return "success"
    }

    // bulk update all connected preOrders
    let documentInfo = {};
    documentInfo.collectionName = "preOrders";
    documentInfo.info = bulkWritePreOrders;
    return new Promise((resolve, reject) => {
        mongoRequests.bulkWrite(documentInfo)
            .then(resolve, reject)
    });
}

async function updateFlightInfo(flightId, updateInfo) {
    // update flight Info
    let currentTime = Math.floor(Date.now() / 1000);
    updateInfo.updatedAt = currentTime;

    delete updateInfo['editAnyway'];

    let documentInfo = {};
    documentInfo.collectionName = "flights";
    documentInfo.filterInfo = {_id: ObjectID(flightId)};
    documentInfo.updateInfo = {'$set': updateInfo};

    return new Promise((resolve, reject) => {
        mongoRequests.updateDocument(documentInfo)
            .then(updateRes => {
                if (updateRes.lastErrorObject.n > 0) {
                    resolve('success')
                }
                else {
                    reject(errorTexts.incorrectFlightId)
                }
            })
    });
}