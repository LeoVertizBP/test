"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectPrisma = exports.deleteScanJob = exports.updateScanJob = exports.findScanJobs = exports.getScanJobById = exports.createScanJob = void 0;
var client_1 = require("../../generated/prisma/client");
var prisma = new client_1.PrismaClient();
/**
 * Creates a new scan job in the database.
 * @param data - The data for the new scan job. Requires status and source. Name, description, createdById, etc., are optional.
 * @returns The newly created scan job.
 */
var createScanJob = function (data) { return __awaiter(void 0, void 0, void 0, function () {
    var createdById, jobData, connections;
    return __generator(this, function (_a) {
        createdById = data.createdById, jobData = __rest(data, ["createdById"]);
        // Basic validation
        if (!jobData.status || !jobData.source) {
            throw new Error("Missing required fields for scan job creation (status, source).");
        }
        connections = __assign({}, jobData);
        if (createdById) {
            connections.users = { connect: { id: createdById } };
        }
        return [2 /*return*/, prisma.scan_jobs.create({
                data: connections,
            })];
    });
}); };
exports.createScanJob = createScanJob;
/**
 * Retrieves a single scan job by its unique ID.
 * @param id - The UUID of the scan job to retrieve.
 * @returns The scan job object or null if not found.
 */
var getScanJobById = function (id) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, prisma.scan_jobs.findUnique({
                where: { id: id },
                // Optionally include related data like targeted publishers/channels/products
                // include: { scan_job_publishers: true, scan_job_channels: true, scan_job_product_focus: true } // Renamed scan_job_affiliates
            })];
    });
}); };
exports.getScanJobById = getScanJobById;
/**
 * Retrieves scan jobs based on specified criteria (e.g., by status, source, creator).
 * TODO: Add pagination and more filtering options.
 * @param where - Prisma WhereInput object for filtering.
 * @returns An array of matching scan job objects.
 */
var findScanJobs = function (where) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, prisma.scan_jobs.findMany({
                where: where,
                orderBy: { created_at: 'desc' } // Often useful to see recent jobs first
            })];
    });
}); };
exports.findScanJobs = findScanJobs;
/**
 * Updates an existing scan job.
 * Commonly used to update status, start_time, end_time.
 * @param id - The UUID of the scan job to update.
 * @param data - An object containing the fields to update.
 * @returns The updated scan job object.
 */
var updateScanJob = function (id, data) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        return [2 /*return*/, prisma.scan_jobs.update({
                where: { id: id },
                data: data,
            })];
    });
}); };
exports.updateScanJob = updateScanJob;
/**
 * Deletes a scan job by its unique ID.
 * Use with caution, as this might orphan related data or break history depending on cascade rules.
 * Consider soft-delete (e.g., setting a status to 'deleted') instead.
 * @param id - The UUID of the scan job to delete.
 * @returns The deleted scan job object.
 */
var deleteScanJob = function (id) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        // Note: Deleting a scan job might cascade based on schema (e.g., delete related content_items, job targets).
        return [2 /*return*/, prisma.scan_jobs.delete({
                where: { id: id },
            })];
    });
}); };
exports.deleteScanJob = deleteScanJob;
// Optional: Disconnect Prisma client
var disconnectPrisma = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.disconnectPrisma = disconnectPrisma;
