
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
const flightFunc    = require("../modules/flight");
const classFunc     = require("../modules/class");
const userFunc      = require("../modules/user");
const userHelper    = require("../modules/userHelper");
const classHelper   = require("../modules/classHelper");
const orderHelper   = require("../modules/orderHelper");
const successTexts  = require("../texts/successTexts");
const errorTexts    = require("../texts/errorTexts");
const uuidv4        = require('uuid/v4');
const travelTypes = {
    oneWay: "One Way",
    roundTrip: "Round Trip",
    multiDestination: "Multi Destination"
};

const orderInfo = {

    /**
     *
     * @param req
     * @returns {Promise<*>}
     */
    async preOrder (req) {

        let possibleFields = await createValidateFormDependTravelType(req.body);
        if (400 === possibleFields.code) {
            return Promise.reject(possibleFields);
        }

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            possibleForm: possibleFields,
            editableFields: possibleFields,
            editableFieldsValues: req.body
        };

        data = await Helper.validateData(data);

        // calculate passengers count | if greater 9 return error
        let passengersCountInfo = await calculatePassengersCount(data);
        if (passengersCountInfo.passengersCount > 9) {
            return Promise.reject(errorTexts.incorrectPassengersCount);
        }
        data.passengersCount = passengersCountInfo.passengersCount;
        data.passengersUsedSeats = passengersCountInfo.usedSeats;

        // check travel type
        if (data.body.travelType === travelTypes.oneWay) {
            data.tripInfo = await oneWayTripData(data);

            // save info and return data
            return await createOneWayPreOrder(data);
        }
        else if ((data.body.travelType === travelTypes.roundTrip) || (data.body.travelType === travelTypes.multiDestination)) {
            data.tripInfo = await twoWayTripData(data);

            if (_.has(data.tripInfo, "code")) {
                return data.tripInfo;
            }

            // create two way pre-order
            return await createTwoWayPreOrder(data);
        }
        else {
            return Promise.reject(errorTexts.incorrectTravelType)
        }

    },

    /**
     *
     * @param req
     * @returns {Promise<{code: number, status: string, message: string}>}
     */
    async cancelPreOrder (req) {
        let data = {
            body: req.body,
            userInfo: req.userInfo,
            pnr: req.params.pnr.toString()
        };

        // remove preOrder | onHold seats
        let ad = await Promise.all([
            removePreOrders(data.pnr),
            removeOnHolSeats(data.pnr)
        ]);

        return Promise.resolve({
            code: 200,
            status: "success",
            message: "You successfully canceled order"
        })
    },

    /**
     *
     * @param req
     * @returns {Promise<*>}
     */
    async order (req) {

        // validate data
        let possibleFields = {
            agentId: {
                name: "AgentId",
                type: "number",
                minLength: 1,
                maxLength: 10,
                required: true
            },
            pnr: {
                name: "PNR",
                type: "text",
                minLength: 5,
                maxLength: 24,
                required: true
            },
            ticketStatus: {
                name: "Ticket Status",
                type: "text",
                minLength: 5,
                maxLength: 24,
                required: true
            },
            comment: {
                name: "Comment",
                type: "text",
                minLength: 0,
                maxLength: 1024,
            },
            contactPersonFullName: {
                name: "Contact Person Full name",
                type: "text",
                minLength: 3,
                maxLength: 128,
                required: true
            },
            contactPersonEmail: {
                name: "Contact Person email",
                type: "email",
                minLength: 3,
                maxLength: 64,
                required: true
            },
            contactPersonTelephone: {
                name: "Contact Person telephone",
                type: "telephone",
                minLength: 3,
                maxLength: 64,
                required: true
            },
            passengersInfo: {
                name: "Passengers Info",
                type: "text",
                minLength: 3,
                maxLength: 2048,
                required: true
            },
            paymentType: {
                name: "Payment type (cash | online)",
                type: "text",
                minLength: 1,
                maxLength: 64,
            }
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            possibleForm: possibleFields,
            editableFields: possibleFields,
            editableFieldsValues: req.body
        };

        data = await Helper.validateData(data);

        // check payment status
        let paymentStatus = null;
        if ("Ticketing" === req.body.ticketStatus) {
            paymentStatus = "Paid";
        }
        else if ("Booking" === req.body.ticketStatus) {
            paymentStatus = "Unpaid";
        }
        else {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "Please check ticket status and tyr again!"
            })
        }

        // check pnr
        let pnrInfo = await Helper.asyncGetPnrInfo(req.body.pnr);

        // check is pnr exists in orders or not
        let pnrExists = await checkPnrInOrders(req.body.pnr);
        if (pnrExists > 0) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "Please check PNR and try again (already in use)"
            })
        }

        // check and validate passenger info
        let passengersInfo = JSON.parse(Buffer.from(req.body.passengersInfo, 'base64').toString('utf8'));

        // check passengers count | orderInfo passengers info
        if (pnrInfo.passengersCount !== passengersInfo.length) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "Please check passengers count: passengers count not equal with preOrder info"
            })
        }

        let passengerInfo = [];
        for (let i in passengersInfo) {
            let ticketNumber = await Helper.getNewTicketNumber();

            let passengerValidateInfo = await createValidateFormDependPassengerType(passengersInfo[i]);

            if (_.has(passengerValidateInfo, "code")) {
                return passengerValidateInfo;
            }
            else {
                possibleFields = passengerValidateInfo;

                let data = {
                    body: passengersInfo[i],
                    userInfo: req.userInfo,
                    possibleForm: possibleFields,
                    editableFields: possibleFields,
                    editableFieldsValues: passengersInfo[i]
                };

                // validate passenger data
                await Helper.validateData(data);

                // check passenger date in departure | return dates
                let passengerAgeInfo = [];
                if (undefined !== pnrInfo.returnFlightInfo) {
                    passengerAgeInfo = await Promise.all([
                        Helper.checkPassengerAge(passengersInfo[i].passengerType, passengersInfo[i].dob, pnrInfo.departureFlightInfo.dateInfo.startDate),
                        Helper.checkPassengerAge(passengersInfo[i].passengerType, passengersInfo[i].dob, pnrInfo.departureFlightInfo.dateInfo.endDate),
                        Helper.checkPassengerAge(passengersInfo[i].passengerType, passengersInfo[i].dob, pnrInfo.returnFlightInfo.dateInfo.startDate),
                        Helper.checkPassengerAge(passengersInfo[i].passengerType, passengersInfo[i].dob, pnrInfo.returnFlightInfo.dateInfo.endDate)
                    ]);
                }
                else {
                    passengerAgeInfo = await Promise.all([
                        Helper.checkPassengerAge(passengersInfo[i].passengerType, passengersInfo[i].dob, pnrInfo.departureFlightInfo.dateInfo.startDate),
                        Helper.checkPassengerAge(passengersInfo[i].passengerType, passengersInfo[i].dob, pnrInfo.departureFlightInfo.dateInfo.endDate),
                    ]);
                }

                for (let l in passengerAgeInfo) {
                    if (!passengerAgeInfo[l]) {
                        return Promise.reject(errorTexts.incorrectAge)
                    }
                }

                passengersInfo[i].id = uuidv4();
                passengersInfo[i].ticketNumber = ticketNumber;
                passengerInfo.push(passengersInfo[i]);
            }
        }

        // check ticket value
        if (!(req.body.ticketStatus === "Booking" || req.body.ticketStatus === "Ticketing")) {
            return errorTexts.incorrectTicketValue
        }

        // check Agent Info
        let agentInfo = await userHelper.asyncGetUserInfoById(req.body.agentId);
        if (null === agentInfo) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "User with this id dos't exists!"
            })
        }
        else if ("approved" !== agentInfo.status) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "You can't make this action. Check user status (only for approved users)"
            })
        }

        ///////////////////////////////////////////////
            // Check is agent is admin
            // Check is exists return

        if ("Admin" === agentInfo.role) {
            for(let i in pnrInfo.departureClassInfo.prices) {
                if (undefined !== pnrInfo.departureClassInfo.prices[i].adultPriceInfo) {
                    pnrInfo.departureClassInfo.prices[i].adultPriceInfo.eachPrice = pnrInfo.departureClassInfo.prices[i].adultPriceInfo.eachPriceForPassenger;
                    pnrInfo.departureClassInfo.prices[i].adultPriceInfo.eachPriceFlightCurrency = pnrInfo.departureClassInfo.prices[i].adultPriceInfo.eachPriceFlightCurrencyForPassenger;
                    //
                    pnrInfo.departureClassInfo.prices[i].adultPriceInfo.totalPrice = pnrInfo.departureClassInfo.prices[i].adultPriceInfo.totalPriceForPassenger;
                    pnrInfo.departureClassInfo.prices[i].adultPriceInfo.totalPriceFlightCurrency = pnrInfo.departureClassInfo.prices[i].adultPriceInfo.totalPriceFlightCurrencyForPassenger;

                    if (undefined !== pnrInfo.returnClassInfo) {
                        pnrInfo.returnClassInfo.prices[i].adultPriceInfo.eachPrice = pnrInfo.returnClassInfo.prices[i].adultPriceInfo.eachPriceForPassenger;
                        pnrInfo.returnClassInfo.prices[i].adultPriceInfo.eachPriceFlightCurrency = pnrInfo.returnClassInfo.prices[i].adultPriceInfo.eachPriceFlightCurrencyForPassenger;
                        //
                        pnrInfo.returnClassInfo.prices[i].adultPriceInfo.totalPrice = pnrInfo.returnClassInfo.prices[i].adultPriceInfo.totalPriceForPassenger;
                        pnrInfo.returnClassInfo.prices[i].adultPriceInfo.totalPriceFlightCurrency = pnrInfo.returnClassInfo.prices[i].adultPriceInfo.totalPriceFlightCurrencyForPassenger;

                    }
                }

                if (undefined !== pnrInfo.departureClassInfo.prices[i].childPriceInfo) {
                    pnrInfo.departureClassInfo.prices[i].childPriceInfo.eachPrice = pnrInfo.departureClassInfo.prices[i].childPriceInfo.eachPriceForPassenger;
                    pnrInfo.departureClassInfo.prices[i].childPriceInfo.eachPriceFlightCurrency = pnrInfo.departureClassInfo.prices[i].childPriceInfo.eachPriceFlightCurrencyForPassenger;
                    //
                    pnrInfo.departureClassInfo.prices[i].childPriceInfo.totalPrice = pnrInfo.departureClassInfo.prices[i].childPriceInfo.totalPriceForPassenger;
                    pnrInfo.departureClassInfo.prices[i].childPriceInfo.totalPriceFlightCurrency = pnrInfo.departureClassInfo.prices[i].childPriceInfo.totalPriceFlightCurrencyForPassenger;

                    if (undefined !== pnrInfo.returnClassInfo) {
                        pnrInfo.returnClassInfo.prices[i].childPriceInfo.eachPrice = pnrInfo.returnClassInfo.prices[i].childPriceInfo.eachPriceForPassenger;
                        pnrInfo.returnClassInfo.prices[i].childPriceInfo.eachPriceFlightCurrency = pnrInfo.returnClassInfo.prices[i].childPriceInfo.eachPriceFlightCurrencyForPassenger;
                        //
                        pnrInfo.returnClassInfo.prices[i].childPriceInfo.totalPrice = pnrInfo.returnClassInfo.prices[i].childPriceInfo.totalPriceForPassenger;
                        pnrInfo.returnClassInfo.prices[i].childPriceInfo.totalPriceFlightCurrency = pnrInfo.returnClassInfo.prices[i].childPriceInfo.totalPriceFlightCurrencyForPassenger;

                    }
                }

                if (undefined !== pnrInfo.departureClassInfo.prices[i].infantPrice) {
                    pnrInfo.departureClassInfo.prices[i].infantPrice.eachPrice = pnrInfo.departureClassInfo.prices[i].infantPrice.eachPriceForPassenger;
                    pnrInfo.departureClassInfo.prices[i].infantPrice.eachPriceFlightCurrency = pnrInfo.departureClassInfo.prices[i].infantPrice.eachPriceFlightCurrencyForPassenger;
                    //
                    pnrInfo.departureClassInfo.prices[i].infantPrice.totalPrice = pnrInfo.departureClassInfo.prices[i].infantPrice.totalPriceForPassenger;
                    pnrInfo.departureClassInfo.prices[i].infantPrice.totalPriceFlightCurrency = pnrInfo.departureClassInfo.prices[i].infantPrice.totalPriceFlightCurrencyForPassenger;

                    if (undefined !== pnrInfo.returnClassInfo) {
                        pnrInfo.returnClassInfo.prices[i].infantPrice.eachPrice = pnrInfo.returnClassInfo.prices[i].infantPrice.eachPriceForPassenger;
                        pnrInfo.returnClassInfo.prices[i].infantPrice.eachPriceFlightCurrency = pnrInfo.returnClassInfo.prices[i].infantPrice.eachPriceFlightCurrencyForPassenger;
                        //
                        pnrInfo.returnClassInfo.prices[i].infantPrice.totalPrice = pnrInfo.returnClassInfo.prices[i].infantPrice.totalPriceForPassenger;
                        pnrInfo.returnClassInfo.prices[i].infantPrice.totalPriceFlightCurrency = pnrInfo.returnClassInfo.prices[i].infantPrice.totalPriceFlightCurrencyForPassenger;

                    }
                }
            }

            // for total price each direction
            pnrInfo.departureClassInfo.pricesTotalInfo.totalPrice = pnrInfo.departureClassInfo.pricesTotalInfo.totalPriceForPassenger;
            pnrInfo.departureClassInfo.pricesTotalInfo.totalPriceFlightCurrency = pnrInfo.departureClassInfo.pricesTotalInfo.totalPriceFlightCurrencyForPassenger;

            if (undefined !== pnrInfo.returnClassInfo) {
                pnrInfo.returnClassInfo.pricesTotalInfo.totalPrice = pnrInfo.returnClassInfo.pricesTotalInfo.totalPriceForPassenger;
                pnrInfo.returnClassInfo.pricesTotalInfo.totalPriceFlightCurrency = pnrInfo.returnClassInfo.pricesTotalInfo.totalPriceFlightCurrencyForPassenger;
            }
        }


        ///////////////////////////////////////////////


        let ticketFullPrice = {};
        if (undefined !== pnrInfo.returnClassInfo) {
            ticketFullPrice.total = pnrInfo.departureClassInfo.pricesTotalInfo.totalPrice + pnrInfo.returnClassInfo.pricesTotalInfo.totalPrice;
            ticketFullPrice.totalForPassenger = pnrInfo.departureClassInfo.pricesTotalInfo.totalPriceForPassenger + pnrInfo.returnClassInfo.pricesTotalInfo.totalPriceForPassenger;
            ticketFullPrice.totalFlightCurrency = pnrInfo.departureClassInfo.pricesTotalInfo.totalPriceFlightCurrency + pnrInfo.returnClassInfo.pricesTotalInfo.totalPriceFlightCurrency;
            ticketFullPrice.totalFlightCurrencyForPassenger = pnrInfo.departureClassInfo.pricesTotalInfo.totalPriceFlightCurrencyForPassenger + pnrInfo.returnClassInfo.pricesTotalInfo.totalPriceFlightCurrencyForPassenger;
            ticketFullPrice.currency = pnrInfo.departureClassInfo.pricesTotalInfo.currency;
            ticketFullPrice.rate = pnrInfo.departureClassInfo.pricesTotalInfo.rate
        }
        else {
            ticketFullPrice.total = pnrInfo.departureClassInfo.pricesTotalInfo.totalPrice;
            ticketFullPrice.totalForPassenger = pnrInfo.departureClassInfo.pricesTotalInfo.totalPriceForPassenger;
            ticketFullPrice.totalFlightCurrency = pnrInfo.departureClassInfo.pricesTotalInfo.totalPriceFlightCurrency;
            ticketFullPrice.totalFlightCurrencyForPassenger = pnrInfo.departureClassInfo.pricesTotalInfo.totalPriceFlightCurrencyForPassenger;
            ticketFullPrice.currency = pnrInfo.departureClassInfo.pricesTotalInfo.currency;
            ticketFullPrice.rate = pnrInfo.departureClassInfo.pricesTotalInfo.rate
        }


        // create final order
        let currentDate = Math.floor(Date.now() / 1000);

        let orderInfo = {
            pnr:                    req.body.pnr,
            agentId:                req.body.agentId,
            agentInfo:              {
                companyName:  agentInfo.companyName || "",
                businessName: agentInfo.businessName || "",
                email:        agentInfo.email || "",
                vat:          agentInfo.vat || "",
                tin:          agentInfo.tin || "",
                ceoName:      agentInfo.ceoName || "",
                phone:        agentInfo.phone || "",
                country:      agentInfo.country || "",
                city:         agentInfo.city || "",
            },
            paymentStatus:          paymentStatus,
            paymentType:            req.body.paymentType || "",
            travelInfo:             pnrInfo,
            ticketStatus:           req.body.ticketStatus,
            ticketPrice:            ticketFullPrice,
            comment:                req.body.comment || "",
            contactPersonInfo:      {
                fullName:  req.body.contactPersonFullName,
                email:     req.body.contactPersonEmail,
                telephone: req.body.contactPersonTelephone,
            },
            passengerInfo:          passengerInfo,
            updatedAt:              currentDate,
            createdAt:              currentDate
        };

        // in case if ticket status is ticketing
        //
        // 1. save order
        // 2. - from userBalance
        // 3. - from onHoldPlayces
        // 4. remove onHold document
        //
        // 5. remove from pre orders

        // for booking can hold in preOrders ???

        let canContinue = true;
        if ("Ticketing" === req.body.ticketStatus) {
            let userBalance = await userHelper.asyncUseUserBalance(req.body.agentId, ticketFullPrice.total);

            if (1 !== userBalance.success) {
                canContinue = false;
            }
        }

        if (canContinue) {
            let order = await saveOrder(orderInfo);

            if (1 === order.success) {
                if (undefined !== pnrInfo.returnClassInfo) {
                    await classHelper.decreaseClassSeatsCount(pnrInfo.returnClassInfo._id, 0, pnrInfo.usedSeats)
                }

                await Promise.all([
                    classHelper.decreaseClassSeatsCount(pnrInfo.departureClassInfo._id, 0, pnrInfo.usedSeats),
                    classHelper.asyncRemoveOnHoldPlaces(pnrInfo.pnr),
                    orderHelper.removePreOrdersByPnr(pnrInfo.pnr)
                ]);

                return Promise.resolve({
                    code: 200,
                    status: "Success",
                    message: "",
                    data: orderInfo
                });
            }
            else {
                return Promise.reject(order);
            }
        }
        else {
            return Promise.reject(userBalance);
        }
    },

    /**
     *
     * @param req
     * @returns {Promise<{code: number, status: string, message: string, data: any}>}
     */
    async getOrders (req) {
        let possibleFields = {
            ticketStatus: {
                name: "Ticket Status",
                type: "text",
                minLength: 5,
                maxLength: 24,
            },
            agentId: {
                name: "AgentId",
                type: "text",
                minLength: 5,
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

        await Helper.validateData(data);

        let orders = await getOrdersInfo(data);

        return Promise.resolve({
            code: 200,
            status: "Success",
            message: "",
            data: orders
        });
    },

    /**
     *
     * @param req
     * @returns {Promise<{code: number, status: string, message: string, data: any}>}
     */
    async getOrderByPnr (req) {
        let data = {
            body: req.body,
            userInfo: req.userInfo,
            pnr: req.params.pnr.toString()
        };

        let orderInfo = await getOrderInfo(data);

        return Promise.resolve({
            code: 200,
            status: "Success",
            message: "",
            data: orderInfo
        });
    },

    /**
     *
     * @param req
     * @returns {Promise<*>}
     */
    async editOrder (req) {
        let currentTime = Math.floor(Date.now() / 1000);

        let possibleFields = {};

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            editableFieldsValues: req.body,
            pnr: req.params.pnr.toString()
        };

        // get order by pnr
        let orderInfo = await getOrderInfo(data);
        if (null === orderInfo) {
            return Promise.reject(errorTexts.pnrNotFound)
        }

        // check order status
        if ("Booking" !== orderInfo.ticketStatus && "Ticketing" !== orderInfo.ticketStatus) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "Incorrect ticket status: need to be Booking | Ticketing"
            })
        }
        else if ("Ticketing" === orderInfo.ticketStatus && "Admin" !== data.userInfo.role) {
            return Promise.reject(errorTexts.userRole)
        }
        else {
            possibleFields = {
                comment: {
                    name: "Comment",
                    type: "text",
                    minLength: 0,
                    maxLength: 1024,
                },
                contactPersonFullName: {
                    name: "Contact Person Full name",
                    type: "text",
                    minLength: 3,
                    maxLength: 128,
                },
                contactPersonEmail: {
                    name: "Contact Person email",
                    type: "email",
                    minLength: 3,
                    maxLength: 64,
                },
                contactPersonTelephone: {
                    name: "Contact Person telephone",
                    type: "telephone",
                    minLength: 3,
                    maxLength: 64,
                },
                passengersInfo: {
                    name: "Passengers Info",
                    type: "text",
                    minLength: 3,
                    maxLength: 4096,
                }
            };
            data.possibleForm = possibleFields;

            // get editable fields
            await Helper.getEditableFields(data);

            // get editable fields values
            await Helper.getEditableFieldsValues(data);

            // validate main info
            await Helper.validateData(data);

            let updateInfo = {};
            updateInfo.updatedAt = currentTime;

            // generate update object
            for (let i in data.editableFieldsValues) {
                if ("contactPersonFullName" === i) {
                    updateInfo['contactPersonInfo.fullName'] = data.editableFieldsValues[i]
                }
                else if ("contactPersonEmail" === i) {
                    updateInfo['contactPersonInfo.email'] = data.editableFieldsValues[i]
                }
                else if ("contactPersonTelephone" === i) {
                    updateInfo['contactPersonInfo.telephone'] = data.editableFieldsValues[i]
                }
                else if ("comment" === i) {
                    updateInfo['comment'] = data.editableFieldsValues[i]
                }
            }

            // check passengers info
            if (undefined !== data.body.passengersInfo) {
                let passengersInfo = JSON.parse(Buffer.from(data.body.passengersInfo, 'base64').toString('utf8'));

                let orderPassengersOldInfo = orderInfo.passengerInfo;
                let passengerInfo = [];
                for (let i in passengersInfo) {
                    if (undefined === passengersInfo[i].id) {
                        return Promise.reject({
                            code: 400,
                            status: "error",
                            message: "Please check passengerId and try again"
                        })
                    }
                    else {
                        let checkedInfo = await checkPassengerIdInExistedPassengersInfo(orderPassengersOldInfo, passengersInfo[i]);
                        orderPassengersOldInfo = checkedInfo.passengersArray;
                        let currentPassengerInfo = checkedInfo.oldData;

                        if (!orderPassengersOldInfo) {
                            return Promise.reject({
                                code: 400,
                                status: "error",
                                message: "Incorrect passengerId and/or passengerType: Please check them and try again"
                            })
                        }
                        else {
                            let passengerValidateInfo = await createValidateFormDependPassengerTypeForEdit(passengersInfo[i]);

                            if (undefined !== passengerValidateInfo.code) {
                                return Promise.reject(passengerValidateInfo)
                            }
                            else {
                                let data = {
                                    body: passengersInfo[i],
                                    userInfo: req.userInfo,
                                    possibleForm: passengerValidateInfo,
                                    editableFields: passengerValidateInfo,
                                    editableFieldsValues: passengersInfo[i]
                                };

                                // validate passenger data
                                await Helper.validateData(data);

                                // check passport number
                                let passportNumberInfo = null;
                                if (passengersInfo[i].passportNumber === "") {
                                    passportNumberInfo = ""
                                }
                                else if (undefined === passengersInfo[i].passportNumber) {
                                    passportNumberInfo = currentPassengerInfo.passportNumber
                                }
                                else {
                                    passportNumberInfo = passengersInfo[i].passportNumber
                                }

                                passengerInfo.push({
                                    id:             currentPassengerInfo.id,
                                    ticketNumber:   currentPassengerInfo.ticketNumber,
                                    dob:            currentPassengerInfo.dob,
                                    passengerType:  currentPassengerInfo.passengerType,
                                    name:           passengersInfo[i].name              || currentPassengerInfo.name,
                                    surname:        passengersInfo[i].surname           || currentPassengerInfo.surname,
                                    gender:         passengersInfo[i].gender            || currentPassengerInfo.gender,
                                    passportNumber: passportNumberInfo
                                });
                            }
                        }

                    }

                }

                // check passengers new data | fill with old data
                updateInfo.passengerInfo = await fillPassengersNewDataWithOldData(orderPassengersOldInfo, passengerInfo);
            }

            // log data
            let logData = {
                userId: data.userInfo.userId,
                action: "Edit Order",
                oldData: orderInfo,
                newData: updateInfo
            };
            await Helper.addToLogs(logData);

            // update order
            let documentInfo = {};
            documentInfo.collectionName = "orders";
            documentInfo.filterInfo = {
                pnr: data.pnr
            };
            documentInfo.updateInfo = {
                '$set': updateInfo
            };

            return new Promise((resolve, reject) => {
                mongoRequests.updateDocument(documentInfo)
                    .then(updateRes => {
                        if (updateRes.lastErrorObject.n > 0) {
                            resolve({
                                code: 200,
                                status: "success",
                                message: "You successfully updated order info"
                            })
                        }
                        else {
                            reject(errorTexts.pnrNotFound)
                        }
                    })
            });

        }
    },

    /**
     *
     * @param req
     * @returns {Promise<*>}
     */
    async cancelOrder (req) {
        let data = {
            body: req.body,
            userInfo: req.userInfo,
            pnr: req.params.pnr.toString()
        };

        // get order by pnr | also check: if user is not a admin and order is not his order return empty data
        let orderInfo = await getOrderInfo(data);
        if (null === orderInfo) {
            return Promise.reject(errorTexts.pnrNotFound)
        }

        // check order status
        if ("Booking" !== orderInfo.ticketStatus) {
            return Promise.reject(errorTexts.bookingStatus)
        }
        else {
            // 1. add to seats for departure class
            // 2. add to seats for return class
            // 3. update order status
            // 4. add info to log (not implemented)

            let logData = {
                userId: data.userInfo.userId,
                action: "Cancel Order",
                oldData: orderInfo,
                newData: "Ticket Status: Canceled"
            };

            let cancelResult = [];
            if (undefined !== orderInfo.travelInfo.returnClassInfo) {
                cancelResult = await Promise.all([
                    makeOrderCanceled(data.pnr),
                    classHelper.increaseClassSeatsCount(orderInfo.travelInfo.departureClassInfo._id, 0, orderInfo.travelInfo.usedSeats),
                    classHelper.increaseClassSeatsCount(orderInfo.travelInfo.returnClassInfo._id, 0, orderInfo.travelInfo.usedSeats),
                    Helper.addToLogs(logData)
                ])
            }
            else {
                cancelResult = await Promise.all([
                    makeOrderCanceled(data.pnr),
                    classHelper.increaseClassSeatsCount(orderInfo.travelInfo.departureClassInfo._id, 0, orderInfo.travelInfo.usedSeats),
                    Helper.addToLogs(logData)
                ])
            }

            await Helper.logTransactionResult(cancelResult)

            if (200 === cancelResult[0].code) {
                return Promise.resolve({
                    code: 200,
                    status: "success",
                    message: "You successfully canceled order"
                })
            }
            else {
                return Promise.reject(errorTexts.forEnyCase)
            }
        }

    },

    /**
     *
     * @param req
     * @returns {Promise<*>}
     */
    async refundOrder (req) {

        let possibleFields = {
            placesDepartureClass: {
                name: "Place Receiver Departure class",
                type: "text",
                minLength: 1,
                maxLength: 32,
                required: true
            },
            placesReturnClass: {
                name: "Place Receiver Departure class",
                type: "text",
                minLength: 1,
                maxLength: 32
            },
            commissionInfo: {
                name: "Commission info",
                type: "text",
                minLength: 1,
                maxLength: 2048,
                required: true
            }
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            pnr: req.params.pnr.toString(),
            possibleForm: possibleFields,
            editableFields: possibleFields,
            editableFieldsValues: req.body,
            routePath: req.route.path || ""
        };

        data = await Helper.validateData(data);

        // check user role
        if ("Admin" !== data.userInfo.role) {
            return Promise.reject(errorTexts.userRole)
        }

        // get order info by :pnr
        let orderInfo = await getOrderInfo(data);
        if (null === orderInfo) {
            return Promise.reject(errorTexts.pnrNotFound)
        }
        else if (!("Ticketing" === orderInfo.ticketStatus)) {
            return Promise.reject(errorTexts.ticketingStatus)
        }


        /////////////////////////////////////////////////////////////////////////////////////////////

        // get departure available classes by flightId
        let availableClassesForDepartureFlight = await classHelper.getClassesByFlightId(orderInfo.travelInfo.departureClassInfo.flightId);

        let departurePlaceReceiverClass = null;
        for(let i in availableClassesForDepartureFlight) {
            if (data.body.placesDepartureClass === availableClassesForDepartureFlight[i]._id.toString()) {
                departurePlaceReceiverClass = availableClassesForDepartureFlight[i]._id;
                break
            }
        }

        if (null === departurePlaceReceiverClass) {
            return Promise.reject(errorTexts.incorrectDepartureClassId)
        }

        // get return available classes by flightId
        let returnPlaceReceiverClass = null;
        if (undefined !== orderInfo.travelInfo.returnFlightInfo) {
            let availableClassesForReturnFlight = await classHelper.getClassesByFlightId(orderInfo.travelInfo.returnClassInfo.flightId);

            for(let i in availableClassesForReturnFlight) {
                if (data.body.placesReturnClass === availableClassesForReturnFlight[i]._id.toString()) {
                    returnPlaceReceiverClass = availableClassesForReturnFlight[i]._id;
                    break
                }
            }

            if (null === returnPlaceReceiverClass) {
                return Promise.reject(errorTexts.incorrectReturnClassId)
            }
        }

        /////////////////////////////////////////////////////////////////////////////////////////////




        //////////////////////////////////////////////////////////////////
        // calculate commission amount
        let passengersInfo = JSON.parse(Buffer.from(req.body.commissionInfo, 'base64').toString('utf8'));

        let totalCommission = 0;
        for (let i in passengersInfo) {
            if (undefined === passengersInfo[i].commission) {
                return Promise.reject({
                    code: 400,
                    status: "error",
                    message: "Commission is required"
                })
            }
            if (undefined === passengersInfo[i].passengerType) {
                return Promise.reject({
                    code: 400,
                    status: "error",
                    message: "Passenger Type is required"
                })
            }

            totalCommission += parseFloat(passengersInfo[i].commission);
        }

        let totalCommissionWithRate = Math.round(parseFloat(totalCommission * orderInfo.ticketPrice.rate) * 100) / 100;

        let agentRefundAmount = orderInfo.ticketPrice.total - totalCommissionWithRate;

        // 1. add commission amount to admin balance
        // 2. add refund amount to agent balance
        // 3. change order status
        // 4. add seats to corresponding classes
        // 5. add to log

        // refund document info
        let refundInfo = {};
        refundInfo.body = {
            currency: "AMD",
            amount: agentRefundAmount,
            paymentType: "Unknown type",
            description: "order refund"
        };
        refundInfo.userInfo = req.userInfo;
        refundInfo.params = {};
        refundInfo.params.userId = orderInfo.agentId;
        refundInfo.routePath = data.routePath;

        // commission document info
        let commissionInfo = {};
        commissionInfo.body = {
            currency: "AMD",
            amount: totalCommissionWithRate,
            paymentType: "Unknown type",
            description: "order refund / commission"
        };
        commissionInfo.userInfo = req.userInfo;
        commissionInfo.params = {};
        commissionInfo.params.userId = req.userInfo.userId;
        commissionInfo.routePath = data.routePath;
        
        // log data
        let logData = {
            userId: data.userInfo.userId,
            action: "Refund Order",
            oldData: orderInfo,
            newData: "Ticket Status: Refund"
        };

        // add refund price to agent balance
        let refundUpdateInfo = await userFunc.increaseBalance(refundInfo);
        if (200 === refundUpdateInfo.code) {
            // add commission to admin balance
            let commissionUpdateInfo = await userFunc.increaseBalance(commissionInfo);
            if (200 === commissionUpdateInfo.code) {
                // cancel order
                let updateOrderInfo = await makeOrderRefunded(orderInfo.pnr);
                if (200 === updateOrderInfo.code) {


                    // add departure seats to corresponding class
                    // let departureClassSeatsInfo = await classHelper.increaseAvailableSeatsCount(orderInfo.travelInfo.departureClassInfo._id, orderInfo.travelInfo.departureClassInfo.pricesTotalInfo.count);
                    // if (200 === departureClassSeatsInfo.code) {
                    //     if (undefined !== orderInfo.travelInfo.returnClassInfo) {
                    //         await classHelper.increaseAvailableSeatsCount(orderInfo.travelInfo.returnClassInfo._id, orderInfo.travelInfo.returnClassInfo.pricesTotalInfo.count)
                    //     }

                        ////////////////////////////// // add departure seats to corresponding class
                        // 1. -seats from current class
                        // 2. +seats to selected class
                        let departureSeatsRestoreInfo = await Promise.all([
                            classHelper.decreaseClassSeatsCount(orderInfo.travelInfo.departureClassInfo._id, orderInfo.travelInfo.usedSeats, 0),
                            classHelper.increaseClassSeatsCount(departurePlaceReceiverClass, orderInfo.travelInfo.usedSeats, orderInfo.travelInfo.usedSeats)
                        ]);

                        ////////////////////////////// // add return seats to corresponding class
                        if (undefined !== orderInfo.travelInfo.returnFlightInfo) {
                            let returnSeatsRestoreInfo = await Promise.all([
                                classHelper.decreaseClassSeatsCount(orderInfo.travelInfo.returnClassInfo._id, orderInfo.travelInfo.usedSeats, 0),
                                classHelper.increaseClassSeatsCount(returnPlaceReceiverClass, orderInfo.travelInfo.usedSeats, orderInfo.travelInfo.usedSeats)
                            ]);
                        }
                        //////////////////////////////



                        let logsResult = await Helper.addToLogs(logData);
                        if ("success" === logsResult) {
                            return Promise.resolve({
                                code: 200,
                                status: "success",
                                message: "You successfully refund order"
                            })
                        }
                        else {
                            return Promise.reject(logsResult)
                        }
                    // }


                }
                else {
                    return Promise.reject(updateOrderInfo)
                }
            }
            else {
                return Promise.reject(commissionUpdateInfo)
            }
        }
        else {
            return Promise.reject(refundUpdateInfo)
        }
    },

    /**
     *
     * @param req
     * @returns {Promise<*>}
     */
    async bookingToTicketing (req) {

        let possibleFields = {
            paymentType: {
                name: "Payment type (cash | online)",
                type: "text",
                minLength: 1,
                maxLength: 32,
                required: true
            },
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            pnr: req.params.pnr.toString(),
            possibleForm: possibleFields,
            editableFields: possibleFields,
            editableFieldsValues: req.body
        };

        await Helper.validateData(data);

        // get order info by :pnr
        let orderInfo = await getOrderInfo(data);
        if (null === orderInfo) {
            return Promise.reject(errorTexts.pnrNotFound)
        }
        else if ("Booking" !== orderInfo.ticketStatus) {
            return Promise.reject(errorTexts.bookingStatus)
        }

        // check user role
        if ("Admin" !== data.userInfo.role && orderInfo.agentId !== data.userInfo.userId) {
            return Promise.reject(errorTexts.userRole)
        }

        // log data
        let logData = {
            userId: data.userInfo.userId,
            action: "Booking to Ticketing",
            oldData: orderInfo,
            newData: "Ticket Status: Ticketing"
        };

        // use agent balance
        let balanceUpdateInfo = await userHelper.asyncUseUserBalance(orderInfo.agentId, orderInfo.ticketPrice.total);
        if (1 === balanceUpdateInfo.success) {

            let bookingToTicketingResult = await Promise.all([
                makeOrderTicketing(data, orderInfo.pnr),
                Helper.addToLogs(logData)
            ]);

            // add to transaction log
            await Helper.logTransactionResult(bookingToTicketingResult)

            if (undefined !== bookingToTicketingResult[0].code && 200 === bookingToTicketingResult[0].code) {
                return Promise.resolve({
                    code: 200,
                    status: "success",
                    message: "You successfully change Booking to Ticketing"
                })
            }
            else {
                return Promise.reject(bookingToTicketingResult[0])
            }
        }
        else {
            return Promise.reject(errorTexts.enoughMoney)
        }
    },

    async split (req) {

        let possibleFields = {
            ticketNumber: {
                name: "Ticket Number",
                type: "text",
                minLength: 12,
                maxLength: 12,
                required: true
            },
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            pnr: req.params.pnr.toString(),
            possibleForm: possibleFields,
            editableFields: possibleFields,
            editableFieldsValues: req.body
        };

        await Helper.validateData(data);

        // get order by pnr
        let pnrInfo = {
            body: data.body,
            userInfo: data.userInfo,
            pnr: data.pnr
        };

        let orderInfo = await getOrderInfo(pnrInfo);

        if (orderInfo === null) {
            return Promise.reject({
                code: 400,
                status: 'error',
                message: 'PNR not found please check and try again!'
            })
        }

        if (orderInfo.ticketStatus !== "Ticketing") {
            return Promise.reject({
                code: 400,
                status: 'error',
                message: 'Order status need to be Ticketing!'
            })
        }

        let splittedPassengerInfo = {};
        let mainPassengerInfo = [];
        for (let i = 0; i < orderInfo.passengerInfo.length; i++) {
            if (orderInfo.passengerInfo[i].ticketNumber === data.body.ticketNumber) {
                splittedPassengerInfo = orderInfo.passengerInfo[i];
            }
            else {
                mainPassengerInfo.push(orderInfo.passengerInfo[i])
            }
        }

        if (!Object.keys(splittedPassengerInfo).length) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "Please check ticket number and try again! (ticket number not found)"
            })
        }

        // define spletted and main orders
        // unset documentId
        delete orderInfo["_id"];
        let splettedOrder = JSON.parse(JSON.stringify(orderInfo));
        let mainOrder = JSON.parse(JSON.stringify(orderInfo));

        // set new users info
        splettedOrder.passengerInfo = [];
        splettedOrder.passengerInfo.push(splittedPassengerInfo);
        mainOrder.passengerInfo = mainPassengerInfo;

        // check passenger type
        if (splittedPassengerInfo.passengerType === "Infant") {
            splettedOrder.travelInfo.passengersCount = 1;
            splettedOrder.travelInfo.usedSeats = 0;
            //
            mainOrder.travelInfo.passengersCount = mainOrder.travelInfo.passengersCount - 1;
        }
        else {
            splettedOrder.travelInfo.passengersCount = 1;
            splettedOrder.travelInfo.usedSeats = 1;
            //
            mainOrder.travelInfo.passengersCount = mainOrder.travelInfo.passengersCount - 1;
            mainOrder.travelInfo.usedSeats = mainOrder.travelInfo.usedSeats - 1;
        }

        // get spletted user ticket price
        for (let i in orderInfo.travelInfo.departureClassInfo.prices) {
            if (splittedPassengerInfo.passengerType === "Adults") {
                if (orderInfo.travelInfo.departureClassInfo.prices[i].adultPriceInfo !== undefined) {
                     [splettedOrder, mainOrder] = await Promise.all([
                        checkPricesForSplitOrder(orderInfo, splettedOrder, i, "departureClassInfo", "adultPriceInfo"),
                        checkPricesForMainOrder(orderInfo, mainOrder, i, "departureClassInfo", "adultPriceInfo")
                     ]);
                }
            }
            else if (splittedPassengerInfo.passengerType === "Child") {
                if (orderInfo.travelInfo.departureClassInfo.prices[i].childPriceInfo !== undefined) {
                    [splettedOrder, mainOrder] = await Promise.all([
                        checkPricesForSplitOrder(orderInfo, splettedOrder, i, "departureClassInfo", "childPriceInfo"),
                        checkPricesForMainOrder(orderInfo, mainOrder, i, "departureClassInfo", "childPriceInfo")
                    ]);
                }
            }
            else if (splittedPassengerInfo.passengerType === "Infant") {
                if (orderInfo.travelInfo.departureClassInfo.prices[i].infantPrice !== undefined) {
                    [splettedOrder, mainOrder] = await Promise.all([
                        checkPricesForSplitOrder(orderInfo, splettedOrder, i, "departureClassInfo", "infantPrice"),
                        checkPricesForMainOrder(orderInfo, mainOrder, i, "departureClassInfo", "infantPrice")
                    ]);
                }
            }

            // for return class
            if (orderInfo.travelInfo.returnClassInfo !== undefined) {
                if (splittedPassengerInfo.passengerType === "Adults") {
                    if (orderInfo.travelInfo.returnClassInfo.prices[i].adultPriceInfo !== undefined) {
                        [splettedOrder, mainOrder] = await Promise.all([
                            checkPricesForSplitOrder(orderInfo, splettedOrder, i, "returnClassInfo", "adultPriceInfo"),
                            checkPricesForMainOrder(orderInfo, mainOrder, i, "returnClassInfo", "adultPriceInfo")
                        ]);
                    }
                }
                else if (splittedPassengerInfo.passengerType === "Child") {
                    if (orderInfo.travelInfo.returnClassInfo.prices[i].childPriceInfo !== undefined) {
                        [splettedOrder, mainOrder] = await Promise.all([
                            checkPricesForSplitOrder(orderInfo, splettedOrder, i, "returnClassInfo", "childPriceInfo"),
                            checkPricesForMainOrder(orderInfo, mainOrder, i, "returnClassInfo", "childPriceInfo")
                        ]);
                    }
                }
                else if (splittedPassengerInfo.passengerType === "Infant") {
                    if (orderInfo.travelInfo.returnClassInfo.prices[i].infantPrice !== undefined) {
                        [splettedOrder, mainOrder] = await Promise.all([
                            checkPricesForSplitOrder(orderInfo, splettedOrder, i, "returnClassInfo", "infantPrice"),
                            checkPricesForMainOrder(orderInfo, mainOrder, i, "returnClassInfo", "infantPrice")
                        ]);
                    }
                }
            }

        }

        // check main order ticket total price
        mainOrder.travelInfo.departureClassInfo.pricesTotalInfo.count = orderInfo.travelInfo.departureClassInfo.pricesTotalInfo.count - splettedOrder.travelInfo.departureClassInfo.pricesTotalInfo.count;
        mainOrder.travelInfo.departureClassInfo.pricesTotalInfo.totalPrice = orderInfo.travelInfo.departureClassInfo.pricesTotalInfo.totalPrice - splettedOrder.travelInfo.departureClassInfo.pricesTotalInfo.totalPrice;
        mainOrder.travelInfo.departureClassInfo.pricesTotalInfo.totalPriceForPassenger = orderInfo.travelInfo.departureClassInfo.pricesTotalInfo.totalPriceForPassenger - splettedOrder.travelInfo.departureClassInfo.pricesTotalInfo.totalPriceForPassenger;
        mainOrder.travelInfo.departureClassInfo.pricesTotalInfo.totalPriceFlightCurrency = orderInfo.travelInfo.departureClassInfo.pricesTotalInfo.totalPriceFlightCurrency - splettedOrder.travelInfo.departureClassInfo.pricesTotalInfo.totalPriceFlightCurrency;
        mainOrder.travelInfo.departureClassInfo.pricesTotalInfo.totalPriceFlightCurrencyForPassenger = orderInfo.travelInfo.departureClassInfo.pricesTotalInfo.totalPriceFlightCurrencyForPassenger - splettedOrder.travelInfo.departureClassInfo.pricesTotalInfo.totalPriceFlightCurrencyForPassenger;
        // check return main total price
        if (orderInfo.travelInfo.returnClassInfo !== undefined) {
            mainOrder.travelInfo.returnClassInfo.pricesTotalInfo.count = orderInfo.travelInfo.returnClassInfo.pricesTotalInfo.count - splettedOrder.travelInfo.returnClassInfo.pricesTotalInfo.count;
            mainOrder.travelInfo.returnClassInfo.pricesTotalInfo.totalPrice = orderInfo.travelInfo.returnClassInfo.pricesTotalInfo.totalPrice - splettedOrder.travelInfo.returnClassInfo.pricesTotalInfo.totalPrice;
            mainOrder.travelInfo.returnClassInfo.pricesTotalInfo.totalPriceForPassenger = orderInfo.travelInfo.returnClassInfo.pricesTotalInfo.totalPriceForPassenger - splettedOrder.travelInfo.returnClassInfo.pricesTotalInfo.totalPriceForPassenger;
            mainOrder.travelInfo.returnClassInfo.pricesTotalInfo.totalPriceFlightCurrency = orderInfo.travelInfo.returnClassInfo.pricesTotalInfo.totalPriceFlightCurrency - splettedOrder.travelInfo.returnClassInfo.pricesTotalInfo.totalPriceFlightCurrency;
            mainOrder.travelInfo.returnClassInfo.pricesTotalInfo.totalPriceFlightCurrencyForPassenger = orderInfo.travelInfo.returnClassInfo.pricesTotalInfo.totalPriceFlightCurrencyForPassenger - splettedOrder.travelInfo.returnClassInfo.pricesTotalInfo.totalPriceFlightCurrencyForPassenger;
        }

        // check ticket total price
        splettedOrder.ticketPrice.total = splettedOrder.travelInfo.departureClassInfo.pricesTotalInfo.totalPrice;
        splettedOrder.ticketPrice.totalForPassenger = splettedOrder.travelInfo.departureClassInfo.pricesTotalInfo.totalPriceForPassenger;
        splettedOrder.ticketPrice.totalFlightCurrency = splettedOrder.travelInfo.departureClassInfo.pricesTotalInfo.totalPriceFlightCurrency;
        splettedOrder.ticketPrice.totalFlightCurrencyForPassenger = splettedOrder.travelInfo.departureClassInfo.pricesTotalInfo.totalPriceFlightCurrencyForPassenger;
        //
        mainOrder.ticketPrice.total = mainOrder.travelInfo.departureClassInfo.pricesTotalInfo.totalPrice;
        mainOrder.ticketPrice.totalForPassenger = mainOrder.travelInfo.departureClassInfo.pricesTotalInfo.totalPriceForPassenger;
        mainOrder.ticketPrice.totalFlightCurrency = mainOrder.travelInfo.departureClassInfo.pricesTotalInfo.totalPriceFlightCurrency;
        mainOrder.ticketPrice.totalFlightCurrencyForPassenger = mainOrder.travelInfo.departureClassInfo.pricesTotalInfo.totalPriceFlightCurrencyForPassenger;

        if (orderInfo.travelInfo.returnClassInfo !== undefined) {
            // check ticket total price
            splettedOrder.ticketPrice.total += splettedOrder.travelInfo.returnClassInfo.pricesTotalInfo.totalPrice;
            splettedOrder.ticketPrice.totalForPassenger += splettedOrder.travelInfo.returnClassInfo.pricesTotalInfo.totalPriceForPassenger;
            splettedOrder.ticketPrice.totalFlightCurrency += splettedOrder.travelInfo.returnClassInfo.pricesTotalInfo.totalPriceFlightCurrency;
            splettedOrder.ticketPrice.totalFlightCurrencyForPassenger += splettedOrder.travelInfo.returnClassInfo.pricesTotalInfo.totalPriceFlightCurrencyForPassenger;
            //
            mainOrder.ticketPrice.total += mainOrder.travelInfo.returnClassInfo.pricesTotalInfo.totalPrice;
            mainOrder.ticketPrice.totalForPassenger += mainOrder.travelInfo.returnClassInfo.pricesTotalInfo.totalPriceForPassenger;
            mainOrder.ticketPrice.totalFlightCurrency += mainOrder.travelInfo.returnClassInfo.pricesTotalInfo.totalPriceFlightCurrency;
            mainOrder.ticketPrice.totalFlightCurrencyForPassenger += mainOrder.travelInfo.returnClassInfo.pricesTotalInfo.totalPriceFlightCurrencyForPassenger;
        }

        // get new pnr's for new orders
        let splettedPnr = await Helper.getNewPnrId();
        let mainPnr = await Helper.getNewPnrId();

        splettedOrder.pnr = splettedPnr;
        splettedOrder.travelInfo.pnr = splettedPnr;
        splettedOrder.parentPnr = orderInfo.pnr;
        //
        mainOrder.pnr = mainPnr;
        mainOrder.travelInfo.pnr = mainPnr;
        mainOrder.parentPnr = orderInfo.pnr;

        // make some string id's object id's
        splettedOrder.travelInfo._id = ObjectID(splettedOrder.travelInfo._id);
        mainOrder.travelInfo._id = ObjectID(mainOrder.travelInfo._id);
        //
        splettedOrder.travelInfo.departureFlightInfo._id = ObjectID(splettedOrder.travelInfo.departureFlightInfo._id);
        mainOrder.travelInfo.departureFlightInfo._id = ObjectID(mainOrder.travelInfo.departureFlightInfo._id);
        //
        splettedOrder.travelInfo.departureClassInfo._id = ObjectID(splettedOrder.travelInfo.departureClassInfo._id);
        mainOrder.travelInfo.departureClassInfo._id = ObjectID(mainOrder.travelInfo.departureClassInfo._id);
        //
        if (orderInfo.travelInfo.returnClassInfo !== undefined) {
            splettedOrder.travelInfo.returnFlightInfo._id = ObjectID(splettedOrder.travelInfo.returnFlightInfo._id);
            mainOrder.travelInfo.returnFlightInfo._id = ObjectID(mainOrder.travelInfo.returnFlightInfo._id);
            //
            splettedOrder.travelInfo.returnClassInfo._id = ObjectID(splettedOrder.travelInfo.returnClassInfo._id);
            mainOrder.travelInfo.returnClassInfo._id = ObjectID(mainOrder.travelInfo.returnClassInfo._id);
        }

        let [oldOrderResult, splettedOrderResult, mainOrderResult] = await Promise.all([
            makeOrderSplitted(orderInfo.pnr, splettedPnr, mainPnr),
            insertChildOrder(splettedOrder),
            insertChildOrder(mainOrder)
        ]);

        // log data
        let logData = {
            userId: data.userInfo.userId,
            action: "Split Order",
            oldData: orderInfo.pnr,
            newData: {
                splitPnr: splettedPnr,
                mainPnr: mainPnr
            }
        };
        Helper.addToLogs(logData);

        return {
            code: 200,
            status: "success",
            message: "You successfully split order",
            data: {
                oldOrderPnr: orderInfo.pnr,
                splettedPnr: splettedPnr,
                mainPnr: mainPnr
            }
        }
    }
};


module.exports = orderInfo;


/**
 *
 * @param body
 * @returns {Promise<*>}
 */
async function createValidateFormDependTravelType(body) {

    if (_.isUndefined(body.travelType)) {
        return errorTexts.incorrectTravelType;
    }
    else if (body.travelType === travelTypes.oneWay) {
        return {
            departureFlightId: {
                name: "Departure FlightId",
                type: "text",
                minLength: 24,
                maxLength: 24,
                required: true
            },
            departureClassId: {
                name: "Departure ClassId",
                type: "text",
                minLength: 24,
                maxLength: 24,
                required: true
            },
            travelType: {
                name: "Travel Type",
                type: "text",
                minLength: 3,
                maxLength: 24,
                required: true
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
            }
        };
    }
    else if (body.travelType === travelTypes.roundTrip) {
        return {
            departureFlightId: {
                name: "Departure FlightId",
                type: "text",
                minLength: 24,
                maxLength: 24,
                required: true
            },
            departureClassId: {
                name: "Departure ClassId",
                type: "text",
                minLength: 24,
                maxLength: 24,
                required: true
            },
            returnFlightId: {
                name: "Destination FlightId",
                type: "text",
                minLength: 24,
                maxLength: 24,
                required: true
            },
            returnClassId: {
                name: "Destination ClassId",
                type: "text",
                minLength: 24,
                maxLength: 24,
                required: true
            },
            travelType: {
                name: "Travel Type",
                type: "text",
                minLength: 3,
                maxLength: 24,
                required: true
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
            }
        };
    }
    else if (body.travelType === travelTypes.multiDestination) {
        return {
            departureFlightId: {
                name: "Departure FlightId",
                type: "text",
                minLength: 24,
                maxLength: 24,
                required: true
            },
            departureClassId: {
                name: "Departure ClassId",
                type: "text",
                minLength: 24,
                maxLength: 24,
                required: true
            },
            returnFlightId: {
                name: "Destination FlightId",
                type: "text",
                minLength: 24,
                maxLength: 24,
                required: true
            },
            returnClassId: {
                name: "Destination ClassId",
                type: "text",
                minLength: 24,
                maxLength: 24,
                required: true
            },
            travelType: {
                name: "Travel Type",
                type: "text",
                minLength: 3,
                maxLength: 24,
                required: true
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
            }
        };
    }
    else {
        return errorTexts.incorrectTravelType;
    }
}

/**
 *
 * @param body
 * @returns {Promise<*>}
 */
async function createValidateFormDependPassengerType(body) {
    if (_.isUndefined(body.passengerType)) {
        return errorTexts.passengerType;
    }
    else if (body.passengerType === "Adults") {
        return {
            name: {
                name: "Name",
                type: "text",
                format: "latin",
                minLength: 3,
                maxLength: 64,
                required: true
            },
            surname: {
                name: "Surname",
                type: "text",
                format: "latin",
                minLength: 3,
                maxLength: 64,
                required: true
            },
            gender: {
                name: "Gender",
                type: "text",
                minLength: 3,
                maxLength: 18,
                required: true
            },
            passportNumber: {
                name: "Passport number",
                type: "text",
                minLength: 3,
                maxLength: 18,
            },
            dob: {
                name: "Date of birth",
                type: "onlyDate",
                minLength: 4,
                maxLength: 24,
            },
        };
    }
    else if ((body.passengerType === "Child") || (body.passengerType === "Infant")) {
        return {
            name: {
                name: "Name",
                type: "text",
                format: "latin",
                minLength: 3,
                maxLength: 64,
                required: true
            },
            surname: {
                name: "Surname",
                type: "text",
                format: "latin",
                minLength: 3,
                maxLength: 64,
                required: true
            },
            gender: {
                name: "Gender",
                type: "text",
                minLength: 3,
                maxLength: 18,
            },
            passportNumber: {
                name: "Passport number",
                type: "text",
                minLength: 3,
                maxLength: 18,
            },
            dob: {
                name: "Date of birth",
                type: "onlyDate",
                minLength: 4,
                maxLength: 24,
                required: true
            },
        };
    }
    else {
        return errorTexts.passengerType;
    }
}

/**
 *
 * @param passengerInfo
 * @returns {Promise<*>}
 */
async function createValidateFormDependPassengerTypeForEdit (passengerInfo) {
    if (undefined === passengerInfo.passengerType) {
        return errorTexts.passengerType
    }
    else if (passengerInfo.passengerType === "Adults") {
        return {
            name: {
                name: "Name",
                type: "text",
                format: "latin",
                minLength: 3,
                maxLength: 64,
            },
            surname: {
                name: "Surname",
                type: "text",
                format: "latin",
                minLength: 3,
                maxLength: 64,
            },
            gender: {
                name: "Gender",
                type: "text",
                minLength: 3,
                maxLength: 18,
            },
            passportNumber: {
                name: "Passport number",
                type: "text",
                minLength: 0,
                maxLength: 18,
            }
        };
    }
    else if ((passengerInfo.passengerType === "Child") || (passengerInfo.passengerType === "Infant")) {
        return {
            name: {
                name: "Name",
                type: "text",
                format: "latin",
                minLength: 3,
                maxLength: 64,
            },
            surname: {
                name: "Surname",
                type: "text",
                format: "latin",
                minLength: 3,
                maxLength: 64,
            },
            gender: {
                name: "Gender",
                type: "text",
                minLength: 3,
                maxLength: 18,
            },
            passportNumber: {
                name: "Passport number",
                type: "text",
                minLength: 0,
                maxLength: 18,
            }
        };
    }
    else {
        return errorTexts.passengerType;
    }
}

/**
 *
 * @param data
 * @returns {Promise<*>}
 */
async function oneWayTripData(data) {
    // get flight info class info | on hold places for this class

    // check is flightId is correct mongoId
    if (!ObjectID.isValid(data.body.departureFlightId)) {
        return Promise.reject(errorTexts.mongId);
    }
    else {
        data.flightId = data.body.departureFlightId;
    }

    // check is classId is correct mongoId
    if (!ObjectID.isValid(data.body.departureClassId)) {
        return Promise.reject(errorTexts.mongId);
    }
    else {
        data.classId = data.body.departureClassId;
    }

    let [
        flightInfo,
        classInfo,
    ] = await Promise.all([
        flightFunc.getFlight({
            userInfo: data.userInfo,
            params: {flightId: data.flightId}
        }),
        classFunc.getClassByClassId({
            userInfo: data.userInfo,
            params: {classId: data.classId}
        })
    ]);

    let classPriceInfo = await Helper.asyncGetClassPrice(classInfo.data, data, flightInfo.data.currency);

    return {
        travelType:             travelTypes.oneWay,
        departureFlightInfo:    flightInfo.data,
        departureClassInfo:     classPriceInfo
    };
}

/**
 *
 * @param data
 * @returns {Promise<*>}
 */
async function twoWayTripData(data) {
    if (
        !ObjectID.isValid(data.body.departureFlightId) ||
        !ObjectID.isValid(data.body.departureClassId) ||
        !ObjectID.isValid(data.body.returnFlightId) ||
        !ObjectID.isValid(data.body.returnClassId)
    ) {
        return errorTexts.mongId;
    }

    let [
        departureFlightInfo,
        departureClassInfo,
        returnFlightInfo,
        returnClassInfo
    ] = await Promise.all([
        flightFunc.getFlight({
            userInfo: data.userInfo,
            params: {flightId: data.body.departureFlightId}
        }),
        classFunc.getClassByClassId({
            userInfo: data.userInfo,
            params: {classId: data.body.departureClassId}
        }),
        flightFunc.getFlight({
            userInfo: data.userInfo,
            params: {flightId: data.body.returnFlightId}
        }),
        classFunc.getClassByClassId({
            userInfo: data.userInfo,
            params: {classId: data.body.returnClassId}
        })
    ]);

    let departureClassPriceInfo = await Helper.asyncGetClassPrice(departureClassInfo.data, data, departureFlightInfo.data.currency);
    let returnClassPriceInfo = await Helper.asyncGetClassPrice(returnClassInfo.data, data, returnFlightInfo.data.currency);

    if (departureFlightInfo.data.airline !== returnFlightInfo.data.airline) {
        return Promise.reject(errorTexts.differentAirlines)
    }
    else {
        return {
            travelType:             data.body.travelType,
            departureFlightInfo:    departureFlightInfo.data,
            departureClassInfo:     departureClassPriceInfo,
            returnFlightInfo:       returnFlightInfo.data,
            returnClassInfo:        returnClassPriceInfo
        };
    }

}


/**
 *
 * @param data
 * @returns {Promise<number>}
 */
async function calculatePassengersCount(data) {
    let passengersCount = 0;
    let usedSeats = 0;

    if (data.body.passengerTypeAdults) {
        passengersCount += parseInt(data.body.passengerTypeAdults);
        usedSeats += parseInt(data.body.passengerTypeAdults);
    }
    if (data.body.passengerTypeChild) {
        passengersCount += parseInt(data.body.passengerTypeChild);
        usedSeats += parseInt(data.body.passengerTypeChild);
    }
    if (data.body.passengerTypeInfant) {
        passengersCount += parseInt(data.body.passengerTypeInfant);
    }

    return Promise.resolve({
        passengersCount: passengersCount,
        usedSeats: usedSeats
    });
}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
async function createOneWayPreOrder(data) {
    if (data.tripInfo.departureFlightInfo == null || data.tripInfo.departureClassInfo == null) {
        return Promise.reject({
            code: 400,
            status: "error",
            message: "Incorrect Flight and/or Class Id"
        });
    }
    else {
        let onHolPlaces = await getOnHoldPlaceCountForClass(data.tripInfo.departureClassInfo._id);

        if ((data.tripInfo.departureClassInfo.availableSeats - onHolPlaces.count) < data.passengersUsedSeats) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "In this class no enough place"
            });
        }

        let pnr = await Helper.getNewPnrId();

        // add data to on hold
        await addPlacesToOnHold(pnr, data.tripInfo.departureClassInfo, data.passengersUsedSeats);

        let currentTime = Math.floor(Date.now() / 1000);

        let preOrderInfo = {
            pnr:                    pnr,
            travelType:             data.tripInfo.travelType,
            passengersCount:        data.passengersCount,
            usedSeats:              data.passengersUsedSeats,
            departureFlightInfo:    data.tripInfo.departureFlightInfo,
            departureClassInfo:     data.tripInfo.departureClassInfo,
            updatedAt:              currentTime,
            createdAt:              currentTime
        };

        let documentInfo = {};
        documentInfo.collectionName = "preOrders";
        documentInfo.documentInfo = preOrderInfo;

        return new Promise((resolve, reject) => {
            mongoRequests.insertDocument(documentInfo)
                .then(insertRes => {
                    insertRes.insertedCount === 1
                        ? resolve({
                            code: 200,
                            status: "Success",
                            message: "",
                            data: preOrderInfo
                        })
                        : reject(errorTexts.cantSaveDocumentToMongo)
                })
        });
    }
}

/**
 *
 * @param data
 * @returns {Promise<*>}
 */
async function createTwoWayPreOrder(data) {
    if (data.tripInfo.departureFlightInfo == null
        || data.tripInfo.departureClassInfo == null
        || data.tripInfo.returnFlightInfo == null
        || data.tripInfo.returnClassInfo == null) {
        return Promise.reject({
            code: 400,
            status: "error",
            message: "Incorrect Flight and/or Class Id"
        });
    }
    else {
        let [departureOnHoldPlaces, returnOnHoldPlaces] = await Promise.all([
            getOnHoldPlaceCountForClass(data.tripInfo.departureClassInfo._id),
            getOnHoldPlaceCountForClass(data.tripInfo.returnClassInfo._id)
        ]);

        if (((data.tripInfo.departureClassInfo.availableSeats - departureOnHoldPlaces.count) < data.passengersUsedSeats) ||
            ((data.tripInfo.returnClassInfo.availableSeats - returnOnHoldPlaces.count) < data.passengersUsedSeats)) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "In this class no enough place"
            });
        }

        // get new PNR
        let pnr = await Helper.getNewPnrId();

        // add data to on hold
        await Promise.all([
            addPlacesToOnHold(pnr, data.tripInfo.departureClassInfo, data.passengersUsedSeats),
            addPlacesToOnHold(pnr, data.tripInfo.returnClassInfo, data.passengersUsedSeats)
        ]);

        let currentTime = Math.floor(Date.now() / 1000);
        let preOrderInfo = {
            pnr:                    pnr,
            travelType:             data.tripInfo.travelType,
            passengersCount:        data.passengersCount,
            usedSeats:              data.passengersUsedSeats,
            departureFlightInfo:    data.tripInfo.departureFlightInfo,
            departureClassInfo:     data.tripInfo.departureClassInfo,
            returnFlightInfo:       data.tripInfo.returnFlightInfo,
            returnClassInfo:        data.tripInfo.returnClassInfo,
            updatedAt:              currentTime,
            createdAt:              currentTime
        };

        let documentInfo = {};
        documentInfo.collectionName = "preOrders";
        documentInfo.documentInfo = preOrderInfo;

        return new Promise((resolve, reject) => {
            mongoRequests.insertDocument(documentInfo)
                .then(insertRes => {
                    insertRes.insertedCount === 1
                        ? resolve({
                            code: 200,
                            status: "Success",
                            message: "",
                            data: preOrderInfo
                        })
                        : reject(errorTexts.cantSaveDocumentToMongo)
                })
        });
    }


}

/**
 *
 * @param classId
 * @returns {Promise<any>}
 */
async function getOnHoldPlaceCountForClass(classId) {
    let documentInfo = {};
    documentInfo.collectionName = "onHold";
    documentInfo.filterInfo = {
        classId: classId.toString()
    };
    documentInfo.projectionInfo = {};
    documentInfo.optionInfo = {};

    let onHoldPlaces = 0;

    return new Promise((resolve, reject) => {
        mongoRequests.findDocuments(documentInfo)
            .then(documents => {

                _.each(documents, docInfo => {
                    onHoldPlaces = onHoldPlaces + docInfo['count']
                });

                if (onHoldPlaces) {
                    resolve({
                        count: onHoldPlaces
                    })
                }
                else {
                    resolve({
                        count: onHoldPlaces
                    })
                }
            })
    });
}

/**
 *
 * @param pnr
 * @param classInfo
 * @param placesCount
 * @returns {Promise<any>}
 */
async function addPlacesToOnHold(pnr, classInfo, placesCount) {
    let currentDate = Math.floor(Date.now() / 1000);

    let documentInfo = {};
    documentInfo.collectionName = "onHold";
    documentInfo.documentInfo = {
        pnr: pnr,
        classId: classInfo._id.toString(),
        count: placesCount,
        createdAt: currentDate
    };

    return new Promise((resolve, reject) => {
        mongoRequests.insertDocument(documentInfo)
            .then(insertRes => {
                insertRes.insertedCount === 1
                    ? resolve({
                        code: 200,
                        status: "Success",
                        message: "",
                    })
                    : reject(errorTexts.cantSaveDocumentToMongo)
            })
    });
}

/**
 *
 * @param orderInfo
 * @returns {Promise<any>}
 */
async function saveOrder(orderInfo) {
    let documentInfo = {};
    documentInfo.collectionName = "orders";
    documentInfo.documentInfo = orderInfo;

    return new Promise((resolve, reject) => {
        mongoRequests.insertDocument(documentInfo)
            .then(docInfo => {
                if (1 === docInfo.result.ok) {
                    resolve({
                        success: 1
                    })
                }
                else {
                    reject({
                        error: "something went wrong"
                    })
                }
            })
            .catch(err => {
                reject(err)
            })
    });
}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
async function getOrdersInfo(data) {
    let ordersFilter = {
        deletedAt: {
            $exists: false
        }
    };

    if (data.body.ticketStatus !== undefined)  {
        ordersFilter.ticketStatus = data.body.ticketStatus;
    }

    if ("Admin" === data.userInfo.role) {
        if (data.body.agentId !== undefined)  {
            ordersFilter.agentId = data.body.agentId.toString();
        }
    }
    else {
        ordersFilter.agentId = data.userInfo.userId.toString();
    }


    let documentInfo = {};
    documentInfo.collectionName = "orders";
    documentInfo.filterInfo = ordersFilter;
    documentInfo.projectionInfo = {};
    documentInfo.optionInfo = {
        sort: {
            createdAt: -1
        }
    };

    return new Promise((resolve, reject) => {
        mongoRequests.findDocuments(documentInfo)
            .then(documents => {
                resolve(documents)
            })
            .catch(err => {
                reject(err)
            })
    });
}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
async function getOrderInfo(data) {
    let orderFilter = {};
    if ("Admin" !== data.userInfo.role) {
        orderFilter.agentId = data.userInfo.userId.toString();
    }
    orderFilter.pnr = data.pnr;

    let documentInfo = {};
    documentInfo.collectionName = "orders";
    documentInfo.filterInfo = orderFilter;
    documentInfo.projectionInfo = {};
    documentInfo.optionInfo = {};

    return new Promise((resolve, reject) => {
        mongoRequests.findDocument(documentInfo)
            .then(document => {
                resolve(document)
            })
            .catch(err => {
                reject(err)
            })
    });
}

/**
 *
 * @param pnr
 * @returns {Promise<any>}
 */
async function makeOrderCanceled(pnr) {
    let documentInfo = {};
    documentInfo.collectionName = "orders";
    documentInfo.filterInfo = {
        'pnr': pnr
    };
    documentInfo.updateInfo = {
        '$set': {
            "ticketStatus": "Canceled"
        }
    };

    return new Promise((resolve, reject) => {
        mongoRequests.updateDocument(documentInfo)
            .then(updateRes => {
                if (updateRes.lastErrorObject.n > 0) {
                    resolve({
                        code: 200,
                        status: "success",
                        message: "You successfully updated order status"
                    })
                }
                else {
                    reject(errorTexts.pnrNotFound)
                }
            })
    });
}

/**
 *
 * @param pnr
 * @returns {Promise<any>}
 */
async function makeOrderRefunded(pnr) {
    let documentInfo = {};
    documentInfo.collectionName = "orders";
    documentInfo.filterInfo = {
        'pnr': pnr
    };
    documentInfo.updateInfo = {
        '$set': {
            "ticketStatus": "Refunded"
        }
    };

    return new Promise((resolve, reject) => {
        mongoRequests.updateDocument(documentInfo)
            .then(updateRes => {
                if (updateRes.lastErrorObject.n > 0) {
                    resolve({
                        code: 200,
                        status: "success",
                        message: "You successfully updated order status"
                    })
                }
                else {
                    reject(errorTexts.pnrNotFound)
                }
            })
    });
}

/**
 *
 * @param data
 * @param pnr
 * @returns {Promise<any>}
 */
async function makeOrderTicketing(data, pnr) {
    let documentInfo = {};
    documentInfo.collectionName = "orders";
    documentInfo.filterInfo = {
        'pnr': pnr
    };
    documentInfo.updateInfo = {
        '$set': {
            "ticketStatus": "Ticketing",
            "paymentStatus": "Paid",
            "paymentType": data.body.paymentType,
        }
    };

    return new Promise((resolve, reject) => {
        mongoRequests.updateDocument(documentInfo)
            .then(updateRes => {
                if (updateRes.lastErrorObject.n > 0) {
                    resolve({
                        code: 200,
                        status: "success",
                        message: "You successfully updated order status"
                    })
                }
                else {
                    reject(errorTexts.pnrNotFound)
                }
            })
    });
}

async function checkPassengerIdInExistedPassengersInfo(passengersInfo, newPassengerInfo) {
    for (let i in passengersInfo) {
        if (passengersInfo[i].id === newPassengerInfo.id && passengersInfo[i].passengerType === newPassengerInfo.passengerType) {
            let oldData = passengersInfo[i];

            // remove old data from main array
            passengersInfo.splice(i, 1);

            return {
                passengersArray: passengersInfo,
                oldData: oldData
            }
        }
    }

    return false
}

async function fillPassengersNewDataWithOldData(oldData, newData) {
    return oldData.concat(newData)
}

async function removePreOrders(pnr) {
    let documentInfo = {};
    documentInfo.collectionName = "preOrders";
    documentInfo.filterInfo = {
        'pnr': pnr
    };

    return new Promise((resolve, reject) => {
        mongoRequests.removeDocument(documentInfo)
            .then(resolve,reject)
    });
}

async function removeOnHolSeats(pnr) {
    let documentInfo = {};
    documentInfo.collectionName = "onHold";
    documentInfo.filterInfo = {
        'pnr': pnr
    };

    return new Promise((resolve, reject) => {
        mongoRequests.removeDocument(documentInfo)
            .then(resolve,reject)
    });
}

async function checkPnrInOrders(pnr) {

    let documentInfo = {};
    documentInfo.collectionName = "orders";
    documentInfo.filterInfo = {
        pnr: pnr
    };
    documentInfo.projectionInfo = {};
    documentInfo.optionInfo = {};

    return new Promise((resolve, reject) => {
        mongoRequests.countDocuments(documentInfo)
            .then(documentCount => {
                resolve(documentCount)
            })
            .catch(err => {
                reject(err)
            })
    });
}

async function checkPricesForSplitOrder(orderInfo, newOrderInfo, i, travelWay, passengerType) {
    newOrderInfo.travelInfo[travelWay].prices[i][passengerType] = {
        "eachPrice" : orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPrice,
        "eachPriceForPassenger" : orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPriceForPassenger,
        "eachPriceFlightCurrency" : orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPriceFlightCurrency,
        "eachPriceFlightCurrencyForPassenger" : orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPriceFlightCurrencyForPassenger,
        "count" : "1",
        "totalPrice" : orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPrice,
        "totalPriceForPassenger" : orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPriceForPassenger,
        "totalPriceFlightCurrency" : orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPriceFlightCurrency,
        "totalPriceFlightCurrencyForPassenger" : orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPriceFlightCurrencyForPassenger
    };

    newOrderInfo.travelInfo[travelWay].pricesTotalInfo.count = 1;
    newOrderInfo.travelInfo[travelWay].pricesTotalInfo.totalPrice = orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPrice;
    newOrderInfo.travelInfo[travelWay].pricesTotalInfo.totalPriceForPassenger = orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPriceForPassenger;
    newOrderInfo.travelInfo[travelWay].pricesTotalInfo.totalPriceFlightCurrency = orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPriceFlightCurrency;
    newOrderInfo.travelInfo[travelWay].pricesTotalInfo.totalPriceFlightCurrencyForPassenger = orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPriceFlightCurrencyForPassenger;

    return newOrderInfo
}

async function checkPricesForMainOrder(orderInfo, mainOrderInfo, i, travelWay, passengerType) {
    mainOrderInfo.travelInfo[travelWay].prices[i][passengerType] = {
        "eachPrice" : orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPrice,
        "eachPriceForPassenger" : orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPriceForPassenger,
        "eachPriceFlightCurrency" : orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPriceFlightCurrency,
        "eachPriceFlightCurrencyForPassenger" : orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPriceFlightCurrencyForPassenger,
        "count" : (parseInt(orderInfo.travelInfo[travelWay].prices[i][passengerType].count) - 1).toString(),
        "totalPrice" : orderInfo.travelInfo[travelWay].prices[i][passengerType].totalPrice - orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPrice,
        "totalPriceForPassenger" : orderInfo.travelInfo[travelWay].prices[i][passengerType].totalPriceForPassenger - orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPriceForPassenger,
        "totalPriceFlightCurrency" : orderInfo.travelInfo[travelWay].prices[i][passengerType].totalPriceFlightCurrency - orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPriceFlightCurrency,
        "totalPriceFlightCurrencyForPassenger" : orderInfo.travelInfo[travelWay].prices[i][passengerType].totalPriceFlightCurrencyForPassenger - orderInfo.travelInfo[travelWay].prices[i][passengerType].eachPriceFlightCurrencyForPassenger,
    };

    return mainOrderInfo
}

async function makeOrderSplitted(pnr, splettedPnr, mainPnr) {
    let documentInfo = {};
    documentInfo.collectionName = "orders";
    documentInfo.filterInfo = {
        'pnr': pnr
    };
    documentInfo.updateInfo = {
        '$set': {
            pnrChild: {
                split: splettedPnr,
                main: mainPnr
            },
            ticketStatus: "Spletted"
        }
    };

    return new Promise((resolve, reject) => {
        mongoRequests.updateDocument(documentInfo)
            .then(updateRes => {
                if (updateRes.lastErrorObject.n > 0) {
                    resolve({
                        code: 200,
                        status: "success",
                        message: "You successfully split order"
                    })
                }
                else {
                    reject(errorTexts.pnrNotFound)
                }
            })
    });
}

async function insertChildOrder(orderInfo) {
    let documentInfo = {};
    documentInfo.collectionName = "orders";
    documentInfo.documentInfo = orderInfo;

    return new Promise((resolve, reject) => {
        mongoRequests.insertDocument(documentInfo)
            .then(insertRes => {
                insertRes.insertedCount === 1
                    ? resolve({
                        code: 200,
                        status: "Success",
                        message: "",
                        data: orderInfo
                    })
                    : reject(errorTexts.cantSaveDocumentToMongo)
            })
    });
}
