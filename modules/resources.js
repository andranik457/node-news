
/**
 * Modoule Dependencies
 */

const mongoRequestsFiles    = require("../dbQueries/mongoRequestsFiles");
const successTexts          = require("../texts/successTexts");
const errorTexts            = require("../texts/errorTexts");

const resourcesInfo = {

    // async setResource (data) {
    //
    // },

    getResource : (req, next) => {
        mongoRequestsFiles.getResource(req.params.id, (err, result, file) => {
            if (err) return next(err);

            if (!file.contentType) {
                file.contentType = platformConfigs[process.env.NODE_ENV].iconMongoConf.defType;
            }
            next(null, result, file);
        });
    },

};

module.exports = resourcesInfo;