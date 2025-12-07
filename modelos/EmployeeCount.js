import mongoose from "mongoose";

const employeeCountSchema = new mongoose.Schema({
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    employee_count: Number
});

export default mongoose.model("EmployeeCount", employeeCountSchema);
