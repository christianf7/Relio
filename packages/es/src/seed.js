"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var client_2 = require("./client");
var indices_1 = require("./indices");
var sync_1 = require("./sync");
var prisma = new client_1.PrismaClient({ log: ["error"] });
function seedUsers() {
    return __awaiter(this, void 0, void 0, function () {
        var users, _i, users_1, user;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!client_2.es)
                        throw new Error("ES client not available");
                    return [4 /*yield*/, prisma.user.findMany({
                            select: {
                                id: true,
                                name: true,
                                displayName: true,
                                bio: true,
                                enrolledUnits: true,
                                createdAt: true,
                                connections: { select: { id: true } },
                                connectedBy: { select: { id: true } },
                                upcomingEvents: { select: { id: true } },
                                organisedEvents: { select: { id: true } },
                            },
                        })];
                case 1:
                    users = _a.sent();
                    console.log("[ES Seed] Indexing ".concat(users.length, " users..."));
                    _i = 0, users_1 = users;
                    _a.label = 2;
                case 2:
                    if (!(_i < users_1.length)) return [3 /*break*/, 5];
                    user = users_1[_i];
                    return [4 /*yield*/, (0, sync_1.indexUser)(client_2.es, user)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    console.log("[ES Seed] Indexed ".concat(users.length, " users"));
                    return [2 /*return*/];
            }
        });
    });
}
function seedEvents() {
    return __awaiter(this, void 0, void 0, function () {
        var events, _i, events_1, event_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!client_2.es)
                        throw new Error("ES client not available");
                    return [4 /*yield*/, prisma.event.findMany({
                            include: {
                                organisers: { select: { id: true, name: true } },
                                participants: { select: { id: true } },
                            },
                        })];
                case 1:
                    events = _a.sent();
                    console.log("[ES Seed] Indexing ".concat(events.length, " events..."));
                    _i = 0, events_1 = events;
                    _a.label = 2;
                case 2:
                    if (!(_i < events_1.length)) return [3 /*break*/, 5];
                    event_1 = events_1[_i];
                    return [4 /*yield*/, (0, sync_1.indexEvent)(client_2.es, event_1)];
                case 3:
                    _a.sent();
                    _a.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    console.log("[ES Seed] Indexed ".concat(events.length, " events"));
                    return [2 /*return*/];
            }
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var usersExists, eventsExists;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!client_2.es) {
                        console.error("[ES Seed] ES client not available – check env vars");
                        process.exit(1);
                    }
                    return [4 /*yield*/, client_2.es.indices.exists({ index: indices_1.USERS_INDEX })];
                case 1:
                    usersExists = _a.sent();
                    return [4 /*yield*/, client_2.es.indices.exists({ index: indices_1.EVENTS_INDEX })];
                case 2:
                    eventsExists = _a.sent();
                    if (!usersExists || !eventsExists) {
                        console.error("[ES Seed] Indices not found. Run `pnpm -F @acme/es ensure-indices` first.");
                        process.exit(1);
                    }
                    return [4 /*yield*/, seedUsers()];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, seedEvents()];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, client_2.es.indices.refresh({ index: [indices_1.USERS_INDEX, indices_1.EVENTS_INDEX] })];
                case 5:
                    _a.sent();
                    console.log("[ES Seed] Done");
                    process.exit(0);
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(function (err) {
    console.error("[ES Seed] Failed:", err);
    process.exit(1);
});
