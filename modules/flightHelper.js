
/**
 * Modoule Dependencies
 */
const _             = require("underscore");
const mongoRequests = require("../dbQueries/mongoRequests");
const successTexts  = require("../texts/successTexts");
const errorTexts    = require("../texts/errorTexts");
const ObjectID      = require('mongodb').ObjectID;

const flightHelper = {
    getFlight,
    getFlightByFlightId,
    getFlightAvailableSeats,
    getFlightByClassId,
    getFlightAvailableSeatsCountByFlightId
};

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
                if (null === docInfo) {
                    reject(errorTexts.incorrectFlightId)
                }
                else {
                    data.flightInfo = docInfo;
                    resolve(data)
                }
            })
            .catch(reject)
    });
}

async function getFlightByFlightId(flightId) {
    let documentInfo = {};
    documentInfo.collectionName = "flights";
    documentInfo.filterInfo = {_id: ObjectID(flightId)};
    documentInfo.projectionInfo = {};

    return new Promise((resolve, reject) => {
        mongoRequests.findDocument(documentInfo)
            .then(docInfo => {
                if (null === docInfo) {
                    reject(errorTexts.incorrectFlightId)
                }
                else {
                    resolve(docInfo)
                }
            })
            .catch(reject)
    });
}

function getFlightAvailableSeats(data) {
    let documentInfo = {};
    documentInfo.collectionName = "classes";
    documentInfo.filterInfo = {
        flightId: data.flightId,
        deletedAt: null
    };

    return new Promise((resolve, reject) => {
        mongoRequests.findDocuments(documentInfo)
            .then(classesInfo => {
                let classMainInfo = {};
                classMainInfo.class = [];
                classMainInfo.totalSeats = 0;

                _.each(classesInfo, classInfo => {
                    classMainInfo.class.push({
                        name: classInfo.className,
                        seats: classInfo.numberOfSeats
                    });

                    classMainInfo.totalSeats += classInfo.numberOfSeats;
                });

                data.existedClassesInfo = classMainInfo;

                resolve(data)
            })
            .catch(reject)
    });
}

async function getFlightByClassId(classId) {
    let documentInfo = {};
    documentInfo.collectionName = "classes";
    documentInfo.filterInfo = {
        _id: ObjectID(classId)
    };

    return new Promise((resolve, reject) => {
        mongoRequests.findDocument(documentInfo)
            .then(docInfo => {
                if (null !== docInfo) {

                    let documentInfo = {};
                    documentInfo.collectionName = "flights";
                    documentInfo.filterInfo = {
                        _id: ObjectID(docInfo.flightId)
                    };
                    return new Promise((resolve, reject) => {
                        mongoRequests.findDocument(documentInfo)
                            .then(docInfo => {
                                if (null !== docInfo) {
                                    resolve(docInfo)
                                }
                                else {
                                    reject({
                                        code: 400,
                                        status: "error",
                                        message: "Please check flightId and try again"
                                    })
                                }
                            })
                    });

                }
                else {
                    reject({
                        code: 400,
                        status: "error",
                        message: "Please check classId and try again"
                    })
                }
            })
            .then(resolve)
            .catch(reject)
    });
}

async function getFlightAvailableSeatsCountByFlightId(flightId) {
    let documentInfo = {};
    documentInfo.collectionName = "classes";
    documentInfo.filterInfo = {
        flightId: flightId,
        deletedAt: null
    };

    return new Promise((resolve, reject) => {
        mongoRequests.findDocuments(documentInfo)
            .then(classesInfo => {
                let flightUsedPlaces = 0;

                for (let i in classesInfo) {
                    flightUsedPlaces += classesInfo[i].numberOfSeats
                }

                resolve(flightUsedPlaces)
            })
            .catch(reject)
    });
}

module.exports = flightHelper;