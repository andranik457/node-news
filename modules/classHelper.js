
/**
 * Modoule Dependencies
 */
const _             = require("underscore");
const winston       = require("winston");
const mongoRequests = require("../dbQueries/mongoRequests");
const flightHelper  = require("../modules/flightHelper");
const successTexts  = require("../texts/successTexts");
const errorTexts    = require("../texts/errorTexts");
const ObjectID      = require('mongodb').ObjectID;

const classHelper = {
    getClassesByFlightId,
    getClassByClassId,
    asyncRemoveOnHoldPlaces,
    checkIsPossibleSeatsCount,
    getOnHoldSeatsCountByClassId,
    increaseClassSeatsCount,
    decreaseClassSeatsCount
};

/**
 *
 * @param pnr
 * @returns {Promise<any>}
 */
async function asyncRemoveOnHoldPlaces(pnr) {
    let documentInfo = {};
    documentInfo.collectionName = "onHold";
    documentInfo.filterInfo = {pnr: pnr};

    return new Promise((resolve, reject) => {
        mongoRequests.removeDocument(documentInfo)
            .then(docInfo => {
                // if ((1 === docInfo.result.ok) && (0 < docInfo.result.n)){
                    resolve({
                        success: 1
                    })
                // }
                // reject(errorTexts.forEnyCase)
            })
            .catch(err => {
                winston.log('error', err);
                reject(errorTexts.forEnyCase)
            })
    });
}

async function getClassesByFlightId(flightId) {
    let documentInfo = {};
    documentInfo.collectionName = "classes";
    documentInfo.filterInfo = {
        flightId: flightId,
        deletedAt: null
    };
    documentInfo.projectionInfo = {};

    return new Promise((resolve, reject) => {
        mongoRequests.findDocuments(documentInfo)
            .then(documentsInfo => {
                resolve(documentsInfo)
            })
            .catch(reject)
    });
}

async function getClassByClassId(classId) {
    let documentInfo = {};
    documentInfo.collectionName = "classes";
    documentInfo.filterInfo = {
        _id: ObjectID(classId)
    };
    documentInfo.projectionInfo = {};

    return new Promise((resolve, reject) => {
        mongoRequests.findDocument(documentInfo)
            .then(documentsInfo => {
                resolve(documentsInfo)
            })
            .catch(reject)
    });
}

async function getOnHoldDocsByClassId(classId) {
    let documentInfo = {};
    documentInfo.collectionName = "onHold";
    documentInfo.filterInfo = {
        classId: classId
    };
    documentInfo.projectionInfo = {};

    return new Promise((resolve, reject) => {
        mongoRequests.findDocuments(documentInfo)
            .then(documentsInfo => {
                resolve(documentsInfo)
            })
            .catch(reject)
    });
}

async function checkIsPossibleSeatsCount(checkedClassId, newSeatsCount) {
    newSeatsCount = parseInt(newSeatsCount);

    // get flightInfo by classId
    let flightInfo = await flightHelper.getFlightByClassId(checkedClassId);
    if (flightInfo.numberOfSeats < newSeatsCount) {
        return Promise.reject({
            code: 400,
            status: "error",
            message: "Class seats count can't be greater than flight seats"
        })
    }

    // get selected class used seats count
    let checkedClassInfo = await getClassByClassId(checkedClassId);
    let seatsInOrders = checkedClassInfo.numberOfSeats - checkedClassInfo.availableSeats;

    // get onHold seats count for this class
    let onHoldDocs = await getOnHoldDocsByClassId(checkedClassId);
    let onHoldSeats = 0;
    let onHoldPnrList = [];
    for (let i in onHoldDocs) {
        onHoldPnrList.push({
            pnr: onHoldDocs[i].pnr,
            usedSeats: onHoldDocs[i].count
        });

        onHoldSeats += onHoldDocs[i].count;
    }

    if ((onHoldSeats + seatsInOrders) > newSeatsCount) {
        return Promise.reject({
            code: 400,
            status: "error",
            message: "Class seats count can't be less than used seats (in orders: "+ seatsInOrders +" in onHold: "+ onHoldSeats +")",
            logs: {
                onHoldInfo: onHoldPnrList
            }
        })
    }

    // check other classes seats count in this flight | without checked class
    let classesSeats = 0;
    let classes = await getClassesByFlightId(checkedClassInfo.flightId);
    for (let j in classes) {
        if (checkedClassId !== classes[j]._id.toString()) {
            classesSeats += classes[j].numberOfSeats
        }
    }

    if ((classesSeats + newSeatsCount) > flightInfo.numberOfSeats) {
        return Promise.reject({
            code: 400,
            status: "error",
            message: "Classes total seats count can't be greater than flight seats"
        })
    }

    return {
        userSeatsInOrders: seatsInOrders
    }
}

/**
 *
 * @param classId
 * @param seatsCount
 * @param availableSeatsCount
 * @returns {Promise<any>}
 */
async function increaseClassSeatsCount(classId, seatsCount, availableSeatsCount) {
    let documentInfo = {};
    documentInfo.collectionName = "classes";
    documentInfo.filterInfo = {
        "_id": classId
    };
    documentInfo.updateInfo = {
        "$inc": {
            "numberOfSeats": seatsCount,
            "availableSeats": availableSeatsCount
        }
    };

    return new Promise((resolve, reject) => {
        mongoRequests.updateDocument(documentInfo)
            .then(updateRes => {
                if (updateRes.lastErrorObject.n > 0) {
                    resolve({
                        code: 200,
                        status: "success",
                        message: "You successfully updated class seats count"
                    })
                }
                else {
                    reject(errorTexts.classNotFound)
                }
            })
    });
}

/**
 *
 * @param classId
 * @param seatsCount
 * @param availableSeatsCount
 * @returns {Promise<any>}
 */
async function decreaseClassSeatsCount(classId, seatsCount, availableSeatsCount) {
    let documentInfo = {};
    documentInfo.collectionName = "classes";
    documentInfo.filterInfo = {
        "_id": classId
    };
    documentInfo.updateInfo = {
        "$inc": {
            "numberOfSeats": -seatsCount,
            "availableSeats": -availableSeatsCount
        }
    };

    return new Promise((resolve, reject) => {
        mongoRequests.updateDocument(documentInfo)
            .then(updateRes => {
                if (updateRes.lastErrorObject.n > 0) {
                    resolve({
                        code: 200,
                        status: "success",
                        message: "You successfully updated class seats count"
                    })
                }
                else {
                    reject(errorTexts.classNotFound)
                }
            })
    });
}

async function getOnHoldSeatsCountByClassId(classId) {
    let documentInfo = {};
    documentInfo.collectionName = "onHold";
    documentInfo.filterInfo = {
        "classId": classId.toString()
    };

    let onHoldSeatsCount = 0;
    return new Promise((resolve, reject) => {
        mongoRequests.findDocuments(documentInfo)
            .then(documents => {
                for (let i in documents) {
                    onHoldSeatsCount += documents[i].count
                }

                resolve(onHoldSeatsCount)
            })
    });
}

module.exports = classHelper;