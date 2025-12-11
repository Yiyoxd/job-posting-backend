/**
 * importLocations.js — SAFE & MODULAR
 *
 * -------------------------------------------------------------------------
 * Creates OR replaces ONLY the 'locations' collection.
 * Does NOT drop the database and does NOT touch other collections.
 *
 * Structure:
 *   {
 *     _id: "C-<id>" | "S-<id>" | "CI-<id>",
 *     type: "country" | "state" | "city",
 *     name: String,
 *     country_id?: String,
 *     state_id?: String
 *   }
 *
 * Usage:
 *      node scripts/importLocations.js
 *      node scripts/importLocations.js --auto
 * -------------------------------------------------------------------------
 */

import fs from "fs";
import path from "path";
import mongoose from "mongoose";

import { connectDB } from "../connection/db.js";
import Location from "../models/Location.js";

import { logger } from "../utils/logger.js";
import { ProgressBar } from "../utils/progressBar.js";
import { createPromptFromArgs } from "../utils/prompt.js";


// -----------------------------------------------------------------------------
// CONFIG
// -----------------------------------------------------------------------------

const DATA_PATH = path.resolve("./data/locations/countries+states+cities.json");
const prompt = createPromptFromArgs(process.argv);


// -----------------------------------------------------------------------------
// MODULE 1 — Load Dataset
// -----------------------------------------------------------------------------

function loadDataset() {
    logger.section("Loading Dataset");

    if (!fs.existsSync(DATA_PATH)) {
        logger.error(`Dataset file not found: ${DATA_PATH}`);
        process.exit(1);
    }

    try {
        const raw = fs.readFileSync(DATA_PATH, "utf8");
        const json = JSON.parse(raw);

        logger.success(`Loaded ${json.length} countries.`);
        return json;

    } catch (err) {
        logger.error("Error parsing dataset JSON.");
        logger.error(err.message);
        process.exit(1);
    }
}


// -----------------------------------------------------------------------------
// MODULE 2 — Normalize into unified locations array
// -----------------------------------------------------------------------------

function normalize(raw) {
    logger.section("Normalizing dataset…");

    const locations = [];

    for (const c of raw) {
        // Country
        locations.push({
            _id: `C-${c.id}`,
            type: "country",
            name: c.name.trim(),
        });

        if (!Array.isArray(c.states)) continue;

        for (const s of c.states) {
            // State
            locations.push({
                _id: `S-${s.id}`,
                type: "state",
                name: s.name.trim(),
                country_id: `C-${c.id}`,
            });

            if (!Array.isArray(s.ccities)) {
                if (!Array.isArray(s.cities)) continue;
            }

            // Cities
            const citiesArray = s.cities || s.cities;
            for (const ct of citiesArray) {
                locations.push({
                    _id: `CI-${ct.id}`,
                    type: "city",
                    name: ct.name.trim(),
                    country_id: `C-${c.id}`,
                    state_id: `S-${s.id}`,
                });
            }
        }
    }

    logger.success(`Total locations generated: ${locations.length}`);
    return locations;
}


// -----------------------------------------------------------------------------
// MODULE 3 — Drop ONLY the locations collection
// -----------------------------------------------------------------------------

async function clearLocationsCollection() {
    logger.section("Clearing 'locations' collection…");

    try {
        await Location.collection.drop();
        logger.success("'locations' collection dropped.");
    } catch (err) {
        if (err.code === 26) {
            logger.warn("'locations' collection does not exist. Creating new one…");
        } else {
            throw err;
        }
    }
}


// -----------------------------------------------------------------------------
// MODULE 4 — Insert locations in batches
// -----------------------------------------------------------------------------

async function insertLocations(locations) {
    logger.section("Inserting locations…");

    const CHUNK = 5000;
    const bar = new ProgressBar(locations.length);

    for (let i = 0; i < locations.length; i += CHUNK) {
        const batch = locations.slice(i, i + CHUNK);
        await Location.insertMany(batch);
        bar.update(Math.min(i + CHUNK, locations.length));
    }

    bar.finish();
    logger.success("Locations imported successfully.");
}


// -----------------------------------------------------------------------------
// MAIN
// -----------------------------------------------------------------------------

async function main() {
    logger.section("Unified Location Importer — SAFE MODE");

    await connectDB();

    const raw = loadDataset();
    const normalized = normalize(raw);

    const confirmed = await prompt.confirm(
        "This will DELETE ONLY the 'locations' collection and re-import. Continue? (y/N): "
    );

    if (!confirmed) {
        logger.warn("Process cancelled.");
        process.exit(0);
    }

    await clearLocationsCollection();
    await insertLocations(normalized);

    logger.section("DONE");
    logger.success("Collection 'locations' recreated & populated.");
    process.exit(0);
}

main();
