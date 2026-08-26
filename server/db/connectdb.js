import mongoose from "mongoose";
import User from '../model/User.js';
import bcrypt from 'bcrypt'
import { crm } from "../utils/logger.js";

const connectDB = async (DATABASE_URL,DB_NAME) => {
	try {
		const DB_OPTIONS = {
			dbName: DB_NAME
		}
		mongoose.set("strictQuery", false);
		await mongoose.connect(DATABASE_URL, DB_OPTIONS);
		let adminExisting = await User.find({ role: 'admin' });
		if (adminExisting.length <= 0) {
			const firstName = 'admin'
			const lastName = 'admin'
			const emailAddress = 'admin@gmail.com'
			const password = 'admin123'
			// Hash the password
			const hashedPassword = await bcrypt.hash(password, 10);
			// Create a new user
			const user = new User({ _id: new mongoose.Types.ObjectId('64d5bd3aca0be228afc9e267'), emailAddress, password: hashedPassword, firstName, lastName, role: 'admin' });
			// Save the user to the database
			await user.save();
			crm.info("Admin created successfully");
		} else if (adminExisting[0].deleted === true) {
			await User.findByIdAndUpdate(adminExisting[0]._id, { deleted: false });
			crm.info("Admin updated successfully");
		}
		crm.info("Database connected successfully");
	} catch (err) {
		crm.error("Database connection failed:", err);
	}
}

export default connectDB;
