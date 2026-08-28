const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;
const PRICE_PER_ROBUX = 0.76;

const REFERRAL_DISCOUNT = 5;
const REFERRAL_BONUS_ROBUX = 15;

const ADMIN_PASSWORD =
    process.env.ADMIN_PASSWORD || "123456";


/* =========================================
   ПРОМОКОДЫ
========================================= */

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


/* =========================================
   EXPRESS
========================================= */

app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


/* =========================================
   DATA
========================================= */

const dataDir =
    path.join(__dirname, "data");

const usersFile =
    path.join(dataDir, "users.json");

const accountsFile =
    path.join(dataDir, "accounts.json");


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


/* =========================================
   JSON
========================================= */

function readJson(file) {
    try {
        const data =
            JSON.parse(
                fs.readFileSync(
                    file,
                    "utf8"
                )
            );

        return Array.isArray(data)
            ? data
            : [];
    } catch {
        return [];
    }
}

function writeJson(file, data) {
    fs.writeFileSync(
        file,
        JSON.stringify(
            data,
            null,
            2
        ),
        "utf8"
    );
}

function getUsers() {
    return readJson(usersFile);
}

function saveUsers(users) {
    writeJson(
        usersFile,
        users
    );
}

function getAccounts() {
    return readJson(accountsFile);
}

function saveAccounts(accounts) {
    writeJson(
        accountsFile,
        accounts
    );
}


/* =========================================
   HELPERS
========================================= */

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
            normalizePromoCode(code)
        ] || 0
    );
}

function generateReferralCode(accountId) {
    const clean =
        String(accountId)
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


/* =========================================
   PASSWORD HASH
========================================= */

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
                (
                    error,
                    derivedKey
                ) => {

                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve(
                        salt +
                        ":" +
                        derivedKey.toString(
                            "hex"
                        )
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

                if (
                    parts.length !== 2
                ) {
                    resolve(false);
                    return;
                }

                const salt =
                    parts[0];

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


/* =========================================
   ПОКУПАТЕЛИ — СЕССИИ
========================================= */

const sessions =
    new Map();

function createUserSession(accountId) {
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

function getUserByToken(req) {
    const header =
        req.headers.authorization || "";

    if (
        !header.startsWith("Bearer ")
    ) {
        return null;
    }

    const token =
        header
            .slice(7)
            .trim();

    const session =
        sessions.get(token);

    if (!session) {
        return null;
    }

    return (
        getAccounts().find(
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
        getUserByToken(req);

    if (!account) {
        return res
            .status(401)
            .json({
                error:
                    "Требуется вход в аккаунт RiRobux"
            });
    }

    req.account =
        account;

    next();
}


/* =========================================
   АДМИН — СЕССИИ
========================================= */

const adminSessions =
    new Map();

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
        req.headers.authorization || "";

    if (
        !header.startsWith("Bearer ")
    ) {
        return null;
    }

    return header
        .slice(7)
        .trim();
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


/* =========================================
   АДМИН — ВХОД
========================================= */

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


/* =========================================
   РЕГИСТРАЦИЯ
========================================= */

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
                    req.body.robloxUsername || ""
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
                            "Введите Roblox Username"
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
                        account.username
                            .toLowerCase() ===
                        username.toLowerCase()
                );


            if (exists) {
                return res
                    .status(409)
                    .json({
                        error:
                            "Такой никнейм уже занят"
                    });
            }


            const account = {

                id:
                    createId(
                        "account"
                    ),

                username,

                robloxUsername,

                passwordHash:
                    await hashPassword(
                        password
                    ),

                createdAt:
                    currentDate(),

                createdTimestamp:
                    Date.now()

            };


            accounts.push(
                account
            );

            saveAccounts(
                accounts
            );


            const token =
                createUserSession(
                    account.id
                );


            res.json({

                success: true,

                token,

                user: {

                    id:
                        account.id,

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


/* =========================================
   ВХОД
========================================= */

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


            const account =
                getAccounts().find(
                    item =>
                        item.username
                            .toLowerCase() ===
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

                    id:
                        account.id,

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


/* =========================================
   ME
========================================= */

app.get(
    "/api/auth/me",
    requireAuth,
    (req, res) => {

        res.json({

            id:
                req.account.id,

            username:
                req.account.username,

            robloxUsername:
                req.account.robloxUsername,

            createdAt:
                req.account.createdAt

        });
    }
);


/* =========================================
   LOGOUT
========================================= */

app.post(
    "/api/auth/logout",
    (req, res) => {

        const header =
            req.headers.authorization || "";

        if (
            header.startsWith("Bearer ")
        ) {

            sessions.delete(
                header
                    .slice(7)
                    .trim()
            );
        }

        res.json({
            success: true
        });
    }
);


/* =========================================
   ПРОМОКОД
========================================= */

app.post(
    "/api/promos/validate",
    (req, res) => {

        const amount =
            Math.floor(
                Number(
                    req.body.robux
                )
            );

        const code =
            normalizePromoCode(
                req.body.code
            );


        if (
            !Number.isFinite(amount) ||
            amount < 1
        ) {
            return res
                .status(400)
                .json({
                    error:
                        "Неверное количество Robux"
                });
        }


        const discount =
            getPromoDiscount(
                code
            );


        if (!discount) {
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
                discount /
                100 *
                100
            ) / 100;


        const finalPrice =
            Math.round(
                (
                    basePrice -
                    discountAmount
                ) *
                100
            ) / 100;


        res.json({

            success: true,

            promoCode:
                code,

            discountPercent:
                discount,

            basePrice,

            discountAmount,

            finalPrice

        });
    }
);


/* =========================================
   РЕФЕРАЛЫ
========================================= */

app.get(
    "/api/referrals",
    requireAuth,
    (req, res) => {

        const users =
            getUsers();


        const code =
            generateReferralCode(
                req.account.id
            );


        const invited =
            users.filter(
                order =>
                    order.referrerAccountId ===
                    req.account.id
            );


        const ownOrders =
            users.filter(
                order =>
                    order.accountId ===
                    req.account.id
            );


        const bonus =
            ownOrders.reduce(
                (
                    total,
                    order
                ) =>
                    total +
                    Number(
                        order.referralBonus || 0
                    ),
                0
            );


        res.json({

            referralCode:
                code,

            referralLink:
                "https://rirobux.onrender.com/?ref=" +
                encodeURIComponent(
                    code
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


/* =========================================
   CREATE ORDER
========================================= */

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
                            "Неверное количество Robux"
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


            const referrer =
                accounts.find(
                    account =>
                        generateReferralCode(
                            account.id
                        ) ===
                        referralCode
                );


            const referralApplied =
                !!referrer &&
                referrer.id !==
                    req.account.id &&
                buyerOrders.length === 0;


            const promoPercent =
                getPromoDiscount(
                    promoCode
                );


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


            let referralAmount =
                0;


            if (
                referralApplied &&
                promoPercent === 0
            ) {

                referralAmount =
                    Math.round(
                        (
                            basePrice -
                            promoAmount
                        ) *
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
                    createId(
                        "order"
                    ),

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

                referralBonus:
                    0,

                referralCount:
                    0,

                myReferralCode:
                    generateReferralCode(
                        req.account.id
                    ),

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


            if (
                referralApplied
            ) {

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

            }


            users.push(
                order
            );


            saveUsers(
                users
            );


            res.json(
                order
            );

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


/* =========================================
   МОИ ЗАКАЗЫ
========================================= */

app.get(
    "/api/my/orders",
    requireAuth,
    (req, res) => {

        const orders =
            getUsers().filter(
                order =>
                    order.accountId ===
                    req.account.id &&
                    !order.hiddenForProfile
            );


        res.json(
            orders
        );
    }
);


/* =========================================
   АДМИН — ЗАКАЗЫ
========================================= */

app.get(
    "/api/users",
    requireAdmin,
    (req, res) => {

        res.json(
            getUsers()
        );
    }
);


/* =========================================
   ОДИН ЗАКАЗ
========================================= */

app.get(
    "/api/users/:id",
    (req, res) => {

        const admin =
            isAdmin(req);

        const account =
            getUserByToken(req);


        if (
            !admin &&
            !account
        ) {

            return res
                .status(401)
                .json({
                    error:
                        "Требуется авторизация"
                });
        }


        const order =
            getUsers().find(
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
            !admin &&
            order.accountId !==
            account.id
        ) {

            return res
                .status(403)
                .json({
                    error:
                        "Нет доступа к этому заказу"
                });

        }


        res.json(
            order
        );
    }
);


/* =========================================
   СООБЩЕНИЯ
========================================= */

app.post(
    "/api/users/:id/messages",
    (req, res) => {

        const admin =
            isAdmin(req);

        const account =
            getUserByToken(req);


        if (
            !admin &&
            !account
        ) {

            return res
                .status(401)
                .json({
                    error:
                        "Требуется авторизация"
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
            !admin &&
            order.accountId !==
            account.id
        ) {

            return res
                .status(403)
                .json({
                    error:
                        "Нет доступа к этому чату"
                });
        }


        const text =
            String(
                req.body.text || ""
            ).trim();


        if (!text) {

            return res
                .status(400)
                .json({
                    error:
                        "Введите сообщение"
                });
        }


        const message = {

            id:
                createId(
                    "message"
                ),

            sender:
                admin
                    ? "admin"
                    : "user",

            text,

            createdAt:
                currentDate(),

            createdTimestamp:
                Date.now()

        };


        if (
            !Array.isArray(
                order.messages
            )
        ) {

            order.messages = [];

        }


        order.messages.push(
            message
        );


        order.updatedAt =
            Date.now();


        saveUsers(
            users
        );


        res.json(
            message
        );
    }
);


/* =========================================
   УДАЛИТЬ СООБЩЕНИЕ
========================================= */

app.delete(
    "/api/users/:orderId/messages/:messageId",
    (req, res) => {

        const admin =
            isAdmin(req);

        const account =
            getUserByToken(req);


        if (
            !admin &&
            !account
        ) {

            return res
                .status(401)
                .json({
                    error:
                        "Требуется авторизация"
                });
        }


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
            !admin &&
            order.accountId !==
            account.id
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


        saveUsers(
            users
        );


        res.json({
            success: true
        });
    }
);


/* =========================================
   АДМИН — СТАТУС
========================================= */

app.patch(
    "/api/users/:id/status",
    requireAdmin,
    (req, res) => {

        const allowedStatuses = [
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
            !allowedStatuses.includes(
                status
            )
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


        saveUsers(
            users
        );


        res.json(
            order
        );
    }
);


/* =========================================
   АДМИН — СКРЫТЬ ЗАКАЗ
========================================= */

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


        saveUsers(
            users
        );


        res.json({
            success: true
        });
    }
);


/* =========================================
   HEALTH
========================================= */

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            ok: true,

            service:
                "RiRobux",

            pricePerRobux:
                PRICE_PER_ROBUX,

            promoCount:
                Object.keys(
                    PROMO_CODES
                ).length,

            auth:
                true,

            adminAuth:
                true

        });
    }
);


/* =========================================
   START
========================================= */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            "🚀 RiRobux запущен на порту " +
            PORT
        );

        console.log(
            "💎 Курс: 1 Robux = " +
            PRICE_PER_ROBUX +
            " ₽"
        );

        console.log(
            "🎁 Промокодов: " +
            Object.keys(
                PROMO_CODES
            ).length
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
