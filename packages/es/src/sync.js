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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexUser = indexUser;
exports.indexEvent = indexEvent;
exports.removeDocument = removeDocument;
exports.updateEventParticipants = updateEventParticipants;
exports.updateUserConnections = updateUserConnections;
exports.updateUserEvents = updateUserEvents;
var indices_1 = require("./indices");
function safeLog(msg) {
    if (process.env.NODE_ENV !== "production") {
        console.log(msg);
    }
}
function indexUser(client, user) {
    return __awaiter(this, void 0, void 0, function () {
        var units, doc;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    units = Array.isArray(user.enrolledUnits)
                        ? user.enrolledUnits
                        : [];
                    doc = {
                        id: user.id,
                        name: user.name,
                        displayName: user.displayName,
                        bio: user.bio,
                        unitCodes: units.map(function (u) { return u.code; }),
                        unitUniversities: __spreadArray([], new Set(units.map(function (u) { return u.university; })), true),
                        connectionIds: __spreadArray([], new Set(__spreadArray(__spreadArray([], user.connections.map(function (c) { return c.id; }), true), user.connectedBy.map(function (c) { return c.id; }), true)), true),
                        upcomingEventIds: user.upcomingEvents.map(function (e) { return e.id; }),
                        organisedEventIds: user.organisedEvents.map(function (e) { return e.id; }),
                        createdAt: user.createdAt.toISOString(),
                    };
                    return [4 /*yield*/, client.index({
                            index: indices_1.USERS_INDEX,
                            id: user.id,
                            document: doc,
                        })];
                case 1:
                    _a.sent();
                    safeLog("[ES] Indexed user ".concat(user.id));
                    return [2 /*return*/];
            }
        });
    });
}
function indexEvent(client, event) {
    return __awaiter(this, void 0, void 0, function () {
        var doc;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    doc = {
                        id: event.id,
                        title: event.title,
                        location: event.location,
                        content: event.content,
                        date: event.date.toISOString(),
                        bannerUrl: event.bannerUrl,
                        ticketUrl: event.ticketUrl,
                        organiserIds: event.organisers.map(function (o) { return o.id; }),
                        organiserNames: event.organisers.map(function (o) { return o.name; }),
                        participantIds: event.participants.map(function (p) { return p.id; }),
                        participantCount: event.participants.length,
                    };
                    return [4 /*yield*/, client.index({
                            index: indices_1.EVENTS_INDEX,
                            id: event.id,
                            document: doc,
                        })];
                case 1:
                    _a.sent();
                    safeLog("[ES] Indexed event ".concat(event.id));
                    return [2 /*return*/];
            }
        });
    });
}
function removeDocument(client, index, id) {
    return __awaiter(this, void 0, void 0, function () {
        var err_1;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, client.delete({ index: index, id: id })];
                case 1:
                    _b.sent();
                    safeLog("[ES] Deleted ".concat(index, "/").concat(id));
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _b.sent();
                    if (((_a = err_1 === null || err_1 === void 0 ? void 0 : err_1.meta) === null || _a === void 0 ? void 0 : _a.statusCode) === 404)
                        return [2 /*return*/];
                    throw err_1;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function updateEventParticipants(client, eventId, participantIds) {
    return __awaiter(this, void 0, void 0, function () {
        var err_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, client.update({
                            index: indices_1.EVENTS_INDEX,
                            id: eventId,
                            doc: {
                                participantIds: participantIds,
                                participantCount: participantIds.length,
                            },
                        })];
                case 1:
                    _b.sent();
                    return [3 /*break*/, 3];
                case 2:
                    err_2 = _b.sent();
                    if (((_a = err_2 === null || err_2 === void 0 ? void 0 : err_2.meta) === null || _a === void 0 ? void 0 : _a.statusCode) === 404)
                        return [2 /*return*/];
                    throw err_2;
                case 3: return [2 /*return*/];
            }
        });
    });
}
function updateUserConnections(client, userId, connectionIds) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, client.update({
                        index: indices_1.USERS_INDEX,
                        id: userId,
                        doc: { connectionIds: connectionIds },
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function updateUserEvents(client, userId, upcomingEventIds, organisedEventIds) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, client.update({
                        index: indices_1.USERS_INDEX,
                        id: userId,
                        doc: { upcomingEventIds: upcomingEventIds, organisedEventIds: organisedEventIds },
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
