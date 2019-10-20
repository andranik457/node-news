
/**
 * Module dependencies
 */

const app           = require("express")();
const winston       = require("winston");
const config        = require("./config/config");
process.env.NODE_ENV = config.mode;
const bodyParser    = require("body-parser");
const expressJwt    = require("express-jwt");
const secret        = config[process.env.NODE_ENV].jwtSecret;
//
const auth          = require("./middlewares/auth");
//
const logs          = require("./routes/logs");
const messages      = require("./routes/messages");
const news          = require("./routes/news");
const flights       = require("./routes/flights");
const classes       = require("./routes/classes");
const searches      = require("./routes/searches");
const orders        = require("./routes/orders");
const reports       = require("./routes/reports");
const users         = require("./routes/users");
const routes        = require("./routes/routes");
const cors          = require('cors');

/**
 * Express middleware
 */

app.use(cors());
app.use("/api", expressJwt({secret: secret}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(bodyParser.text({type : "application/x-www-form-urlencoded", limit: '8mb'}));
app.use(bodyParser.json());

/**
 * Routes
 */
app.use("/api", auth.isAuth);
// app.use("/api/users", makeLowerCase);

/**
 * Routes
 */
app.use("/api/logs", logs);
app.use("/api/messages", messages);
app.use("/api/news", news);
app.use("/api/flights", flights);
app.use("/api/classes", classes);
app.use("/api/search", searches);
app.use("/api/orders", orders);
app.use("/api/reports", reports);
app.use("/api/users", users);
app.use("/", routes);

/**
 * production error handler
 */
app.use((err, req, res, next) => {
    if (isNaN(err.status)) {
        res.status(err.code || 500);
        res.json({
            code: err.code || 500,
            status: err.status || "",
            message: err.message || "",
            logs: err.logs || ""
        });
    }
    else {
        res.status(err.status || 500);
        res.json({
            code: err.status || 500,
            message : err.message || ""
        });
    }

});

/**
 * Application listening on PORT
 */

app.listen(config[process.env.NODE_ENV].port, config[process.env.NODE_ENV].hostname, winston.log("info", `Node.js server is running at http://${config[process.env.NODE_ENV].hostname}:${config[process.env.NODE_ENV].port} 
    in ${process.env.NODE_ENV} mode with process id ${process.pid}`)
);

/**
 * Checking Uncaught Exceptions
 */

process.on("uncaughtException", err => {
    winston.log("error", (new Date).toUTCString() + " uncaughtException:", err.message);
winston.log("info", err.stack);
process.exit(1);
});