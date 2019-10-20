
/**
 * Modoule Dependencies
 */

const _             = require("underscore");
const winston       = require("winston");
const ObjectID      = require('mongodb').ObjectID;
const moment        = require("moment");
const mongoRequests = require("../dbQueries/mongoRequests");
const Helper        = require("../modules/helper");
const FlightHelper  = require("../modules/flightHelper");
const classHelper   = require("../modules/classHelper");
const successTexts  = require("../texts/successTexts");
const errorTexts    = require("../texts/errorTexts");
const travelTypes = {
    oneWay: "One Way",
    roundTrip: "Round Trip",
    multiDestination: "Multi Destination"
};

const searchInfo = {

    search: req => {

        // check travel type
        let possibleFields = {};
        if (_.has(req.body, "travelType") && req.body.travelType === travelTypes.oneWay) {
            possibleFields = {
                departureFrom: {
                    name: "Departure From (City & Airport)",
                    type: "text",
                    minLength: 3,
                    maxLength: 64,
                    required: true
                },
                destinationTo: {
                    name: "Destination to (City & Airport)",
                    type: "text",
                    minLength: 3,
                    maxLength: 64,
                    required: true
                },
                departureDate: {
                    name: "Departure Date",
                    type: "onlyDate",
                    minLength: 3,
                    maxLength: 64,
                },
                passengerTypeAdults: {
                    name: "Passenger Type Adults",
                    type: "number",
                    minLength: 1,
                    maxLength: 1,
                },
                passengerTypeChild: {
                    name: "Passenger Type Child",
                    type: "number",
                    minLength: 1,
                    maxLength: 1,
                },
                passengerTypeInfant: {
                    name: "Passenger Type Infant",
                    type: "number",
                    minLength: 1,
                    maxLength: 1,
                },
                airline: {
                    name: "Airline",
                    type: "text",
                    minLength: 1,
                    maxLength: 64,
                }
            };
        }
        else if (_.has(req.body, "travelType") && req.body.travelType === travelTypes.roundTrip) {
            possibleFields = {
                departureFrom: {
                    name: "Departure From (City & Airport)",
                    type: "text",
                    minLength: 3,
                    maxLength: 64,
                    required: true
                },
                destinationTo: {
                    name: "Destination (City & Airport)",
                    type: "text",
                    minLength: 3,
                    maxLength: 64,
                    required: true
                },
                departureDate: {
                    name: "Departure Date",
                    type: "onlyDate",
                    minLength: 3,
                    maxLength: 64,
                },
                returnDate: {
                    name: "Return Date",
                    type: "onlyDate",
                    minLength: 3,
                    maxLength: 64,
                },
                passengerTypeAdults: {
                    name: "Passenger Type Adults",
                    type: "number",
                    minLength: 1,
                    maxLength: 1,
                },
                passengerTypeChild: {
                    name: "Passenger Type Child",
                    type: "number",
                    minLength: 1,
                    maxLength: 1,
                },
                passengerTypeInfant: {
                    name: "Passenger Type Infant",
                    type: "number",
                    minLength: 1,
                    maxLength: 1,
                },
                airline: {
                    name: "Airline",
                    type: "text",
                    minLength: 1,
                    maxLength: 64,
                }
            };
        }
        else if (_.has(req.body, "travelType") && req.body.travelType === travelTypes.multiDestination) {
            possibleFields = {
                departureFrom: {
                    name: "Departure From (City & Airport)",
                    type: "text",
                    minLength: 3,
                    maxLength: 64,
                    required: true
                },
                destinationTo: {
                    name: "Destination (City & Airport)",
                    type: "text",
                    minLength: 3,
                    maxLength: 64,
                    required: true
                },
                departureFrom1: {
                    name: "Departure From 1 (City & Airport)",
                    type: "text",
                    minLength: 3,
                    maxLength: 64,
                },
                destinationTo1: {
                    name: "Destination 1 (City & Airport)",
                    type: "text",
                    minLength: 3,
                    maxLength: 64,
                    required: true
                },
                departureDate: {
                    name: "Departure Date",
                    type: "onlyDate",
                    minLength: 3,
                    maxLength: 64,
                    required: true
                },
                returnDate: {
                    name: "Return Date",
                    type: "onlyDate",
                    minLength: 3,
                    maxLength: 64,
                },
                passengerTypeAdults: {
                    name: "Passenger Type Adults",
                    type: "number",
                    minLength: 1,
                    maxLength: 1,
                },
                passengerTypeChild: {
                    name: "Passenger Type Child",
                    type: "number",
                    minLength: 1,
                    maxLength: 1,
                },
                passengerTypeInfant: {
                    name: "Passenger Type Infant",
                    type: "number",
                    minLength: 1,
                    maxLength: 1,
                },
                airline: {
                    name: "Airline",
                    type: "text",
                    minLength: 1,
                    maxLength: 64,
                }
            };
        }
        else {
            return Promise.resolve({
                code: 400,
                status: "error",
                message: "Please check correct travel type (One Way, Round Trip, Multi Destination)"
            });
        }

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            possibleForm: possibleFields,
            editableFields: possibleFields,
            editableFieldsValues: req.body
        };

        return new Promise((resolve, reject) => {
            return new Promise((resolve, reject) => {
                Helper.getEditableFields(data)
                    .then(Helper.getEditableFieldsValues)
                    .then(Helper.validateData)
                    .then(resolve)
                    .catch(reject)
            })
                .then(mainSearchResult)
                .then(generateResult)
                .then(data => {
                    resolve({
                        code: 200,
                        status: "Success",
                        message: "Search info successfully goten!",
                        data: data
                    })
                })
                .catch(reject)
        });
    }

};

module.exports = searchInfo;


/**
 *
 * @param data
 * @returns {Promise<*>}
 */
async function mainSearchResult(data) {
    // check startDate | endDate
    if (undefined !== data.body.departureDate && undefined !== data.body.returnDate) {
        if (moment(data.body.departureDate).format("X") > moment(data.body.returnDate).format("X")) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "Please check start | end date and try again (start date can't be greater than end date)"
            })
        }
    }

    // get available flights
    let availableFlights = await checkAvailableFlights(data);

    // get departure flights ID's
    let availableDepartureFlightsIds = [];
        if (undefined !== availableFlights[0]) {
        for (let i in availableFlights[0]) {
            availableDepartureFlightsIds.push(availableFlights[0][i]._id.toString())
        }
    }

    // get return flights ID's
    let availableReturnFlightsIds = [];
    if (undefined !== availableFlights[1]) {
        for (let j in availableFlights[1]) {
            availableReturnFlightsIds.push(availableFlights[1][j]._id.toString())
        }
    }


    // get availableClasses for selected Flights
    let departureFlightsClasses = await checkAvailableClasses(data, availableDepartureFlightsIds);
    // get not availableClasses for selected Flights
    let departureFlightsNotPossibleClasses = await checkNotPossibleClasses(data, availableDepartureFlightsIds);


    // return


    // get availableClasses for selected Flights
    let returnFlightsClasses = await checkAvailableClasses(data, availableReturnFlightsIds);
    // get not availableClasses for selected Flights
    let returnFlightsNotPossibleClasses = await checkNotPossibleClasses(data, availableReturnFlightsIds);










    let searchResult = [];
    searchResult['departure'] = [];
    searchResult['return'] = [];

    // append departure classes
    _.each(availableFlights[0], availableFlight => {
        if (_.has(departureFlightsClasses, availableFlight['_id'])) {
            availableFlight['classes'] = departureFlightsClasses[availableFlight['_id']];

            searchResult['departure'].push(availableFlight)
        }

        // console.log(departureFlightsNotPossibleClasses, availableFlight['_id']);
        // // for not possible classes
        // if (_.has(departureFlightsNotPossibleClasses, availableFlight['_id'])) {
        //     availableFlight['notPossibleClasses'] = departureFlightsNotPossibleClasses[availableFlight['_id']];
        //
        //     searchResult['departure'].push(availableFlight)
        // }
    });

    // append return classes
    _.each(availableFlights[1], availableFlight => {
        if (_.has(returnFlightsClasses, availableFlight['_id'])) {
            availableFlight['classes'] = returnFlightsClasses[availableFlight['_id']];

            searchResult['return'].push(availableFlight)
        }

        // // for not possible classes
        // if (_.has(returnFlightsNotPossibleClasses, availableFlight['_id'])) {
        //     availableFlight['notPossibleClasses'] = returnFlightsNotPossibleClasses[availableFlight['_id']];
        //
        //     searchResult['return'].push(availableFlight)
        // }
    });

    data.departureInfo = searchResult.departure;
    data.returnInfo = searchResult.return;

    return data;

}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
async function checkAvailableFlights(data) {
    // try to get available flights | if isset any body data for filter
    if (!_.isEmpty(data.editableFieldsValues)) {
        let filter = {
            "$and": [
                {status: "upcoming"}
            ]
        };

        // check travel type
        let availableFiltersForFlight = [];
        if (_.has(data.body, "travelType") && data.body.travelType === travelTypes.oneWay) {
            availableFiltersForFlight = {
                "departureFrom":    "from",
                "destinationTo":    "to",
                "departureDate":    "dateInfo.startDate"
            };

            _.each(data.editableFieldsValues, (value, key) => {
                if (_.has(availableFiltersForFlight, key)) {
                    filter["$and"].push({
                        [availableFiltersForFlight[key]]: value
                    });
                }
            });

            let oneWayFlightInfo = await Promise.all([
                getFlightsDependFilter(filter)
            ]);

            return Promise.resolve(oneWayFlightInfo)
        }
        else if (_.has(data.body, "travelType") && data.body.travelType === travelTypes.roundTrip) {
            // create departure filter
            let availableFiltersForDepartureFlight = {
                "departureFrom":    "from",
                "destinationTo":    "to",
                "departureDate":    "dateInfo.startDate",
                "airline":          "airline"
            };

            let departureFilter = {
                "$and": [
                    {status: "upcoming"}
                ]
            };

            _.each(data.editableFieldsValues, (value, key) => {
                if (_.has(availableFiltersForDepartureFlight, key)) {
                    departureFilter["$and"].push({
                        [availableFiltersForDepartureFlight[key]]: value
                    });
                }
            });
            // check return date
            if (undefined !== data.body.returnDate) {
                departureFilter["$and"].push({
                    'dateInfo.startDate': {$lt: data.body.returnDate}
                });
            }

            // create return filter
            let availableFiltersForReturnFlight = {
                "departureFrom":    "to",
                "destinationTo":    "from",
                "returnDate":       "dateInfo.startDate",
                "airline":          "airline"
            };

            let returnFilter = {
                "$and": [
                    {status: "upcoming"}
                ]
            };

            _.each(data.editableFieldsValues, (value, key) => {
                if (_.has(availableFiltersForReturnFlight, key)) {
                    returnFilter["$and"].push({
                        [availableFiltersForReturnFlight[key]]: value
                    });
                }
            });
            // check departure date
            if (undefined !== data.body.departureDate) {
                returnFilter["$and"].push({
                    'dateInfo.startDate': {$gt: data.body.departureDate}
                });
            }

            // get departure and return flights info
            let roundTripFlightsInfo = await Promise.all([
                getFlightsDependFilter(departureFilter),
                getFlightsDependFilter(returnFilter)
            ]);

            return Promise.resolve(roundTripFlightsInfo)
        }
        else {
            // create departure filter
            let availableFiltersForDepartureFlight = {
                "departureFrom": "from",
                "destinationTo": "to",
                "departureDate": "dateInfo.startDate",
            };

            let departureFilter = {
                "$and": [
                    {status: "upcoming"}
                ]
            };

            _.each(data.editableFieldsValues, (value, key) => {
                if (_.has(availableFiltersForDepartureFlight, key)) {
                    departureFilter["$and"].push({
                        [availableFiltersForDepartureFlight[key]]: value
                    });
                }
            });

            // create return filter
            let availableFiltersForReturnFlight = {
                "departureFrom1": "from",
                "destinationTo1": "to",
                "returnDate":     "dateInfo.startDate",
            };

            let returnFilter = {
                "$and": [
                    {status: "upcoming"}
                ]
            };

            _.each(data.editableFieldsValues, (value, key) => {
                if (_.has(availableFiltersForReturnFlight, key)) {
                    returnFilter["$and"].push({
                        [availableFiltersForReturnFlight[key]]: value
                    });
                }
            });

            // get departure and return flights info
            let multiDestinationTripFlightsInfo = await Promise.all([
                getFlightsDependFilter(departureFilter),
                getFlightsDependFilter(returnFilter)
            ]);

            return Promise.resolve(multiDestinationTripFlightsInfo)
        }
    }
    else {
        let filter = {
            "$and": [
                {status: "upcoming"}
            ]
        };

        return await getFlightsDependFilter(filter)
    }

}

/**
 *
 * @param filter
 * @returns {Promise<any>}
 */
async function getFlightsDependFilter(filter) {
    let documentInfo = {};
    documentInfo.collectionName = "flights";
    documentInfo.filterInfo = filter;
    documentInfo.optionInfo = {sort: {createdAt: -1}};
    documentInfo.projectionInfo = {};

    return new Promise((resolve, reject) => {
        mongoRequests.findDocuments(documentInfo)
            .then(docInfo => {
                resolve(docInfo)
            })
            .catch(reject)
    });
}

/**
 *
 * @param data
 * @param flightsIds
 * @returns {Promise<any>}
 */
async function checkAvailableClasses(data, flightsIds) {
    let needSeatsCount = 0;
    if (data.body.passengerTypeAdults) {
        needSeatsCount += parseInt(data.body.passengerTypeAdults);
    }
    if (data.body.passengerTypeChild) {
        needSeatsCount += parseInt(data.body.passengerTypeChild);
    }
    // if (data.body.passengerTypeInfant) {
    //     needSeatsCount += parseInt(data.body.passengerTypeInfant);
    // }

    // check user role
    let onlyForAdmin = {$ne: true};
    if ("Admin" === data.userInfo.role) {
        onlyForAdmin = {$exists: true};
    }

    let documentInfo = {};
    documentInfo.collectionName = "classes";
    // check travel type
    if (travelTypes.oneWay === data.body.travelType) {
        documentInfo.filterInfo = {
            $and: [
                {onlyForAdmin: onlyForAdmin},
                {flightId: {$in: flightsIds}},
                {travelType: travelTypes.oneWay},
                {availableSeats: {$gte: needSeatsCount}},
                {deletedAt: null}
            ]
        };
    }
    else {
        documentInfo.filterInfo = {
            $and: [
                {onlyForAdmin: onlyForAdmin},
                {flightId: {$in: flightsIds}},
                {travelType: {$ne: travelTypes.oneWay}},
                {availableSeats: {$gte: needSeatsCount}},
                {deletedAt: null}
            ]
        };
    }
    documentInfo.optionInfo = {};
    documentInfo.projectionInfo = {};

    return new Promise((resolve, reject) => {
        mongoRequests.findDocuments(documentInfo)
            .then(async docInfo => {
                let classesInfo = {};
                for (let i in docInfo) {
                    let classInfo = docInfo[i];

                    // get on hold seats info by classId
                    let classOnHoldSeatsCount = await classHelper.getOnHoldSeatsCountByClassId(classInfo['_id']);

                    if (classInfo.availableSeats - classOnHoldSeatsCount >= needSeatsCount) {
                        classInfo.availableSeats = classInfo.availableSeats - classOnHoldSeatsCount;

                        if (!_.has(classesInfo, classInfo['flightId'])) {
                            classesInfo[classInfo['flightId']] = [];
                        }

                        // calculate class price
                        let classFullInfo = await Helper.asyncGetClassPrice(classInfo, data, classInfo.currency);

                        classesInfo[classFullInfo['flightId']].push(classFullInfo)
                    }
                }

                resolve(classesInfo)
            })
            .catch(reject)
    });
}

/**
 *
 * @param data
 * @param flightsIds
 * @returns {Promise<any>}
 */
async function checkNotPossibleClasses(data, flightsIds) {
    let needSeatsCount = 0;
    if (data.body.passengerTypeAdults) {
        needSeatsCount += parseInt(data.body.passengerTypeAdults);
    }
    if (data.body.passengerTypeChild) {
        needSeatsCount += parseInt(data.body.passengerTypeChild);
    }
    if (data.body.passengerTypeInfant) {
        needSeatsCount += parseInt(data.body.passengerTypeInfant);
    }

    // check user role
    let onlyForAdmin = {$ne: true};
    if ("Admin" === data.userInfo.role) {
        onlyForAdmin = {$exists: true};
    }

    let documentInfo = {};
    documentInfo.collectionName = "classes";
    // check travel type
    if (travelTypes.oneWay === data.body.travelType) {
        documentInfo.filterInfo = {
            $and: [
                {onlyForAdmin: onlyForAdmin},
                {flightId: {$in: flightsIds}},
                {travelType: travelTypes.oneWay},
                {availableSeats: {$lt: needSeatsCount}},
                {deletedAt: null}
            ]
        };
    }
    else {
        documentInfo.filterInfo = {
            $and: [
                {onlyForAdmin: onlyForAdmin},
                {flightId: {$in: flightsIds}},
                {travelType: {$ne: travelTypes.oneWay}},
                {availableSeats: {$lt: needSeatsCount}},
                {deletedAt: null}
            ]
        };
    }
    documentInfo.optionInfo = {};
    documentInfo.projectionInfo = {
        _id: 1,
        flightId: 1,
        availableSeats: 1,
        className: 1,
        classType: 1
    };

    return new Promise((resolve, reject) => {
        mongoRequests.findDocuments(documentInfo)
            .then(async docInfo => {
                let notPossibleClassesInfo = {};
                for (let i in docInfo) {
                    // get on hold seats info by classId
                    let classOnHoldSeatsCount = await classHelper.getOnHoldSeatsCountByClassId(docInfo[i]._id);

                    if (!_.has(notPossibleClassesInfo, docInfo[i].flightId)) {
                        notPossibleClassesInfo[docInfo[i].flightId] = [];
                    }

                    if (docInfo[i].availableSeats - classOnHoldSeatsCount > 0) {
                        docInfo[i].availableSeats = docInfo[i].availableSeats - classOnHoldSeatsCount;

                        delete docInfo[i]['_id'];
                        notPossibleClassesInfo[docInfo[i].flightId].push(docInfo[i])
                    }
                }

                resolve(notPossibleClassesInfo)
            })
            .catch(reject)
    });
}


/**
 *
 * @param data
 * @returns {Array}
 */
function generateResult(data) {
    let result = [];
    if (data.body.travelType === "One Way") {
        result = data.departureInfo;
    }
    else {
        if (data.departureInfo.length != 0 && data.returnInfo.length != 0) {
            result = {
                departureInfo: data.departureInfo,
                returnInfo: data.returnInfo
            };
        }
    }

    return new Promise((resolve, reject) => {
        resolve(result)
    });
}
