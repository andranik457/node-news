
/**
 * Module Dependencies
 */

const mongo         = require("mongodb");
const gridfs        = require("gridfs-stream" );
const fs            = require('fs');
const winston       = require("winston");
const config        = require("../config/config");
const errorTexts    = require("../texts/errorTexts");

/**
 * MongoDB db:files Connection
 */
let databaseFiles;

const connectFiles = () => {
    mongo.MongoClient.connect(config[process.env.NODE_ENV].mongoConfFiles.url, (err, db) => {
        if(err) {
            winston.log("error", "mongo db:"+ config[process.env.NODE_ENV].mongoConfFiles.dbName +" connection closed");

            setTimeout(connectFiles, config[process.env.NODE_ENV].mongoConfFiles.options.server.reconnectInterval);

            return winston.log("error", err);
        }

        databaseFiles = db;
        winston.log("info", "mongo db:"+ config[process.env.NODE_ENV].mongoConfFiles.dbName +" connection ready");
        winston.log("info", "----------------x---------------");

        db.on("close", function () {
            winston.log("error", "mongo db:"+ config[process.env.NODE_ENV].mongoConfFiles.dbName +" connection closed");

            databaseFiles = null;
            setTimeout(connectFiles, config[process.env.NODE_ENV].mongoConfFiles.options.server.reconnectInterval);
        });
    });
};

connectFiles();


/**
 * ---------------------------------------------------------
 */

const mongoQueries = {

    /**
     *
     * @param data
     * @returns {Promise<void>}
     */
    async storeResource (data) {
        let gfs = gridfs(databaseFiles, mongo);

        let writeStream = gfs.createWriteStream({filename: data.filename});
        data.file.pipe(writeStream);

        data.file.on('limit', function() {
            // console.log("File size can't be greater "+ data.fileSize);
        });

        writeStream.on('error', (error) => {
            // console.log(error);
        });

        writeStream.on('close', (file) => {
            // console.log('Stored File: ' + file.filename);
        });

        writeStream.on('finish', (file) => {
            // console.log('finish File: ' + file);
        });

        writeStream.on('pipe', (file) => {
            // console.log('pipe File: ' + file);
        });

        let fileDocId = writeStream.id.toString();

        return fileDocId;

    },

    getResource : (id, next) => {
        let gfs = gridfs(databaseFiles, mongo);

        gfs.findOne({"_id" : id}, (err, file) => {
            if (err) return next({status : 503, message : err.message || "Service unavailable"});
            if (!file) return next({status : 404, message : err || "Not Found"});

            let readStream = gfs.createReadStream({"_id" : id});
            readStream.on("error", () => {
                winston.log("error", err);
            });
            readStream.on("open", () => {
                next(null, readStream, file);
            });
            readStream.on("end", () => {
                file = null;
                gfs = null;
                readStream = null;
            });
        });
    },

};

module.exports = mongoQueries;