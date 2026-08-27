import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import connectDB from "./db/connectdb.js";
import serverRoutes from "./routes/serverRoutes.js";
import freepbxService from "./services/freepbxService.js";
import { crm } from "./utils/logger.js";
import requestLogger from "./middlewares/requestLogger.js";

dotenv.config();


//Setup Express App
const app = express();

// Set up CORS
app.use(cors());

//Set Midleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

//HTTP access log
app.use(requestLogger);

// Load routes
app.use("/", serverRoutes);

// Get port from environment and store in Express.
const port = process.env.PORT || "5000";
app.listen(port, () => {
  crm.info(`Server listening at http://localhost:${port}`);
});


//Database Connection
const DATABASE_URL = process.env.DB_URL
const DB_NAME = process.env.DB_NAME
connectDB(DATABASE_URL, DB_NAME).then(() => {
    // Start the FreePBX AMI engine once MongoDB is reachable.
    // Failures here are logged, never fatal for the CRM itself.
    freepbxService.init();
});
