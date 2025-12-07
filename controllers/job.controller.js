import Job from "../models/Job.js";

export async function getJobs(req, res) {
    try {
        const jobs = await Job.find().limit(50);
        res.json(jobs);
    } catch (err) {
        console.error("Error fetching jobs:", err.message);
        res.status(500).json({ error: "Internal server error" });
    }
}
