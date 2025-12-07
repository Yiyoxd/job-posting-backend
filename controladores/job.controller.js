import Job from "../modelos/Job.js";

export async function obtenerJobs(req, res) {
    const jobs = await Job.find().limit(50);
    res.json(jobs);
}
