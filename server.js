from pathlib import Path

server = r'''const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const PRICE_PER_ROBUX = 0.76;
const REFERRAL_DISCOUNT = 5;
const REFERRAL_BONUS_ROBUX = 15;

/*
==================================================
АДМИН
На Render создай переменную:
ADMIN_PASSWORD = твой пароль
==================================================
*/
const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "123456";

/*
==================================================
ПРОМОКОДЫ
==================================================
*/
const PROMO_CODES = {
    RITA5: 5,
    RITA10: 10,
    RITA15: 15,
    RITA20: 20,
    RITA25: 25,
    RITA30: 30,
    RITA35: 35,
    RITA40: 40,
    RITA45: 45,
    RITA50: 50,

    ANGELIKA5: 5,
    ANGELIKA10: 10,
    ANGELIKA15: 15,
    ANGELIKA20: 20,
    ANGELIKA25: 25,
    ANGELIKA30: 30,
    ANGELIKA35: 35,
    ANGELIKA40: 40,
    ANGELIKA45: 45,
    ANGELIKA50: 50
};

app.use(express.json({ limit: "1mb" }));

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

/*
==================================================
DATA
==================================================
*/
const dataDir = path.join(
    __dirname,
    "data"
);

const usersFile = path.join(
    dataDir,
    "users.json"
);

const accountsFile = path.join(
    dataDir,
    "accounts.json"
);

if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, {
        recursive: true
    });
}

if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(
        usersFile,
        "[]",
        "utf8"
    );
}

if (!fs.existsSync(accountsFile)) {
    fs.writeFileSync(
        accountsFile,
        "[]",
        "utf8"
    );
}

/*
==================================================
JSON HELPERS
==================================================
*/
function readJson(file) {
    try {
        const raw = fs.readFileSync(
            file,
            "utf8"
        );

        const parsed = JSON.parse(raw);

        return Array.isArray(parsed)
            ? parsed
            : [];
    } catch {
        return [];
    }
}

function writeJson(file, data) {
    const tempFile = file + ".tmp";

    fs.writeFileSync(
        tempFile,
        JSON.stringify(data, null, 2),
        "utf8"
    );

    fs.renameSync(
        tempFile,
        file
    );
}

/*
==================================================
COMMON
==================================================
*/
function createId(prefix) {
    return (
        prefix +
        "-" +
        Date.now() +
        "-" +
        crypto
            .randomBytes(6)
            .toString("hex")
    );
}

function currentDate() {
    return new Date().toLocaleString(
        "ru-RU"
    );
}

function normalizeOrder(order) {
    const result = {
        ...order
    };

    if (!Array.isArray(result.messages)) {
        result.messages = [];
    }

    if (
        typeof result.hiddenForProfile !==
        "boolean"
    ) {
        result.hiddenForProfile = false;
    }

    if (
        typeof result.updatedAt !==
        "number"
    ) {
        result.updatedAt = Date.now();
    }

    if (
        typeof result.discountPercent !==
        "number"
    ) {
        result.discountPercent = 0;
    }

    if (
        typeof result.discountAmount !==
        "number"
    ) {
        result.discountAmount = 0;
    }

    if (
        typeof result.basePrice !==
        "number"
    ) {
        result.basePrice =
            Number(result.price || 0);
    }

    if (
        typeof result.promoCode !==
        "string"
    ) {
        result.promoCode = "";
    }

    if (
        typeof result.referralCode !==
        "string"
    ) {
        result.referralCode = "";
    }

    if (
        typeof result.referrerAccountId !==
        "string"
    ) {
        result.referrerAccountId = "";
    }

    if (
        typeof result.referralDiscount !==
        "number"
    ) {
        result.referralDiscount = 0;
    }

    if (
        typeof result.referralBonus !==
        "number"
    ) {
        result.referralBonus = 0;
    }

    if (
        typeof result.referralCount !==
        "number"
    ) {
        result.referralCount = 0;
    }

    if (
        typeof result.accountId !==
        "string"
    ) {
        result.accountId = "";
    }

    return result;
}

function getUsers() {
    return readJson(usersFile).map(
        normalizeOrder
    );
}

function saveUsers(users) {
    writeJson(
        usersFile,
        users
    );
}

function getAccounts() {
    return readJson(
        accountsFile
    );
}

function saveAccounts(accounts) {
    writeJson(
        accountsFile,
        accounts
    );
}

/*
==================================================
PASSWORD HASHING
==================================================
*/
function hashPassword(password) {
    return new Promise(
        (resolve, reject) => {
            const salt =
                crypto
                    .randomBytes(16)
                    .toString("hex");

            crypto.scrypt(
                password,
                salt,
                64,
                (error, derivedKey) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(
                        salt +
                        ":" +
                        derivedKey.toString("hex")
                    );
                }
            );
        }
    );
}

function verifyPassword(
    password,
    storedHash
) {
    return new Promise(
        (resolve, reject) => {
            try {
                const parts =
                    String(
                        storedHash || ""
                    ).split(":");

                if (parts.length !== 2) {
                    resolve(false);
                    return;
                }

                const salt = parts[0];
                const storedKey =
                    Buffer.from(
                        parts[1],
                        "hex"
                    );

                crypto.scrypt(
                    password,
                    salt,
                    64,
                    (
                        error,
                        derivedKey
                    ) => {
                        if (error) {
                            reject(error);
                            return;
                        }

                        if (
                            storedKey.length !==
                            derivedKey.length
                        ) {
                            resolve(false);
                            return;
                        }

                        resolve(
                            crypto.timingSafeEqual(
                                storedKey,
                                derivedKey
                            )
                        );
                    }
                );
            } catch {
                resolve(false);
            }
        }
    );
}

/*
==================================================
BUYER SESSIONS
==================================================
*/
const sessions = new Map();

function createUserSession(
    accountId
) {
    const token =
        crypto
            .randomBytes(32)
            .toString("hex");

    sessions.set(
        token,
        {
            accountId,
            createdAt: Date.now()
        }
    );

    return token;
}

function getBuyerFromRequest(req) {
    const header =
        req.headers.authorization ||
        "";

    if (
        !header.startsWith(
            "Bearer "
        )
    ) {
        return null;
    }

    const token =
        header.slice(7).trim();

    if (!token) {
        return null;
    }

    const session =
        sessions.get(token);

    if (!session) {
        return null;
    }

    const accounts =
        getAccounts();

    return (
        accounts.find(
            account =>
                account.id ===
                session.accountId
        ) || null
    );
}

function requireAuth(
    req,
    res,
    next
) {
    const account =
        getBuyerFromRequest(req);

    if (!account) {
        return res
            .status(401)
            .json({
                error:
                    "Требуется вход в аккаунт RiRobux"
            });
    }

    req.account = account;
    next();
}

/*
==================================================
ADMIN SESSIONS
==================================================
*/
const adminSessions = new Map();

function createAdminSession() {
    const token =
        crypto
            .randomBytes(32)
            .toString("hex");

    adminSessions.set(
        token,
        {
            createdAt: Date.now()
        }
    );

    return token;
}

function getAdminToken(req) {
    const header =
        req.headers.authorization ||
        "";

    if (
        !header.startsWith(
            "Bearer "
        )
    ) {
        return null;
    }

    const token =
        header.slice(7).trim();

    return token || null;
}

function isAdmin(req) {
    const token =
        getAdminToken(req);

    return (
        !!token &&
        adminSessions.has(token)
    );
}

function requireAdmin(
    req,
    res,
    next
) {
    if (!isAdmin(req)) {
        return res
            .status(401)
            .json({
                error:
                    "Требуется вход администратора"
            });
    }

    next();
}

/*
==================================================
ADMIN AUTH
==================================================
*/
app.post(
    "/api/admin/login",
    (req, res) => {
        const password =
            String(
                req.body.password || ""
            );

        if (
            password !==
            ADMIN_PASSWORD
        ) {
            return res
                .status(401)
                .json({
                    error:
                        "Неверный пароль"
                });
        }

        const token =
            createAdminSession();

        res.json({
            success: true,
            token
        });
    }
);

app.get(
    "/api/admin/me",
    requireAdmin,
    (req, res) => {
        res.json({
            admin: true
        });
    }
);

app.post(
    "/api/admin/logout",
    (req, res) => {
        const token =
            getAdminToken(req);

        if (token) {
            adminSessions.delete(
                token
            );
        }

        res.json({
            success: true
        });
    }
);

/*
==================================================
BUYER AUTH
==================================================
*/
app.post(
    "/api/auth/register",
    async (req, res) => {
        try {
            const username =
                String(
                    req.body.username || ""
                ).trim();

            const robloxUsername =
                String(
                    req.body.robloxUsername ||
                    ""
                ).trim();

            const password =
                String(
                    req.body.password || ""
                );

            if (
                username.length < 3 ||
                username.length > 30
            ) {
                return res
                    .status(400)
                    .json({
                        error:
                            "Никнейм должен содержать от 3 до 30 символов"
                    });
            }

            if (
                !/^[a-zA-Z0-9_.-]+$/.test(
                    username
                )
            ) {
                return res
                    .status(400)
                    .json({
                        error:
                            "В никнейме разрешены буквы, цифры, _, - и ."
                    });
            }

            if (
                !robloxUsername ||
                robloxUsername.length > 40
            ) {
                return res
                    .status(400)
                    .json({
                        error:
                            "Введите правильный Roblox Username"
                    });
            }

            if (
                password.length < 6
            ) {
                return res
                    .status(400)
                    .json({
                        error:
                            "Пароль RiRobux должен содержать минимум 6 символов"
                    });
            }

            const accounts =
                getAccounts();

            const exists =
                accounts.some(
                    account =>
                        account.username.toLowerCase() ===
                        username.toLowerCase()
                );

            if (exists) {
                return res
                    .status(409)
                    .json({
                        error:
                            "Такой никнейм RiRobux уже занят"
                    });
            }

            const passwordHash =
                await hashPassword(
                    password
                );

            const account = {
                id:
                    createId("account"),
                username,
                robloxUsername,
                passwordHash,
                createdAt:
                    currentDate(),
                createdTimestamp:
                    Date.now()
            };

            accounts.push(account);
            saveAccounts(accounts);

            const token =
                createUserSession(
                    account.id
                );

            res.json({
                success: true,
                token,
                user: {
                    id: account.id,
                    username:
                        account.username,
                    robloxUsername:
                        account.robloxUsername,
                    createdAt:
                        account.createdAt
                }
            });
        } catch (error) {
            console.error(
                "Ошибка регистрации:",
                error
            );

            res
                .status(500)
                .json({
                    error:
                        "Ошибка регистрации"
                });
        }
    }
);

app.post(
    "/api/auth/login",
    async (req, res) => {
        try {
            const username =
                String(
                    req.body.username || ""
                ).trim();

            const password =
                String(
                    req.body.password || ""
                );

            const accounts =
                getAccounts();

            const account =
                accounts.find(
                    item =>
                        item.username.toLowerCase() ===
                        username.toLowerCase()
                );

            if (!account) {
                return res
                    .status(401)
                    .json({
                        error:
                            "Неверный никнейм или пароль"
                    });
            }

            const valid =
                await verifyPassword(
                    password,
                    account.passwordHash
                );

            if (!valid) {
                return res
                    .status(401)
                    .json({
                        error:
                            "Неверный никнейм или пароль"
                    });
            }

            const token =
                createUserSession(
                    account.id
                );

            res.json({
                success: true,
                token,
                user: {
                    id: account.id,
                    username:
                        account.username,
                    robloxUsername:
                        account.robloxUsername,
                    createdAt:
                        account.createdAt
                }
            });
        } catch (error) {
            console.error(
                "Ошибка входа:",
                error
            );

            res
                .status(500)
                .json({
                    error:
                        "Ошибка входа"
                });
        }
    }
);

app.get(
    "/api/auth/me",
    requireAuth,
    (req, res) => {
        res.json({
            id: req.account.id,
            username:
                req.account.username,
            robloxUsername:
                req.account.robloxUsername,
            createdAt:
                req.account.createdAt
        });
    }
);

app.post(
    "/api/auth/logout",
    (req, res) => {
        const header =
            req.headers.authorization ||
            "";

        if (
            header.startsWith(
                "Bearer "
            )
        ) {
            sessions.delete(
                header.slice(7).trim()
            );
        }

        res.json({
            success: true
        });
    }
);

/*
==================================================
PROMO
==================================================
*/
function normalizePromoCode(code) {
    return String(
        code || ""
    )
        .trim()
        .toUpperCase();
}

function getPromoDiscount(code) {
    return (
        PROMO_CODES[
            normalizePromoCode(
                code
            )
        ] || 0
    );
}

app.post(
    "/api/promos/validate",
    (req, res) => {
        const amount =
            Math.floor(
                Number(
                    req.body.robux
                )
            );

        const normalized =
            normalizePromoCode(
                req.body.code
            );

        if (
            !Number.isFinite(amount) ||
            amount < 1 ||
            !normalized
        ) {
            return res
                .status(400)
                .json({
                    error:
                        "Неверные данные"
                });
        }

        const percent =
            getPromoDiscount(
                normalized
            );

        if (!percent) {
            return res
                .status(400)
                .json({
                    error:
                        "Такого промокода нет"
                });
        }

        const basePrice =
            Math.round(
                amount *
                PRICE_PER_ROBUX *
                100
            ) / 100;

        const discountAmount =
            Math.round(
                basePrice *
                percent /
                100 *
                100
            ) / 100;

        const finalPrice =
            Math.round(
                (basePrice -
                    discountAmount) *
                100
            ) / 100;

        res.json({
            success: true,
            promoCode:
                normalized,
            discountPercent:
                percent,
            basePrice,
            discountAmount,
            finalPrice
        });
    }
);

/*
==================================================
REFERRAL
==================================================
*/
function generateReferralCode(
    accountId
) {
    const clean =
        String(
            accountId
        )
            .replace(
                /[^a-zA-Z0-9]/g,
                ""
            )
            .toUpperCase();

    return (
        "RI" +
        clean.slice(-8)
    );
}

function findAccountByReferralCode(
    accounts,
    code
) {
    const normalized =
        String(
            code || ""
        )
            .trim()
            .toUpperCase();

    if (!normalized) {
        return null;
    }

    return (
        accounts.find(
            account =>
                generateReferralCode(
                    account.id
                ) === normalized
        ) || null
    );
}

app.get(
    "/api/referrals",
    requireAuth,
    (req, res) => {
        const users =
            getUsers();

        const accountId =
            req.account.id;

        const invited =
            users.filter(
                order =>
                    order.referrerAccountId ===
                    accountId
            );

        const ownOrders =
            users.filter(
                order =>
                    order.accountId ===
                    accountId
            );

        const bonus =
            ownOrders.reduce(
                (sum, order) =>
                    sum +
                    Number(
                        order.referralBonus ||
                        0
                    ),
                0
            );

        const referralCode =
            generateReferralCode(
                accountId
            );

        res.json({
            referralCode,

            referralLink:
                "https://rirobux.onrender.com/?ref=" +
                encodeURIComponent(
                    referralCode
                ),

            invitedCount:
                invited.length,

            bonusRobux:
                bonus,

            invitedDiscount:
                REFERRAL_DISCOUNT
        });
    }
);

/*
==================================================
CREATE ORDER
==================================================
*/
app.post(
    "/api/users",
    requireAuth,
    (req, res) => {
        try {
            const username =
                String(
                    req.body.username || ""
                ).trim();

            const amount =
                Math.floor(
                    Number(
                        req.body.robux
                    )
                );

            const promoCode =
                normalizePromoCode(
                    req.body.promoCode
                );

            const referralCode =
                String(
                    req.body.referralCode ||
                    ""
                )
                    .trim()
                    .toUpperCase();

            if (!username) {
                return res
                    .status(400)
                    .json({
                        error:
                            "Введите Roblox Username"
                    });
            }

            if (
                !Number.isFinite(amount) ||
                amount < 1
            ) {
                return res
                    .status(400)
                    .json({
                        error:
                            "Введите правильное количество Robux"
                    });
            }

            const users =
                getUsers();

            const accounts =
                getAccounts();

            const buyerOrders =
                users.filter(
                    order =>
                        order.accountId ===
                        req.account.id
                );

            const promoPercent =
                getPromoDiscount(
                    promoCode
                );

            /*
            Первый заказ может получить
            реферальную скидку 5%.
            */
            const referrer =
                findAccountByReferralCode(
                    accounts,
                    referralCode
                );

            const referralApplied =
                !!referrer &&
                referrer.id !==
                    req.account.id &&
                buyerOrders.length === 0;

            const basePrice =
                Math.round(
                    amount *
                    PRICE_PER_ROBUX *
                    100
                ) / 100;

            const promoAmount =
                Math.round(
                    basePrice *
                    promoPercent /
                    100 *
                    100
                ) / 100;

            let referralAmount = 0;

            if (
                referralApplied &&
                promoPercent === 0
            ) {
                referralAmount =
                    Math.round(
                        (basePrice -
                            promoAmount) *
                        REFERRAL_DISCOUNT /
                        100 *
                        100
                    ) / 100;
            }

            const finalPrice =
                Math.round(
                    (
                        basePrice -
                        promoAmount -
                        referralAmount
                    ) *
                    100
                ) / 100;

            const order = {
                id:
                    createId("order"),

                orderNumber:
                    1001 +
                    users.length,

                accountId:
                    req.account.id,

                profileId:
                    req.account.id,

                username,

                robux:
                    amount,

                basePrice,

                price:
                    finalPrice,

                discountPercent:
                    promoPercent,

                discountAmount:
                    promoAmount +
                    referralAmount,

                promoCode:
                    promoPercent > 0
                        ? promoCode
                        : "",

                referralCode:
                    referralApplied
                        ? referralCode
                        : "",

                referrerAccountId:
                    referralApplied
                        ? referrer.id
                        : "",

                referralDiscount:
                    referralAmount,

                myReferralCode:
                    generateReferralCode(
                        req.account.id
                    ),

                referralBonus:
                    0,

                referralCount:
                    0,

                status:
                    "Новая заявка",

                messages:
                    [],

                hiddenForProfile:
                    false,

                createdAt:
                    currentDate(),

                createdTimestamp:
                    Date.now(),

                updatedAt:
                    Date.now()
            };

            /*
            Начисляем приглашавшему
            15 Robux один раз за заказ.
            */
            if (referralApplied) {
                users.forEach(
                    oldOrder => {
                        if (
                            oldOrder.accountId ===
                            referrer.id
                        ) {
                            oldOrder.referralBonus =
                                Number(
                                    oldOrder.referralBonus ||
                                    0
                                ) +
                                REFERRAL_BONUS_ROBUX;

                            oldOrder.referralCount =
                                Number(
                                    oldOrder.referralCount ||
                                    0
                                ) +
                                1;
                        }
                    }
                );

                /*
                Если старых заказов нет,
                создаём отдельную запись
                бонуса в новом заказе-пригласителя
                не нужно: бонус отображается только
                через существующие данные профиля.
                */
            }

            users.push(order);

            saveUsers(users);

            res.json(order);
        } catch (error) {
            console.error(
                "Ошибка создания заказа:",
                error
            );

            res
                .status(500)
                .json({
                    error:
                        "Не удалось создать заказ"
                });
        }
    }
);

/*
==================================================
MY ORDERS
==================================================
*/
app.get(
    "/api/my/orders",
    requireAuth,
    (req, res) => {
        const users =
            getUsers();

        const orders =
            users.filter(
                order =>
                    order.accountId ===
                    req.account.id &&
                    !order.hiddenForProfile
            );

        res.json(orders);
    }
);

/*
==================================================
ADMIN ORDERS
==================================================
*/
app.get(
    "/api/admin/orders",
    requireAdmin,
    (req, res) => {
        res.json(
            getUsers()
        );
    }
);

/*
Совместимость с текущим admin.html
*/
app.get(
    "/api/users",
    requireAdmin,
    (req, res) => {
        res.json(
            getUsers()
        );
    }
);

/*
==================================================
GET ONE ORDER
==================================================
*/
app.get(
    "/api/users/:id",
    requireAuthOrAdmin,
    (req, res) => {
        const users =
            getUsers();

        const order =
            users.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!order) {
            return res
                .status(404)
                .json({
                    error:
                        "Заказ не найден"
                });
        }

        /*
        Обычный покупатель может открыть
        только свой заказ.
        */
        if (
            !isAdmin(req) &&
            order.accountId !==
                req.account.id
        ) {
            return res
                .status(403)
                .json({
                    error:
                        "Нет доступа к этому заказу"
                });
        }

        res.json(order);
    }
);

function requireAuthOrAdmin(
    req,
    res,
    next
) {
    if (isAdmin(req)) {
        next();
        return;
    }

    requireAuth(
        req,
        res,
        next
    );
}

/*
==================================================
MESSAGES
==================================================
*/
app.post(
    "/api/users/:id/messages",
    requireAuthOrAdmin,
    (req, res) => {
        const text =
            String(
                req.body.text || ""
            ).trim();

        const sender =
            req.body.sender ===
            "admin"
                ? "admin"
                : "user";

        if (!text) {
            return res
                .status(400)
                .json({
                    error:
                        "Введите сообщение"
                });
        }

        const users =
            getUsers();

        const order =
            users.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!order) {
            return res
                .status(404)
                .json({
                    error:
                        "Заказ не найден"
                });
        }

        if (
            !isAdmin(req) &&
            order.accountId !==
                req.account.id
        ) {
            return res
                .status(403)
                .json({
                    error:
                        "Нет доступа к этому чату"
                });
        }

        if (
            !Array.isArray(
                order.messages
            )
        ) {
            order.messages = [];
        }

        const message = {
            id:
                createId("message"),

            sender,

            text,

            createdAt:
                currentDate(),

            createdTimestamp:
                Date.now()
        };

        order.messages.push(
            message
        );

        order.updatedAt =
            Date.now();

        saveUsers(users);

        res.json(message);
    }
);

/*
==================================================
DELETE MESSAGE
==================================================
*/
app.delete(
    "/api/users/:orderId/messages/:messageId",
    requireAuthOrAdmin,
    (req, res) => {
        const users =
            getUsers();

        const order =
            users.find(
                item =>
                    item.id ===
                    req.params.orderId
            );

        if (!order) {
            return res
                .status(404)
                .json({
                    error:
                        "Заказ не найден"
                });
        }

        if (
            !isAdmin(req) &&
            order.accountId !==
                req.account.id
        ) {
            return res
                .status(403)
                .json({
                    error:
                        "Нет доступа"
                });
        }

        order.messages =
            Array.isArray(
                order.messages
            )
                ? order.messages.filter(
                    message =>
                        message.id !==
                        req.params.messageId
                )
                : [];

        order.updatedAt =
            Date.now();

        saveUsers(users);

        res.json({
            success: true
        });
    }
);

/*
==================================================
ADMIN STATUS
==================================================
*/
app.patch(
    "/api/users/:id/status",
    requireAdmin,
    (req, res) => {
        const allowed = [
            "Новая заявка",
            "В работе",
            "Выполняется",
            "Выполнено",
            "Отменена"
        ];

        const status =
            String(
                req.body.status || ""
            );

        if (
            !allowed.includes(status)
        ) {
            return res
                .status(400)
                .json({
                    error:
                        "Неверный статус"
                });
        }

        const users =
            getUsers();

        const order =
            users.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!order) {
            return res
                .status(404)
                .json({
                    error:
                        "Заказ не найден"
                });
        }

        order.status =
            status;

        order.updatedAt =
            Date.now();

        saveUsers(users);

        res.json(order);
    }
);

/*
==================================================
ADMIN HIDE
==================================================
*/
app.post(
    "/api/users/:id/hide",
    requireAdmin,
    (req, res) => {
        const users =
            getUsers();

        const order =
            users.find(
                item =>
                    item.id ===
                    req.params.id
            );

        if (!order) {
            return res
                .status(404)
                .json({
                    error:
                        "Заказ не найден"
                });
        }

        order.hiddenForProfile =
            true;

        order.updatedAt =
            Date.now();

        saveUsers(users);

        res.json({
            success: true
        });
    }
);

/*
==================================================
HEALTH CHECK
==================================================
*/
app.get(
    "/api/health",
    (req, res) => {
        res.json({
            ok: true,
            service: "RiRobux",
            pricePerRobux:
                PRICE_PER_ROBUX,
            promoCount:
                Object.keys(
                    PROMO_CODES
                ).length,
            auth: true,
            adminAuth: true
        });
    }
);

/*
==================================================
START
==================================================
*/
app.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `🚀 RiRobux запущен на порту ${PORT}`
        );

        console.log(
            `💎 Курс: 1 Robux = ${PRICE_PER_ROBUX} ₽`
        );

        console.log(
            `🎁 Промокодов: ${
                Object.keys(
                    PROMO_CODES
                ).length
            }`
        );

        console.log(
            "👤 Серверная авторизация: включена"
        );

        console.log(
            "👑 Защита админки: включена"
        );

        console.log(
            "🔐 Пароли: crypto.scrypt"
        );
    }
);
'''

path = Path("/mnt/data/server.js")
path.write_text(server, encoding="utf-8")
print(path)
