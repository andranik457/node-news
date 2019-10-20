
/**
 * Modoule Dependencies
 */

const _                     = require("underscore");
const mongoRequestsFiles    = require("../dbQueries/mongoRequestsFiles");
const successTexts          = require("../texts/successTexts");
const errorTexts            = require("../texts/errorTexts");
const userHelper            = require("../modules/userHelper");
const orderHelper           = require("../modules/orderHelper");
const Helper                = require("../modules/helper");
const moment                = require("moment");

const reportsInfo = {

    async balanceChanges (req) {
        let possibleFields = {
            start: {
                name: "Start Date",
                type: "onlyDate",
                minLength: 5,
                maxLength: 24,
                required: true
            },
            end: {
                name: "End Date",
                type: "onlyDate",
                minLength: 5,
                maxLength: 24,
                required: true
            }
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            agentId: req.params.agentId.toString(),
            possibleForm: possibleFields,
            editableFields: possibleFields,
            editableFieldsValues: req.body
        };

        // check user role
        if ("Admin" !== data.userInfo.role) {
            return Promise.reject(errorTexts.userRole)
        }

        await Helper.validateData(data);

        // get balance changes
        // get user order actions
        let [balanceChanges, ordersInfo] = await Promise.all([
            userHelper.getBalanceChanges(data.agentId, data.body.start, data.body.end),
            orderHelper.getOrdersByAgentIdCreatedDate(data.agentId, data.body.start, data.body.end)
        ]);

        let fullResult = balanceChanges.concat(ordersInfo);

        fullResult = _.sortBy(fullResult, 'createdAt');

        return {
            code: 200,
            message: "User balance changes info",
            result: fullResult
        }
    },

    async ordersFullData (req) {
        let possibleFields = {
            departureFrom: {
                name: "Departure From",
                type: "text",
                minLength: 1,
                maxLength: 124
            },
            departureTo: {
                name: "Departure To",
                type: "text",
                minLength: 1,
                maxLength: 124
            },
            returnFrom: {
                name: "Return From",
                type: "text",
                minLength: 1,
                maxLength: 124
            },
            returnTo: {
                name: "Return To",
                type: "text",
                minLength: 1,
                maxLength: 124
            },
            departureFromDate: {
                name: "Departure From Date",
                type: "onlyDate",
                minLength: 5,
                maxLength: 24,
            },
            departureToDate: {
                name: "Departure To Date",
                type: "onlyDate",
                minLength: 5,
                maxLength: 24,
            },
            returnFromDate: {
                name: "Return From Date",
                type: "onlyDate",
                minLength: 5,
                maxLength: 24,
            },
            returnToDate: {
                name: "Return To Date",
                type: "onlyDate",
                minLength: 5,
                maxLength: 24,
            },
            pnr: {
                name: "Pnr",
                type: "text",
                minLength: 5,
                maxLength: 24,
            },
            ticketNumber: {
                name: "Ticket Number",
                type: "text",
                minLength: 5,
                maxLength: 24,
            },
            ticketStatus: {
                name: "Ticket Status",
                type: "text",
                minLength: 2,
                maxLength: 64,
            },
            className: {
                name: "Class Name",
                type: "text",
                minLength: 1,
                maxLength: 10,
            },
            passengerName: {
                name: "Passenger Name",
                type: "text",
                minLength: 1,
                maxLength: 124,
            },
            passengerSurname: {
                name: "Passenger Surname",
                type: "text",
                minLength: 1,
                maxLength: 124,
            },
            passengerType: {
                name: "Passenger Type",
                type: "text",
                minLength: 1,
                maxLength: 124,
            },
            saleDateStart: {
                name: "Sale Date Start",
                type: "onlyDate",
                minLength: 1,
                maxLength: 124,
            },
            saleDateEnd: {
                name: "Sale Date End",
                type: "onlyDate",
                minLength: 1,
                maxLength: 124,
            },
            agentId: {
                name: "AgentId",
                type: "text",
                minLength: 1,
                maxLength: 124,
            },
            adminId: {
                name: "AdminId",
                type: "text",
                minLength: 1,
                maxLength: 124,
            }
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            possibleForm: possibleFields,
            editableFields: possibleFields,
            editableFieldsValues: req.body
        };

        // check user role
        if ("Admin" !== data.userInfo.role) {
            return Promise.reject(errorTexts.userRole)
        }

        // validate main info
        await Helper.validateData(data);

        // create filter
        let filter = {
            $and: []
        };

        // check pnr
        if (undefined !== data.body.pnr) {
            filter.$and.push({pnr: data.body.pnr})
        }

        // check sale date Start
        if (undefined !== data.body.saleDateStart) {
            filter.$and.push({createdAt: {$gte: parseInt(moment(data.body.saleDateStart).format("X"))}});
        }

        // check sale date End
        if (undefined !== data.body.saleDateEnd) {
            filter.$and.push({createdAt: {$lt: parseInt(moment(data.body.saleDateEnd).format("X")) + 86400}});
        }

        // check agentId
        if (undefined !== data.body.agentId) {
            filter.$and.push({agentId: data.body.agentId.toString()});
        }

        // check departureFlightInfo from
        if (undefined !== data.body.departureFrom) {
            filter.$and.push({"travelInfo.departureFlightInfo.from": data.body.departureFrom})
        }

        // check departureFlightInfo to
        if (undefined !== data.body.departureTo) {
            filter.$and.push({"travelInfo.departureFlightInfo.to": data.body.departureTo})
        }

        // check returnFlightInfo from
        if (undefined !== data.body.returnFrom) {
            filter.$and.push({"travelInfo.returnFlightInfo.from": data.body.returnFrom})
        }

        // check returnFlightInfo to
        if (undefined !== data.body.returnTo) {
            filter.$and.push({"travelInfo.returnFlightInfo.to": data.body.returnTo})
        }

        // check departure from date
        if (undefined !== data.body.departureFromDate) {
            filter.$and.push({"travelInfo.departureFlightInfo.dateInfo.startDate": data.body.departureFromDate})
        }

        // check departure to date
        if (undefined !== data.body.departureToDate) {
            filter.$and.push({"travelInfo.departureFlightInfo.dateInfo.endDate": data.body.departureToDate})
        }

        // check return form date
        if (undefined !== data.body.returnFromDate) {
            filter.$and.push({"travelInfo.returnFlightInfo.dateInfo.startDate": data.body.returnFromDate})
        }

        // check return to date
        if (undefined !== data.body.returnToDate) {
            filter.$and.push({"travelInfo.returnFlightInfo.dateInfo.endDate": data.body.returnToDate})
        }

        // class name
        if (undefined !== data.body.className) {
            filter.$and.push({
                $or: [
                    {"travelInfo.departureClassInfo.className": data.body.className},
                    {"travelInfo.returnClassInfo.className": data.body.className}
                ]
            })
        }

        // check ticket number
        if (undefined !== data.body.ticketNumber) {
            filter.$and.push({"passengerInfo.ticketNumber": data.body.ticketNumber})
        }

        // check ticket status
        if (undefined !== data.body.ticketStatus) {
            filter.$and.push({"ticketStatus": data.body.ticketStatus})
        }

        // check passenger name
        if (undefined !== data.body.passengerName) {
            filter.$and.push({"passengerInfo.name": data.body.passengerName})
        }

        // check passenger surname
        if (undefined !== data.body.passengerSurname) {
            filter.$and.push({"passengerInfo.surname": data.body.passengerSurname})
        }

        // check passenger type
        if (undefined !== data.body.passengerType) {
            filter.$and.push({"passengerInfo.passengerType": data.body.passengerType})
        }

        if (filter['$and'].length === 0) {
            return Promise.reject({
                code: 400,
                message: "You need to fill at last one field!",
                result: []
            })
        }

        let fullResult = await orderHelper.getOrdersByFilters(filter);

        return {
            code: 200,
            message: "Orders full result depend filter",
            result: fullResult
        }

    }

};

module.exports = reportsInfo;