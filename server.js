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


/* =========================================================
   ПРОМОКОДЫ
========================================================= */

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


/* =========================================================
   EXPRESS
========================================================= */

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


/* =========================================================
   DATA
========================================================= */

const dataDir =
    path.join(
        __dirname,
        "data"
    );

const usersFile =
    path.join(
        dataDir,
        "users.json"
    );

const accountsFile =
    path.join(
        dataDir,
        "accounts.json"
    );

const sessionsFile =
    path.join(
        dataDir,
        "sessions.json"
    );


if (
    !fs.existsSync(
        dataDir
    )
) {

    fs.mkdirSync(
        dataDir,
        {
            recursive: true
        }
    );

}


if (
    !fs.existsSync(
        usersFile
    )
) {

    fs.writeFileSync(
        usersFile,
        "[]",
        "utf8"
    );

}


if (
    !fs.existsSync(
        accountsFile
    )
) {

    fs.writeFileSync(
        accountsFile,
        "[]",
        "utf8"
    );

}


if (
    !fs.existsSync(
        sessionsFile
    )
) {

    fs.writeFileSync(
        sessionsFile,
        "[]",
        "utf8"
    );

}


/* =========================================================
   JSON HELPERS
========================================================= */

function readJson(
    file
) {

    try {

        const raw =
            fs.readFileSync(
                file,
                "utf8"
            );

        const parsed =
            JSON.parse(
                raw
            );

        return Array.isArray(
            parsed
        )
            ? parsed
            : [];

    } catch {

        return [];

    }

}


function writeJson(
    file,
    data
) {

    const tempFile =
        file + ".tmp";


    fs.writeFileSync(
        tempFile,
        JSON.stringify(
            data,
            null,
            2
        ),
        "utf8"
    );


    fs.renameSync(
        tempFile,
        file
    );

}


/* =========================================================
   USERS / ACCOUNTS
========================================================= */

function getUsers() {

    return readJson(
        usersFile
    ).map(
        normalizeOrder
    );

}


function saveUsers(
    users
) {

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


function saveAccounts(
    accounts
) {

    writeJson(
        accountsFile,
        accounts
    );

}


/* =========================================================
   NORMALIZE ORDER
========================================================= */

function normalizeOrder(
    order
) {

    const result = {
        ...order
    };


    if (
        !Array.isArray(
            result.messages
        )
    ) {

        result.messages = [];

    }


    if (
        typeof result.hiddenForProfile !==
        "boolean"
    ) {

        result.hiddenForProfile =
            false;

    }


    if (
        typeof result.updatedAt !==
        "number"
    ) {

        result.updatedAt =
            Date.now();

    }


    if (
        typeof result.discountPercent !==
        "number"
    ) {

        result.discountPercent =
            0;

    }


    if (
        typeof result.discountAmount !==
        "number"
    ) {

        result.discountAmount =
            0;

    }


    if (
        typeof result.basePrice !==
        "number"
    ) {

        result.basePrice =
            Number(
                result.price ||
                0
            );

    }


    if (
        typeof result.promoCode !==
        "string"
    ) {

        result.promoCode =
            "";

    }


    if (
        typeof result.referralCode !==
        "string"
    ) {

        result.referralCode =
            "";

    }


    if (
        typeof result.referrerAccountId !==
        "string"
    ) {

        result.referrerAccountId =
            "";

    }


    if (
        typeof result.referralDiscount !==
        "number"
    ) {

        result.referralDiscount =
            0;

    }


    if (
        typeof result.referralBonus !==
        "number"
    ) {

        result.referralBonus =
            0;

    }


    if (
        typeof result.referralCount !==
        "number"
    ) {

        result.referralCount =
            0;

    }


    if (
        typeof result.accountId !==
        "string"
    ) {

        result.accountId =
            "";

    }


    return result;

}


/* =========================================================
   HELPERS
========================================================= */

function createId(
    prefix
) {

    return (
        prefix +
        "-" +
        Date.now() +
        "-" +
        crypto
            .randomBytes(
                6
            )
            .toString(
                "hex"
            )
    );

}


function currentDate() {

    return new Date()
        .toLocaleString(
            "ru-RU"
        );

}


function normalizePromoCode(
    code
) {

    return String(
        code || ""
    )
        .trim()
        .toUpperCase();

}


function getPromoDiscount(
    code
) {

    return (
        PROMO_CODES[
            normalizePromoCode(
                code
            )
        ] || 0
    );

}


/* =========================================================
   PASSWORD HASH
========================================================= */

function hashPassword(
    password
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const salt =
                crypto
                    .randomBytes(
                        16
                    )
                    .toString(
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

                    if (
                        error
                    ) {

                        reject(
                            error
                        );

                        return;

                    }


                    resolve(
                        salt +
                        ":" +
                        derivedKey
                            .toString(
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
        (
            resolve,
            reject
        ) => {

            try {

                const parts =
                    String(
                        storedHash ||
                        ""
                    )
                        .split(
                            ":"
                        );


                if (
                    parts.length !==
                    2
                ) {

                    resolve(
                        false
                    );

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

                        if (
                            error
                        ) {

                            reject(
                                error
                            );

                            return;

                        }


                        if (
                            storedKey.length !==
                            derivedKey.length
                        ) {

                            resolve(
                                false
                            );

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

                resolve(
                    false
                );

            }

        }
    );

}


/* =========================================================
   PERSISTENT SESSIONS
========================================================= */

function getSessions() {

    return readJson(
        sessionsFile
    );

}


function saveSessions(
    sessions
) {

    writeJson(
        sessionsFile,
        sessions
    );

}


function createSession(
    type,
    ownerId
) {

    const token =
        crypto
            .randomBytes(
                32
            )
            .toString(
                "hex"
            );


    const sessions =
        getSessions();


    sessions.push({

        token,

        type,

        ownerId,

        createdAt:
            Date.now(),

        lastUsedAt:
            Date.now()

    });


    saveSessions(
        sessions
    );


    return token;

}


function findSession(
    token
) {

    if (
        !token
    ) {

        return null;

    }


    const sessions =
        getSessions();


    return (
        sessions.find(
            session =>
                session.token ===
                token
        ) ||
        null
    );

}


function deleteSession(
    token
) {

    if (
        !token
    ) {

        return;

    }


    const sessions =
        getSessions();


    const filtered =
        sessions.filter(
            session =>
                session.token !==
                token
        );


    saveSessions(
        filtered
    );

}


function getBearerToken(
    req
) {

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


    return header
        .slice(7)
        .trim() ||
        null;

}


/* =========================================================
   BUYER AUTH
========================================================= */

function getBuyerFromRequest(
    req
) {

    const token =
        getBearerToken(
            req
        );


    const session =
        findSession(
            token
        );


    if (
        !session ||
        session.type !==
        "user"
    ) {

        return null;

    }


    const accounts =
        getAccounts();


    const account =
        accounts.find(
            item =>
                item.id ===
                session.ownerId
        );


    if (!account) {

        deleteSession(
            token
        );

        return null;

    }


    const sessions =
        getSessions();


    const current =
        sessions.find(
            item =>
                item.token ===
                token
        );


    if (current) {

        current.lastUsedAt =
            Date.now();

        saveSessions(
            sessions
        );

    }


    return account;

}


function requireAuth(
    req,
    res,
    next
) {

    const account =
        getBuyerFromRequest(
            req
        );


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


/* =========================================================
   ADMIN AUTH
========================================================= */

function isAdmin(
    req
) {

    const token =
        getBearerToken(
            req
        );


    const session =
        findSession(
            token
        );


    if (
        !session ||
        session.type !==
        "admin"
    ) {

        return false;

    }


    const sessions =
        getSessions();


    const current =
        sessions.find(
            item =>
                item.token ===
                token
        );


    if (current) {

        current.lastUsedAt =
            Date.now();

        saveSessions(
            sessions
        );

    }


    return true;

}


function requireAdmin(
    req,
    res,
    next
) {

    if (
        !isAdmin(
            req
        )
    ) {

        return res
            .status(401)
            .json({
                error:
                    "Требуется вход администратора"
            });

    }


    next();

}


/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post(
    "/api/admin/login",
    (
        req,
        res
    ) => {

        const password =
            String(
                req.body.password ||
                ""
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
            createSession(
                "admin",
                "admin"
            );


        res.json({

            success:
                true,

            token

        });

    }
);


/* =========================================================
   ADMIN ME
========================================================= */

app.get(
    "/api/admin/me",
    requireAdmin,
    (
        req,
        res
    ) => {

        res.json({

            admin:
                true

        });

    }
);


/* =========================================================
   ADMIN LOGOUT
========================================================= */

app.post(
    "/api/admin/logout",
    (
        req,
        res
    ) => {

        const token =
            getBearerToken(
                req
            );


        deleteSession(
            token
        );


        res.json({
            success:
                true
        });

    }
);


/* =========================================================
   REGISTER
========================================================= */

app.post(
    "/api/auth/register",
    async (
        req,
        res
    ) => {

        try {

            const username =
                String(
                    req.body.username ||
                    ""
                ).trim();


            const robloxUsername =
                String(
                    req.body.robloxUsername ||
                    ""
                ).trim();


            const password =
                String(
                    req.body.password ||
                    ""
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
                        username
                            .toLowerCase()
                );


            if (
                exists
            ) {

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
                createSession(
                    "user",
                    account.id
                );


            res.json({

                success:
                    true,

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

        } catch (
            error
        ) {

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


/* =========================================================
   LOGIN
========================================================= */

app.post(
    "/api/auth/login",
    async (
        req,
        res
    ) => {

        try {

            const username =
                String(
                    req.body.username ||
                    ""
                ).trim();


            const password =
                String(
                    req.body.password ||
                    ""
                );


            const account =
                getAccounts().find(
                    item =>
                        item.username
                            .toLowerCase() ===
                        username
                            .toLowerCase()
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
                createSession(
                    "user",
                    account.id
                );


            res.json({

                success:
                    true,

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

        } catch (
            error
        ) {

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


/* =========================================================
   ME
========================================================= */

app.get(
    "/api/auth/me",
    requireAuth,
    (
        req,
        res
    ) => {

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


/* =========================================================
   LOGOUT
========================================================= */

app.post(
    "/api/auth/logout",
    (
        req,
        res
    ) => {

        const token =
            getBearerToken(
                req
            );


        deleteSession(
            token
        );


        res.json({

            success:
                true

        });

    }
);


/* =========================================================
   REFERRALS
========================================================= */

app.get(
    "/api/referrals",
    requireAuth,
    (
        req,
        res
    ) => {

        const users =
            getUsers();


        const accountId =
            req.account.id;


        const referralCode =
            generateReferralCode(
                accountId
            );


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


        const bonusRobux =
            ownOrders.reduce(
                (
                    total,
                    order
                ) =>
                    total +
                    Number(
                        order.referralBonus ||
                        0
                    ),
                0
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

            bonusRobux,

            invitedDiscount:
                REFERRAL_DISCOUNT

        });

    }
);


function generateReferralCode(
    accountId
) {

    const clean =
        String(
            accountId ||
            ""
        )
            .replace(
                /[^a-zA-Z0-9]/g,
                ""
            )
            .toUpperCase();


    return (
        "RI" +
        clean.slice(
            -8
        )
    );

}


function findAccountByReferralCode(
    accounts,
    code
) {

    const normalized =
        String(
            code ||
            ""
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
                ) ===
                normalized
        ) ||
        null
    );

}


/* =========================================================
   CREATE ORDER
========================================================= */

app.post(
    "/api/users",
    requireAuth,
    (
        req,
        res
    ) => {

        try {

            const username =
                String(
                    req.body.username ||
                    ""
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
                !Number.isFinite(
                    amount
                ) ||
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


            const referrer =
                findAccountByReferralCode(
                    accounts,
                    referralCode
                );


            const referralApplied =
                !!referrer &&
                referrer.id !==
                    req.account.id &&
                buyerOrders.length ===
                    0;


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

        } catch (
            error
        ) {

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


/* =========================================================
   MY ORDERS
========================================================= */

app.get(
    "/api/my/orders",
    requireAuth,
    (
        req,
        res
    ) => {

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


/* =========================================================
   ALL ORDERS FOR ADMIN
========================================================= */

app.get(
    "/api/admin/orders",
    requireAdmin,
    (
        req,
        res
    ) => {

        res.json(
            getUsers()
        );

    }
);


/*
Старый endpoint админки.
Оставляем для совместимости.
*/

app.get(
    "/api/users",
    requireAdmin,
    (
        req,
        res
    ) => {

        res.json(
            getUsers()
        );

    }
);


/* =========================================================
   ONE ORDER
========================================================= */

app.get(
    "/api/users/:id",
    (
        req,
        res
    ) => {

        const admin =
            isAdmin(
                req
            );


        const account =
            getBuyerFromRequest(
                req
            );


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


/* =========================================================
   MESSAGES
========================================================= */

app.post(
    "/api/users/:id/messages",
    (
        req,
        res
    ) => {

        const admin =
            isAdmin(
                req
            );


        const account =
            getBuyerFromRequest(
                req
            );


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


        const text =
            String(
                req.body.text ||
                ""
            ).trim();


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


        if (
            !Array.isArray(
                order.messages
            )
        ) {

            order.messages =
                [];

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


/* =========================================================
   DELETE MESSAGE
========================================================= */

app.delete(
    "/api/users/:orderId/messages/:messageId",
    (
        req,
        res
    ) => {

        const admin =
            isAdmin(
                req
            );


        const account =
            getBuyerFromRequest(
                req
            );


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
            success:
                true
        });

    }
);


/* =========================================================
   ADMIN STATUS
========================================================= */

app.patch(
    "/api/users/:id/status",
    requireAdmin,
    (
        req,
        res
    ) => {

        const allowedStatuses = [

            "Новая заявка",
            "В работе",
            "Выполняется",
            "Выполнено",
            "Отменена"

        ];


        const status =
            String(
                req.body.status ||
                ""
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


/* =========================================================
   ADMIN HIDE
========================================================= */

app.post(
    "/api/users/:id/hide",
    requireAdmin,
    (
        req,
        res
    ) => {

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

            success:
                true

        });

    }
);


/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/api/health",
    (
        req,
        res
    ) => {

        res.json({

            ok:
                true,

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
                true,

            persistentSessions:
                true

        });

    }
);


/* =========================================================
   START
========================================================= */

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
            "💾 Постоянные сессии: включены"
        );

        console.log(
            "🔐 Пароли: crypto.scrypt"
        );

    }
);
