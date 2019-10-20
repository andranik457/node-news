
const text = {

    incorrectToken: {
        code: 401,
        status: "error",
        message: "Ups: Incorrect Token, please check token and try again (:"
    },

    forEnyCase: {
        code: 403,
        status: "error",
        message: "Ups: Something went wrong, please try again (:"
    },

    userRole: {
        code: 403,
        status: "error",
        message: "Ups: You don't have permission to do this action (:"
    },

    cantSaveDocumentToMongo: {
        code: 403,
        status: "error",
        message: "Ups: Can't save this document (:"
    },

    cantUpdateMongoDocument: {
        code: 403,
        status: "error",
        message: "Ups: Can't update this document (:"
    },

    mongId: {
        code: 403,
        status: "error",
        message: "Ups: Please insert correct id!"
    },

    emailAddressAlreadyInUse: {
        code: 400,
        status: "error",
        message: "Ups: Email Address already in use (:"
    },

    userNewId: {
        code: 400,
        status: "error",
        message: "Ups: Some error occurred in process to creating new id for user!"
    },

    pnr: {
        code: 400,
        status: "error",
        message: "Ups: Some error occurred in process to creating new id for pnr!"
    },

    ticketNumber: {
        code: 400,
        status: "error",
        message: "Ups: Some error occurred in process to creating new id for ticket number!"
    },

    verificationToken: {
        code: 400,
        status: "error",
        message: "We can't create verification token"
    },

    saveUser: {
        code: 400,
        status: "error",
        message: "Some error occurred we can't save this user!"
    },

    incorrectStartEndDate: {
        code: 400,
        status: "error",
        message: "Start Date can't be greater than End Date!"
    },

    incorrectTravelType: {
        code: 400,
        status: "error",
        message: "Please Input correct travel type!"
    },

    incorrectFlightAndOrClassId: {
        code: 400,
        status: "error",
        message: "Incorrect Flight and/or Class Id"
    },

    incorrectFlightId: {
        code: 400,
        status: "error",
        message: "Incorrect Flight Id"
    },

    incorrectPassengersCount: {
        code: 400,
        status: "error",
        message: "Incorrect passengers count"
    },

    differentAirlines: {
        code: 400,
        status: "error",
        message: "Airlines need to bee the same!"
    },

    passengerType: {
        code: 400,
        status: "error",
        message: "Please select correct passenger type"
    },

    incorrectTicketValue: {
        code: 400,
        status: "error",
        message: "Please check ticket value"
    },

    incorrectOrderStatus: {
        code: 400,
        status: "error",
        message: "Incorrect ticket status"
    },

    pnrNotFound: {
        code: 400,
        status: "error",
        message: "Please check pnr and try again (pnr not found)"
    },

    messageNotFound: {
        code: 400,
        status: "error",
        message: "Please check messageId and try again (message not found)"
    },

    classNotFound: {
        code: 400,
        status: "error",
        message: "Please check classId and try again (classId not found)"
    },

    onHoldSeats: {
        code: 400,
        status: "error",
        message: "Can't remove onHold seats"
    },

    amountInfo: {
        code: 400,
        status: "error",
        message: "Cant get amount info: Please try again"
    },

    ticketingStatus: {
        code: 400,
        status: "error",
        message: "Ticket status need to be Ticketing"
    },

    bookingStatus: {
        code: 400,
        status: "error",
        message: "Ticket status need to be Booking"
    },

    incorrectAmountType: {
        code: 400,
        status: "error",
        message: "Amount type is not correct"
    },

    enoughMoney: {
        code: 400,
        status: "error",
        message: "You don't have enough money"
    },

    incorrectAge: {
        code: 400,
        status: "error",
        message: "Please check passenger age and try again"
    },

    incorrectDepartureClassId: {
        code: 400,
        status: "error",
        message: "Please check departure classId and try again"
    },

    incorrectReturnClassId: {
        code: 400,
        status: "error",
        message: "Please check return classId and try again"
    },

    userNotFound: {
        code: 400,
        status: "error",
        message: "Ups: User not found"
    },

    notFound: {
        code: 400,
        status: "error",
        message: "Ups: No information for this request!",
        logs: "Please check input data and try again"
    }

};

module.exports = text;
