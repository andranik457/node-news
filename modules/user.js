
/**
 * Modoule Dependencies
 */

const _             = require("underscore");
const winston       = require("winston");
const mongoRequests = require("../dbQueries/mongoRequests");
const config        = require("../config/config");
const Helper        = require("./helper");
const userHelper    = require("../modules/userHelper");
const crypto        = require('crypto');
const jwt           = require("jsonwebtoken");
const successTexts  = require("../texts/successTexts");
const errorTexts    = require("../texts/errorTexts");

const user = {

    /**
     *
     * @param req
     * @returns {Promise<any>}
     */
    insert: req => {
        const possibleForm = {
            companyName: {
                name: "Company Name",
                type: "text",
                format: "latin",
                minLength: 3,
                maxLength: 64,
                required: true
            },
            businessName: {
                name: "Business Name",
                type: "text",
                format: "latin",
                minLength: 3,
                maxLength: 64,
                required: true
            },
            vat: {
                name: "VAT",
                type: "number",
                minLength: 3,
                maxLength: 64,
                required: true
            },
            ceoNameSurname: {
                name: "CEO Name Surname",
                type: "text",
                format: "latin",
                minLength: 3,
                maxLength: 64,
                required: true
            },
            contactNameSurname: {
                name: "Contact Name Surname",
                type: "text",
                format: "latin",
                minLength: 3,
                maxLength: 64,
                required: true
            },
            phone: {
                name: "Phone Number",
                type: "phoneNumber",
                minLength: 3,
                length: 64,
                required: true
            },
            mobilePhone: {
                name: "Mobile Phone Number",
                type: "phoneNumber",
                minLength: 3,
                length: 64,
                required: true
            },
            email: {
                name: "Email Address",
                type: "email",
                minLength: 3,
                length: 64,
                required: true
            },
            password: {
                name: "Password",
                type: "password",
                minLength: 8,
                length: 64,
                required: true
            },
            confirmPassword: {
                name: "Password",
                type: "password",
                minLength: 8,
                length: 64,
                required: true
            },
            country: {
                name: "Country",
                type: "text",
                minLength: 3,
                length: 64,
                required: true
            },
            city: {
                name: "City",
                type: "text",
                minLength: 3,
                length: 64,
                required: true
            },
            address: {
                name: "Address",
                type: "text",
                minLength: 3,
                length: 64,
                required: true
            },
            checkbox: {
                name: "Checkbox",
                type: "text",
                minLength: 1,
                length: 64,
                required: true
            }
        };

        let data = {
            body: req.body,
            editableFields: possibleForm,
            editableFieldsValues: req.body
        };

        return new Promise((resolve, reject) => {
            if (undefined === data.body) {
                reject({
                    code: 400,
                    status: "error",
                    message: "Please check request and try again!"
                });
                return
            }

            Helper.validateData(data)
                .then(data => {
                    if (data.body.password !== data.body.confirmPassword) {
                        reject({
                            code: 400,
                            status: "error",
                            message: "Passwords need to be the same"
                        });
                        return
                    }

                    return data
                })
                .then(checkIsEmailIsExists)
                .then(Helper.getNewUserId)
                .then(Helper.getVerificationToken)
                .then(saveUser)
                .then(data => {
                    let logData = {
                        userId: data.userId.toString(),
                        action: "Insert User",
                        oldData: null,
                        newData: data.userInfo,
                    };

                    Helper.addToLogs(logData);

                    return data
                })
                .then(data => {
                    let verificationUrl = config[process.env.NODE_ENV].httpUrl +"/user/verify?token="+ data.verificationToken + "&userId="+ data.userId;

                    resolve({
                        code: 200,
                        status: "OK",
                        message: "New user successfully added!",
                        result : {
                            verificationUrl: verificationUrl
                        }
                    });
                })
                .catch(reject);
        });
    },

    /**
     *
     * @param req
     * @returns {Promise<any>}
     */
    login: req => {
        const loginFields = {
            email: {
                name: "Email Address",
                type: "email",
                minLength: 3,
                length: 64,
                required: true
            },
            password: {
                name: "Password",
                type: "password",
                minLength: 8,
                length: 64,
                required: true
            }
        };

        let data = {
            body: req.body,
            editableFields: loginFields,
            editableFieldsValues: req.body
        };

        return new Promise((resolve, reject) => {
            Helper.validateData(data)
                .then(loginUser)
                .then(data => {
                    resolve({
                        code: 200,
                        status: "success",
                        result : {
                            token: data.token,
                            userId: data.userId
                        }
                    });
                })
                .catch(error => {
                    reject({
                        error
                    })
                });
        });
    },

    /**
     *
     * @param req
     * @returns {Promise<any>}
     */
    logOut: req => {
        let data = {
            userInfo: req.userInfo
        };

        return new Promise((resolve, reject) => {
            unsetUserToken(data)
                .then(resolve)
                .catch(reject)
        })
    },

    /**
     *
     * @param data
     * @returns {Promise<any>}
     */
    edit: data => {
        const reqHeaders = data.headers;
        const reqBody = data.body;

        return new Promise((resolve, reject) => {
            Promise.all([
                Helper.getTokenInfo(reqHeaders.authorization),
                generateEditValidation(reqBody)
            ])
                .then(data => {
                    const dataInfo = {
                        userId: data[0].userId.toString(),
                        validationForm: data[1]
                    };

                    return dataInfo;
                })
                .then(data => {
                    Helper.validateData(data.validationForm, reqBody)
                        .then(doc => {
                            editUser(data, reqBody)
                                .then(doc => {
                                    resolve(doc);
                                })
                                .catch(err => {
                                    reject(err);
                                })
                        })
                        .catch(er => {
                            reject(er);
                        })
                })
                .catch(err => {
                    reject(err)
                });
        });
    },

    /**
     *
     * @param req
     * @returns {Promise<any>}
     */
    remove: req => {
        let data = {
            userInfo: req.userInfo,
            userId: req.params.userId.toString()
        };

        return new Promise((resolve, reject) => {
            if ("Admin" !== data.userInfo.role) {
                reject(errorTexts.userRole)
            }

            getUserById(data)
                .then(data => {
                    if (null === data.userDocInfo) {
                        reject({
                            code: 400,
                            status: "error",
                            message: "Not found: please check user id and try again"
                        })
                    }
                    else if ("notVerified" !== data.userDocInfo.status) {
                        reject({
                            code: 400,
                            status: "error",
                            message: "You can't remove this user: (already verified)"
                        })
                    }

                    return data;
                })
                .then(removeUsers)
                .then(data => {
                    resolve({
                        code: 200,
                        status: "success",
                        result: {
                            users: data
                        }
                    })
                })
                .catch(reject)
        });

    },

    /**
     * Verify User
     * @param data
     */
    verifyUser: data => {
        return new Promise((resolve, reject) => {
            verifyUser(data)
                .then(res => {
                    resolve(res)
                })
                .catch(err => {
                    reject(err)
                })
        });
    },

    /**
     *
     * @param req
     * @returns {Promise<any>}
     */
    getUserByUserId: req => {
        let data = {
            userId: req.params.userId.toString(),
        };

        return new Promise((resolve, reject) => {
            // if ("Admin" !== data.userInfo.role) {
            //     reject(errorTexts.userRole)
            // }

            getUserById(data)
                .then(data => {
                    // if (userDocInfo.token !== req) {
                    //
                    // }
                    delete data.userDocInfo["_id"];
                    delete data.userDocInfo["password"];
                    delete data.userDocInfo["token"];

                    resolve({
                        code: 200,
                        status: "success",
                        result: data.userDocInfo
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
    getUsers: req => {
        let data = {
            body: req.body,
            userInfo: req.userInfo
        };

        return new Promise((resolve, reject) => {
            if ("Admin" !== data.userInfo.role) {
                reject(errorTexts.userRole)
            }

            getUsers(data)
                .then(data => {
                    resolve({
                        code: 200,
                        status: "success",
                        result: {
                            users: data.cursor
                        }
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
    updateUserByAdmin: req => {
        const possibleForm = {
            companyName: {
                name: "Company Name",
                type: "text",
                format: "latin",
                minLength: 3,
                maxLength: 64,
            },
            businessName: {
                name: "Business Name",
                type: "text",
                format: "latin",
                minLength: 3,
                maxLength: 64,
            },
            vat: {
                name: "VAT",
                type: "number",
                minLength: 3,
                maxLength: 64,
            },
            ceoNameSurname: {
                name: "CEO Name Surname",
                type: "text",
                format: "latin",
                minLength: 3,
                maxLength: 64,
            },
            contactNameSurname: {
                name: "Contact Name Surname",
                type: "text",
                format: "latin",
                minLength: 3,
                maxLength: 64,
            },
            phone: {
                name: "Phone Number",
                type: "phoneNumber",
                minLength: 3,
                length: 64,
            },
            mobilePhone: {
                name: "Mobile Phone Number",
                type: "phoneNumber",
                minLength: 3,
                length: 64,
            },
            email: {
                name: "Email Address",
                type: "email",
                minLength: 3,
                length: 64,
                required: true
            },
            password: {
                name: "Password",
                type: "password",
                minLength: 8,
                length: 64,
            },
            country: {
                name: "Country",
                type: "text",
                minLength: 3,
                length: 64,
            },
            city: {
                name: "City",
                type: "text",
                minLength: 3,
                length: 64,
            },
            status: {
                name: "Status",
                type: "text",
                minLength: 3,
                length: 64,
            },
            address: {
                name: "Address",
                type: "text",
                minLength: 3,
                length: 64,
            },
            role: {
                name: "Role",
                type: "text",
                minLength: 3,
                length: 64,
            }
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            userId: req.params.userId.toString(),
            possibleForm: possibleForm,
            editableFields: possibleForm,
            editableFieldsValues: req.body
        };

        return new Promise((resolve, reject) => {
            if ("Admin" !== data.userInfo.role) {
                reject(errorTexts.userRole);
                return
            }

            return new Promise((resolve, reject) => {
                Helper.getEditableFields(data)
                    .then(Helper.getEditableFieldsValues)
                    .then(Helper.validateData)
                    .then(resolve)
                    .catch(reject)
            })
                .then(updateUserByAdmin)
                .then(data => {
                    resolve(successTexts.userUpdated)
                })
                .catch(reject)
        });
    },

    /**
     *
     * @param req
     * @returns {Promise<any>}
     */
    increaseBalance: async (req) => {
        const possibleForm = {
            currency: {
                name: "Currency",
                type: "text",
                minLength: 3,
                maxLength: 3,
                required: true
            },
            amount: {
                name: "Amount",
                type: "float",
                required: true
            },
            paymentType: {
                name: "Payment Type (Cash | BankTransfer | Credit Card)",
                type: "text",
                minLength: 3,
                maxLength: 64,
                required: true
            },
            description: {
                name: "Description",
                type: "text",
                minLength: 3,
                maxLength: 512,
                required: true
            },
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            editableUserId: req.params.userId.toString(),
            editableFields: possibleForm,
            editableFieldsValues: req.body,
            routePath: req.routePath
        };

        // check action maker role
        if ("/balance/transfer/:agentId" === data.routePath || "/refund/:pnr" === data.routePath) {
            if ("Admin" !== data.userInfo.role) {
                return Promise.reject(errorTexts.userRole)
            }
        }
        else {
            if (!("Admin" === data.userInfo.role && "Higher" === data.userInfo.privilege)) {
                return Promise.reject(errorTexts.userRole)
            }
        }

        // get user info
        let editableUserInfo = await userHelper.asyncGetUserInfoById(data.editableUserId);
        if (null === editableUserInfo ) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "User not found: Please check userId and try again!"
            })
        }
        data.editableUserInfo = editableUserInfo;

        // validate body data
        await Helper.validateData(data);

        let updateInfo = await userHelper.getBalanceUpdateInfo(data);

        let userDocumentInfo = {
            collectionName: "users",
            filterInfo: {
                "userId" : data.editableUserId
            },
            updateInfo: updateInfo.updateInfo
        };

        let historyDocumentInfo = {
            collectionName: "balanceHistory",
            documentInfo: {
                type: "Increase Balance",
                userId: data.editableUserId,
                currency: updateInfo.currency,
                rate: updateInfo.rate,
                amount: data.body.amount,
                paymentType: data.body.paymentType,
                description: data.body.description,
                createdAt: Math.floor(Date.now() / 1000)
            }
        };

        let increaseBalanceResult = await Promise.all([
            mongoRequests.updateDocument(userDocumentInfo),
            mongoRequests.insertDocument(historyDocumentInfo)
        ]);

        if (1 === increaseBalanceResult[0].lastErrorObject.n) {
            return Promise.resolve(successTexts.userUpdated)
        }
        else {
            return Promise.reject(errorTexts.forEnyCase)
        }
    },

    /**
     *
     * @param req
     * @returns {Promise<any>}
     */
    useBalance: async (req) => {
        const possibleForm = {
            currency: {
                name: "Currency",
                type: "text",
                minLength: 3,
                maxLength: 3,
                required: true
            },
            amount: {
                name: "Amount",
                type: "number",
                required: true
            },
            description: {
                name: "Description",
                type: "text",
                minLength: 3,
                maxLength: 512,
                required: true
            },
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            editableUserId: req.params.userId.toString(),
            editableFields: possibleForm,
            editableFieldsValues: req.body,
            routePath: req.routePath
        };

        // check action maker role
        if ("/balance/transfer/:agentId" === data.routePath || "/refund/:pnr" === data.routePath) {
            if ("Admin" !== data.userInfo.role) {
                return Promise.reject(errorTexts.userRole)
            }
        }
        else {
            if (!("Admin" === data.userInfo.role && "Higher" === data.userInfo.privilege)) {
                return Promise.reject(errorTexts.userRole)
            }
        }

        // get user info
        let editableUserInfo = await userHelper.asyncGetUserInfoById(data.editableUserId);

        if (null === editableUserInfo ) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "User not found: Please check userId and try again!"
            })
        }
        data.editableUserInfo = editableUserInfo;

        // validate body data
        await Helper.validateData(data);

        let updateInfo = await userHelper.useBalanceByAdmin(data);

        let userDocumentInfo = {
            collectionName: "users",
            filterInfo: {
                "userId" : data.editableUserId
            },
            updateInfo: updateInfo.updateInfo
        };

        let historyDocumentInfo = {
            collectionName: "balanceHistory",
            documentInfo: {
                type: "Use Balance",
                userId: data.editableUserId,
                currency: updateInfo.currency,
                rate: updateInfo.rate,
                amount: data.body.amount,
                description: data.body.description,
                createdAt: Math.floor(Date.now() / 1000)
            }
        };

        let increaseBalanceResult = await Promise.all([
            mongoRequests.updateDocument(userDocumentInfo),
            mongoRequests.insertDocument(historyDocumentInfo)
        ]);

        if (1 === increaseBalanceResult[0].lastErrorObject.n) {
            return Promise.resolve(successTexts.userUpdated)
        }
        else {
            return Promise.reject(errorTexts.forEnyCase)
        }

    },

    /**
     *
     * @param req
     * @returns {Promise<*>}
     */
    balanceTransfer: async (req) => {
        const possibleForm = {
            currency: {
                name: "Currency",
                type: "text",
                minLength: 3,
                maxLength: 3,
                required: true
            },
            amount: {
                name: "Amount",
                type: "number",
                required: true
            },
            description: {
                name: "Description",
                type: "text",
                minLength: 3,
                maxLength: 512,
                required: true
            },
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            agentId: req.params.agentId.toString(),
            editableFields: possibleForm,
            editableFieldsValues: req.body,
            routePath: req.route.path || ""
        };
        data.body.paymentType = "Balance-Transfer";

        // check action maker role
        if ("Admin" !== data.userInfo.role) {
            return Promise.reject(errorTexts.userRole)
        }

        // 1. Check agent info
        // 2. try to use user balance
        // 3. try to increase agent balance
        // 4. add to logs
        // 5. save transaction info
        let transactionInfo = [];

        let logsInfo = {
            userId: data.userInfo.userId,
            action: "Balance-Transfer",
            oldData: {},
            newData: {}
        };

        const agentInfo = await userHelper.asyncGetUserInfoById(data.agentId);
        if (null === agentInfo || undefined === agentInfo.userId || agentInfo.status !== "approved") {
            return Promise.reject(errorTexts.userNotFound)
        }

        // add log oldData
        logsInfo.oldData = agentInfo.balance;

        let useBalanceData = {
            body: data.body,
            userInfo: data.userInfo,
            params: {
                userId: data.userInfo.userId
            },
            routePath: data.routePath
        };

        let useBalanceInfo = await user.useBalance(useBalanceData);
        transactionInfo.push(useBalanceInfo);
        if (200 === parseInt(useBalanceInfo.code)) {
            let increaseBalanceData = {
                body: data.body,
                userInfo: data.userInfo,
                params: {
                    userId: data.agentId
                },
                routePath: data.routePath
            };

            // add log newData
            logsInfo.newData.useBalance = {
                data: useBalanceData.body
            };

            let increaseBalanceInfo = await user.increaseBalance(increaseBalanceData);
            transactionInfo.push(increaseBalanceInfo);
            if (200 === parseInt(increaseBalanceInfo.code)) {
                // add log newData
                logsInfo.newData.increaceBalance = {
                    agentId: increaseBalanceData.params.userId,
                    data: increaseBalanceData.body
                };

                // save logData
                let logSaveResult = await Helper.addToLogs(logsInfo);
                transactionInfo.push(logSaveResult);
                await Helper.logTransactionResult(transactionInfo);

                return Promise.resolve(increaseBalanceInfo)
            }
            else {
                // reset amount tu user account
                let increaseBalanceData = {
                    body: req.body,
                    userInfo: req.userInfo,
                    params: {
                        userId: req.userInfo
                    },
                    routePath: data.routePath
                };

                let resetBalanceInfo = await user.increaseBalance(increaseBalanceData);
                transactionInfo.push(resetBalanceInfo);
                await Helper.logTransactionResult(transactionInfo);

                return Promise.reject(increaseBalanceInfo)
            }
        }
        else {
            return Promise.reject(useBalanceInfo)
        }

    },

    /**
     *
     * @param req
     * @returns {Promise<any>}
     */
    getBalanceHistory: req => {
        let data = {
            body: req.body,
            userInfo: req.userInfo,
            userId: req.params.userId.toString()
        };

        return new Promise((resolve, reject) => {
            if (!("Admin" === data.userInfo.role || data.userInfo.userId === data.userId)) {
                reject(errorTexts.userRole)
            }

            getBalanceHistory(data)
                .then(data => {
                    resolve({
                        code: 200,
                        status: "success",
                        result: data.historyInfo
                    })
                })
                .catch(reject)
        });
    },

    /**
     *
     * @param req
     * @returns {Promise<{code: number, status: string, message: string}|text.userRole|{code, status, message}>}
     */
    setCreditLimit: async (req) => {
        // validate data
        let possibleFields = {
            amount: {
                name: "Amount",
                type: "number",
                minLength: 1,
                maxLength: 100,
                required: true
            },
            currency: {
                name: "Currency",
                type: "text",
                minLength: 3,
                maxLength: 3,
                required: true
            },
            description: {
                name: "Description",
                type: "text",
                minLength: 1,
                maxLength: 128,
                required: true
            }
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            possibleForm: possibleFields,
            editableFields: possibleFields,
            editableFieldsValues: req.body,
            checkedUserId: req.params.userId.toString()
        };

        // check user role
        if ("Admin" !== data.userInfo.role) {
            return errorTexts.userRole;
        }

        await Helper.validateData(data);

        let localAmount = await Helper.checkAmount(data.body.currency, data.body.amount);

        // get checked user info
        let checkedUserInfo = await getUserInfoByIdMain(data.checkedUserId);
        if (null === checkedUserInfo) {
            return {
                code: 400,
                status: "error",
                message: "Please check userId and try again! (User not found)"
            }
        }

        // check user current max credit and current credit
        if (checkedUserInfo.balance.currentCredit > localAmount.amount) {
            return {
                code: 400,
                status: "error",
                message: "You can't set max credit less than current credit!"
            }
        }

        // update user max credit | set to history
        let currentDate = Math.floor(Date.now() / 1000);

        let userUpdatedInfo = {};
        userUpdatedInfo.collectionName = "users";
        userUpdatedInfo.filterInfo = {userId: checkedUserInfo.userId};
        userUpdatedInfo.updateInfo = {
            "$set": {
                "balance.maxCredit": localAmount.amount
            }
        };

        let historyInfo = {};
        historyInfo.collectionName = "balanceHistory";
        historyInfo.documentInfo = {
            type:           "Changed max credit limit",
            oldLimit:       checkedUserInfo.balance.currentCredit,
            newLimit:       localAmount.amount,
            userId:         checkedUserInfo.userId,
            currency:       localAmount.currency,
            rate:           localAmount.rate,
            amount:         localAmount.amount,
            description:    data.body.description,
            createdAt:      currentDate
        };

        let result = await Promise.all([
            mongoRequests.updateDocument(userUpdatedInfo),
            mongoRequests.insertDocument(historyInfo),
        ]);

        if (result[0].ok === 1 && result[1].result.ok === 1) {
            return {
                core: 200,
                status: "success",
                message: "User max credit successfully updated!"
            }
        }
        else {
            return errorTexts.forEnyCase
        }
    },

    /**
     *
     * @param req
     * @returns {Promise<*>}
     */
    changePassword: async (req) => {
        let possibleFields = {
            currentPassword: {
                name: "Current Password",
                type: "password",
                minLength: 8,
                maxLength: 64,
                required: true
            },
            newPassword: {
                name: "New Password",
                type: "password",
                minLength: 8,
                maxLength: 64,
                required: true
            },
            newPasswordRetry: {
                name: "New Password Retry",
                type: "password",
                minLength: 8,
                maxLength: 64,
                required: true
            }
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            possibleForm: possibleFields,
            editableFields: possibleFields,
            editableFieldsValues: req.body,
            checkedUserId: req.params.userId.toString()
        };

        // get user info
        let editableUserInfo = await userHelper.asyncGetUserInfoById(data.checkedUserId);
        if (null === editableUserInfo ) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "User not found: Please check userId and try again!"
            })
        }

        // check user role
        if ("Admin" !== data.userInfo.role && editableUserInfo.userId !== data.userInfo.userId) {
            return errorTexts.userRole;
        }

        await Helper.validateData(data);

        if (crypto.createHash('sha256').update(data.body.currentPassword + editableUserInfo.salt).digest("hex") !== editableUserInfo.password) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "Current password is incorrect: Please check password and try again!"
            })
        }
        else if (data.body.newPassword !== data.body.newPasswordRetry) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "Passwords not matched: Please check passwords and try again!"
            })
        }

        let documentInfo = {};
        documentInfo.collectionName = "users";
        documentInfo.filterInfo = {"userId" : data.checkedUserId};
        documentInfo.updateInfo = {'$set': {"password": crypto.createHash('sha256').update(data.body.newPassword + editableUserInfo.salt).digest("hex")}};

        return new Promise((resolve, reject) => {
            mongoRequests.updateDocument(documentInfo)
                .then(res => {
                    resolve({
                        code: 200,
                        status: "Success",
                        message: "User password successfully changed"
                    })
                })
                .catch(err => {
                    winston.log("error", err);

                    reject({
                        code: 400,
                        status: "Error",
                        message: "Ups: Something went wrong:("
                    })
                })
        });
    },

    /**
     *
     * @param req
     * @returns {Promise<*>}
     */
    forgotPassword: async (req) => {
        let possibleFields = {
            email: {
                name: "Email Address",
                type: "email",
                minLength: 3,
                length: 64,
                required: true
            }
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            possibleForm: possibleFields,
            editableFields: possibleFields,
            editableFieldsValues: req.body,
        };

        // validate data
        await Helper.validateData(data);

        // get users info by email
        let userInfo = await userHelper.asyncGetUserInfoByEmail(data.body.email);
        if (null === userInfo) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "User not found: Please check email and try again!"
            })
        }

        await Helper.getVerificationToken(data);

        let verificationUrl = config[process.env.NODE_ENV].httpUrl +"/user/forgot-password/verify?token="+ data.verificationToken + "&userId="+ userInfo.userId;

        let documentInfo = {};
        documentInfo.collectionName = "users";
        documentInfo.filterInfo = {
            userId: userInfo.userId
        };
        documentInfo.updateInfo = {
            '$set': {
                forgotPasswordUrl: data.verificationToken,
                forgotPasswordDate: Math.floor(Date.now() / 1000)
            }
        };

        return new Promise((resolve, reject) => {
            mongoRequests.updateDocument(documentInfo)
                .then(res => {
                    resolve({
                        code: 200,
                        status: "Success",
                        message: "Please follow forgot password url",
                        data: verificationUrl
                    })
                })
                .catch(err => {
                    winston.log("error", err);
                    reject(errorTexts.forEnyCase)
                })
        });
    },

    /**
     *
     * @param req
     * @returns {Promise<any>}
     */
    forgotPasswordVerify: async (req) => {
        let data = {
            passwordForgotToken: req.query.token,
            userId: req.query.userId.toString()
        };

        let documentInfo = {};
        documentInfo.collectionName = "users";
        documentInfo.filterInfo = {
            userId: data.userId,
            forgotPasswordUrl: data.passwordForgotToken
        };
        documentInfo.updateInfo = {
            $set: {
                forgotPasswordStatus: "Active",
                forgotPasswordDate: Math.floor(Date.now() / 1000)
            },
            $unset: {
                forgotPasswordUrl: 1
            }
        };

        return new Promise((resolve, reject) => {
            mongoRequests.updateDocument(documentInfo)
                .then(doc => {
                    if (doc.value) {
                        resolve({
                            code: 200,
                            status: "success",
                            message: "Password forgot verification successfully passed: Now you can insert new password!"
                        })
                    }
                    else {
                        reject({
                            code: 400,
                            status: "error",
                            message: "Please check verification url and try again"
                        })
                    }
                })
        });
    },

    /**
     *
     * @param req
     * @returns {Promise<*>}
     */
    forgotPasswordReset: async (req) => {
        let possibleFields = {
            password: {
                name: "Password",
                type: "password",
                minLength: 8,
                maxLength: 64,
                required: true
            }
        };

        let data = {
            body: req.body,
            userInfo: req.userInfo,
            possibleForm: possibleFields,
            editableFields: possibleFields,
            editableFieldsValues: req.body,
            checkedUserId: req.params.userId.toString()
        };

        // get user info
        let editableUserInfo = await userHelper.asyncGetUserInfoById(data.checkedUserId);
        if (null === editableUserInfo ) {
            return Promise.reject({
                code: 400,
                status: "error",
                message: "User not found: Please check userId and try again!"
            })
        }

        if (null === editableUserInfo.forgotPasswordStatus) {
            return errorTexts.forEnyCase
        }

        await Helper.validateData(data);

        let documentInfo = {};
        documentInfo.collectionName = "users";
        documentInfo.filterInfo = {"userId" : data.checkedUserId};
        documentInfo.updateInfo = {
            '$set': {
                "password": crypto.createHash('sha256').update(data.body.password + editableUserInfo.salt).digest("hex")
            },
            '$unset': {
                forgotPasswordDate: 1,
                forgotPasswordStatus: 1
            }
        };

        return new Promise((resolve, reject) => {
            mongoRequests.updateDocument(documentInfo)
                .then(res => {
                    resolve({
                        code: 200,
                        status: "Success",
                        message: "User password successfully changed"
                    })
                })
                .catch(err => {
                    winston.log("error", err);

                    reject({
                        code: 400,
                        status: "Error",
                        message: "Ups: Something went wrong:("
                    })
                })
        });
    }

};

module.exports = user;

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function checkIsEmailIsExists(data) {
    let documentInfo = {};
    documentInfo.collectionName = "users";
    documentInfo.filterInfo = {email: data.body.email};

    return new Promise((resolve, reject) => {
        mongoRequests.countDocuments(documentInfo)
            .then(docCount => {
                docCount > 0
                    ? reject(errorTexts.emailAddressAlreadyInUse)
                    : resolve(data)
            })
    });
}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function saveUser(data) {
    let currentTime = Math.floor(Date.now() / 1000);

    const userInfo = {
        userId:             data.userId.toString(),
        companyName:        data.body.companyName,
        businessName:       data.body.businessName,
        password:           crypto.createHash('sha256').update(data.body.password + currentTime).digest("hex"),
        salt:               currentTime,
        email:              data.body.email,
        vat:                data.body.vat,
        ceoNameSurname:     data.body.ceoNameSurname,
        contactNameSurname: data.body.contactNameSurname,
        phone:              data.body.phone,
        mobilePhone:        data.body.mobilePhone,
        country:            data.body.country,
        city:               data.body.city,
        address:            data.body.address,
        balance: {
            currentBalance: 0,
            currentCredit:  0,
            maxCredit:      0
        },
        status:             "notVerified",
        role:               "user",
        createdAt:          currentTime,
        updatedAt:          currentTime,
        verificationToken:  data.verificationToken
    };

    data.userInfo = userInfo;

    let documentInfo = {};
    documentInfo.collectionName = "users";
    documentInfo.documentInfo = userInfo;

    return new Promise((resolve, reject) => {
        mongoRequests.insertDocument(documentInfo)
            .then(insertRes => {
                insertRes.insertedCount === 1
                    ? resolve(data)
                    : reject(errorTexts.saveUser)
            })
    });
}


/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function verifyUser(data) {
    let documentInfo = {};
    documentInfo.collectionName = "users";
    documentInfo.filterInfo = {
        "userId": data.userId.toString(),
        verificationToken: data.token
    };
    documentInfo.updateInfo = {
        $set: {
            status: "verified",
            updatedAt: Math.floor(Date.now() / 1000)
        },
        $unset: {
            verificationToken: 1
        }
    };

    return new Promise((resolve, reject) => {
        mongoRequests.updateDocument(documentInfo)
            .then(doc => {
                if (doc.value) {
                    resolve({
                        code: 200,
                        status: "success",
                        message: "User successfully verified!"
                    })
                }
                else {
                    reject({
                        code: 400,
                        status: "error",
                        message: "Some error occurred in process to verify user: Please check token and try again!"
                    })
                }
            })
    });

}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function loginUser(data) {
    let documentInfo = {};
    documentInfo.collectionName = "users";
    documentInfo.filterInfo = {"email" : data.body.email};

    return new Promise((resolve, reject) => {
        mongoRequests.findDocument(documentInfo)
            .then(docInfo => {
                if (null != docInfo && "notVerified" === docInfo.status) {
                    reject({
                        code: 403,
                        status: "error",
                        message: "You can't use this account. You need to verify your email address."
                    })
                }
                else if (null != docInfo && "approved" !== docInfo.status) {
                    reject({
                        code: 403,
                        status: "error",
                        message: "You can't use this account. You need to get approve from admin."
                    })
                }
                else if (null != docInfo && docInfo.password === crypto.createHash('sha256').update(data.body.password + docInfo.salt).digest("hex")) {
                    let token = jwt.sign({
                        userId: docInfo.userId,
                        role: docInfo.role
                    }, config[process.env.NODE_ENV].jwtSecret);

                    documentInfo.updateInfo = {$push: {tokens: token}};
                    mongoRequests.updateDocument(documentInfo);

                    data.token = token;
                    data.userId = docInfo.userId;

                    resolve(data);
                }
                else {
                    reject({
                        code: 400,
                        status: "error",
                        message: "Email/Password is incorrect!"
                    })
                }
            })
    });
}

/**
 *
 * @param data
 * @param reqBody
 * @returns {Promise<any>}
 */
function editUser(data, reqBody) {
    let documentInfo = {};
    documentInfo.collectionName = "users";
    documentInfo.filter = {"userId" : data.userId};

    let newData = {};

    return new Promise((resolve, reject) => {
        for (key in data.validationForm) {
            newData[key] = reqBody[key]
        }

        documentInfo.newValue = {$set: newData};

        mongoRequests.updateDocument(documentInfo)
            .then(doc => {
                resolve({
                    code: 200,
                    status: "success",
                    message: "UserInfo successfully updated!"
                })
            })
            .catch(err => {
                reject({
                    code: 400,
                    status: "error",
                    message: "Ups: Something went wrong:("
                })
            })
    });
}

/**
 *
 * @param reqBody
 * @returns {Promise<any>}
 */
function generateEditValidation(reqBody) {
    let validateForm = {};

    return new Promise((resolve, reject) => {
        for (i in reqBody) {
            switch(i) {
                case "companyName":
                    validateForm.companyName = {
                        name: "Company Name",
                        type: "text",
                        format: "latin",
                        minLength: 3,
                        maxLength: 64,
                        required: true
                    };
                    break;
                case "businessName":
                    validateForm.businessName = {
                        name: "Business Name",
                        type: "text",
                        format: "latin",
                        minLength: 3,
                        maxLength: 64,
                        required: true
                    };
                    break;
                case "vat":
                    validateForm.vat = {
                        name: "VAT",
                        type: "text",
                        format: "latin",
                        minLength: 3,
                        maxLength: 64,
                        required: true
                    };
                    break;
                case "tin":
                    validateForm.tin = {
                        name: "TIN",
                        type: "text",
                        format: "latin",
                        minLength: 3,
                        maxLength: 64,
                        required: true
                    };
                    break;
                case "ceoName":
                    validateForm.ceoName = {
                        name: "CEO Name",
                        type: "text",
                        format: "latin",
                        minLength: 3,
                        maxLength: 64,
                        required: true
                    };
                    break;
                case "phone":
                    validateForm.phone = {
                        name: "Phone Number",
                        type: "text",
                        minLength: 3,
                        length: 64,
                        required: true
                    };
                    break;
                case "status":
                    validateForm.status = {
                        name: "User Status",
                        type: "text",
                        minLength: 3,
                        length: 64,
                        required: true
                    };
                    break;
            }
        }

        if (_.isEmpty(validateForm)) {
            reject({
                code: 400,
                status: "error",
                message: "Ups: Something went wrong:("
            });
        }
        else {
            resolve(validateForm);
        }
    });
}


// function getUserById(data) {
//     let documentInfo = {};
//     documentInfo.collectionName = "users";
//     documentInfo.filterInfo = {
//         userId: data.userId
//     };
//     documentInfo.optionInfo = {
//         lean : true
//     };
//     documentInfo.projectionInfo = {
//         _id: 0,
//         userId: 1,
//         companyName: 1,
//         businessName: 1,
//         email: 1,
//         vat: 1,
//         tin: 1,
//         ceoName: 1,
//         phone: 1,
//         status: 1,
//         role: 1,
//         createdAt: 1,
//         token: 1
//     };
//
//     return new Promise((resolve, reject) => {
//         mongoRequests.findDocument(documentInfo)
//             .then(doc => {
//                 data.cursor = doc;
//
//                 resolve(data)
//             })
//             .catch(err => {
//                 winston('error', err);
//
//                 reject({
//                     code: 400,
//                     status: "error",
//                     message: "Ups: Something went wrong:("
//                 })
//             })
//     });
// }

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function getUsers(data) {
    let documentInfo = {};
    documentInfo.collectionName = "users";
    documentInfo.filterInfo = data.body;
    documentInfo.optionInfo = {
        lean : true,
        sort : {
            createdAt : -1
        }
    };
    documentInfo.projectionInfo = {};

    return new Promise((resolve, reject) => {
        mongoRequests.findDocuments(documentInfo)
            .then(doc => {
                data.cursor = doc;

                resolve(data)
            })
            .catch(err => {
                winston('error', err);

                reject({
                    code: 400,
                    status: "error",
                    message: "Ups: Something went wrong:("
                })
            })
    });
}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function updateUserByAdmin(data) {
    let documentInfo = {};
    documentInfo.collectionName = "users";
    documentInfo.filterInfo = {"userId" : data.userId};
    documentInfo.updateInfo = {$set: data.editableFieldsValues};

    return new Promise((resolve, reject) => {
        mongoRequests.updateDocument(documentInfo)
            .then(updateRes => {
                updateRes.ok === 1
                    ? resolve(data)
                    : reject(errorTexts.cantUpdateMongoDocument)
            })
    })
}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function getUserById(data) {
    let documentInfo = {
        collectionName: "users",
        filterInfo: {
            userId: data.userId
        }
    };

    return new Promise((resolve, reject) => {
        mongoRequests.findDocument(documentInfo)
            .then(doc => {
                data.userDocInfo = doc;

                resolve(data)
            })
            .catch(err => {
                winston('error', err);

                reject(errorTexts.forEnyCase)
            })
    });
}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function getBalanceHistory(data) {
    let documentInfo = {
        collectionName: "balanceHistory",
        filterInfo: {
            "userId" : data.userId
        },
        optionInfo: {
            sort: {
                createdAt: -1
            }
        }
    };

    let historyInfo = [];
    return new Promise((resolve, reject) => {
        mongoRequests.findDocuments(documentInfo)
            .then(res => {
                _.each(res, value => {
                    historyInfo.push({
                        type:           value.type || "",
                        rate:           value.rate || "",
                        currency:       value.currency || "",
                        amount:         value.amount || 0,
                        description:    value.description || "",
                        createdAt:      value.createdAt || 0
                    });
                });

                data.historyInfo = historyInfo;
                resolve(data)
            })
            .catch(err => {
                winston.log("error", err);

                reject(errorTexts.forEnyCase)
            })
    })
}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function unsetUserToken(data) {
    let token = '';

    if (data.userInfo.token) {
        token = data.userInfo.token;
    }

    let documentInfo = {};
    documentInfo.collectionName = "users";
    documentInfo.filterInfo = {"userId" : data.userInfo.userId};
    documentInfo.updateInfo = {'$pull': {"tokens": token}};

    return new Promise((resolve, reject) => {
        mongoRequests.updateDocument(documentInfo)
            .then(res => {
                resolve({
                    code: 200,
                    status: "Success",
                    message: "You have successfully logged out!"
                })
            })
            .catch(err => {
                winston.log("error", err);

                reject({
                    code: 400,
                    status: "Error",
                    message: "Ups: Something went wrong:("
                })
            })
    })
}

/**
 *
 * @param userId
 * @returns {Promise<any>}
 */
async function getUserInfoByIdMain(userId) {
    let documentInfo = {};
    documentInfo.collectionName = "users";
    documentInfo.filterInfo = {userId: userId};
    documentInfo.projectionInfo = {};

    return new Promise((resolve, reject) => {
        mongoRequests.findDocument(documentInfo)
            .then(docInfo => {
                resolve(docInfo)
            })
            .catch(err => {
                winston('error', err);
                reject(errorTexts.forEnyCase)
            })
    });
}

/**
 *
 * @param data
 * @returns {Promise<any>}
 */
function removeUsers(data) {
    let documentInfo = {};
    documentInfo.collectionName = "users";
    documentInfo.filterInfo = {userId: data.userDocInfo.userId};

    return new Promise((resolve, reject) => {
        mongoRequests.removeDocument(documentInfo)
            .then(docInfo => {
                resolve({success: 1})
            })
            .catch(err => {
                winston('error', err);
                reject(errorTexts.forEnyCase)
            })
    });
}