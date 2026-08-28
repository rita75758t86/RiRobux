const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;

const PRICE_PER_ROBUX = 0.76;

const REFERRAL_DISCOUNT = 5;
const REFERRAL_BONUS_ROBUX = 15;


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

app.use(express.json());

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


/* =========================================================
   ПАПКА DATA
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


if (
    !fs.existsSync(dataDir)
) {
    fs.mkdirSync(
        dataDir,
        {
            recursive: true
        }
    );
}


if (
    !fs.existsSync(usersFile)
) {
    fs.writeFileSync(
        usersFile,
        "[]",
        "utf8"
    );
}


if (
    !fs.existsSync(accountsFile)
) {
    fs.writeFileSync(
        accountsFile,
        "[]",
        "utf8"
    );
}


/* =========================================================
   JSON
========================================================= */

function readJson(file) {

    try {

        const data =
            fs.readFileSync(
                file,
                "utf8"
            );

        const parsed =
            JSON.parse(data);

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


/* =========================================================
   ORDERS
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


function normalizeOrder(
    order
) {

    if (
        !Array.isArray(
            order.messages
        )
    ) {
        order.messages = [];
    }

    if (
        typeof order.hiddenForProfile !==
        "boolean"
    ) {
        order.hiddenForProfile = false;
    }

    if (
        typeof order.updatedAt !==
        "number"
    ) {
        order.updatedAt = Date.now();
    }

    if (
        typeof order.discountPercent !==
        "number"
    ) {
        order.discountPercent = 0;
    }

    if (
        typeof order.discountAmount !==
        "number"
    ) {
        order.discountAmount = 0;
    }

    if (
        typeof order.basePrice !==
        "number"
    ) {
        order.basePrice =
            Number(
                order.price || 0
            );
    }

    if (
        typeof order.promoCode !==
        "string"
    ) {
        order.promoCode = "";
    }

    if (
        typeof order.referralCode !==
        "string"
    ) {
        order.referralCode = "";
    }

    if (
        typeof order.referrerProfileId !==
        "string"
    ) {
        order.referrerProfileId = "";
    }

    if (
        typeof order.referralDiscount !==
        "number"
    ) {
        order.referralDiscount = 0;
    }

    if (
        typeof order.accountId !==
        "string"
    ) {
        order.accountId = "";
    }

    return order;

}


/* =========================================================
   ACCOUNTS
========================================================= */

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
   ID
========================================================= */

function createId(
    prefix
) {

    return (
        prefix +
        "-" +
        Date.now() +
        "-" +
        crypto.randomBytes(5).toString("hex")
    );

}


/* =========================================================
   DATE
========================================================= */

function currentDate() {

    return new Date()
        .toLocaleString(
            "ru-RU"
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
                crypto.randomBytes(
                    16
                ).toString(
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
        (
            resolve,
            reject
        ) => {

            try {

                const parts =
                    String(
                        storedHash
                    ).split(
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

                        if (error) {
                            reject(error);
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
   SESSIONS
========================================================= */

const sessions =
    new Map();


function createSession(
    accountId
) {

    const token =
        crypto.randomBytes(
            32
        ).toString(
            "hex"
        );

    sessions.set(
        token,
        {
            accountId,
            createdAt:
                Date.now()
        }
    );

    return token;

}


function getSessionAccount(
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

    const token =
        header.slice(
            7
        ).trim();

    if (!token) {
        return null;
    }

    const session =
        sessions.get(
            token
        );

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
        ) ||
        null
    );

}


function requireAuth(
    req,
    res,
    next
) {

    const account =
        getSessionAccount(
            req
        );

    if (!account) {

        return res
            .status(401)
            .json({
                error:
                    "Необходим вход в аккаунт RiRobux"
            });

    }

    req.account =
        account;

    next();

}


/* =========================================================
   AUTH — REGISTER
========================================================= */

app.post(
    "/api/auth/register",
    async (
        req,
        res
    ) => {

        try {

            const {
                username,
                robloxUsername,
                password
            } = req.body;


            const cleanUsername =
                String(
                    username || ""
                ).trim();


            const cleanRoblox =
                String(
                    robloxUsername || ""
                ).trim();


            const cleanPassword =
                String(
                    password || ""
                );


            if (
                cleanUsername.length <
                3
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Никнейм RiRobux должен содержать минимум 3 символа"
                    });

            }


            if (
                cleanUsername.length >
                30
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Слишком длинный никнейм"
                    });

            }


            if (
                !/^[a-zA-Z0-9_.-]+$/.test(
                    cleanUsername
                )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "В никнейме разрешены только буквы, цифры, _, - и ."
                    });

            }


            if (
                !cleanRoblox ||
                cleanRoblox.length >
                40
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Введите правильный Roblox Username"
                    });

            }


            if (
                cleanPassword.length <
                6
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Пароль должен содержать минимум 6 символов"
                    });

            }


            const accounts =
                getAccounts();


            const usernameExists =
                accounts.some(
                    account =>
                        account.username.toLowerCase() ===
                        cleanUsername.toLowerCase()
                );


            if (
                usernameExists
            ) {

                return res
                    .status(409)
                    .json({
                        error:
                            "Такой никнейм RiRobux уже занят"
                    });

            }


            const passwordHash =
                await hashPassword(
                    cleanPassword
                );


            const account = {

                id:
                    createId(
                        "account"
                    ),

                username:
                    cleanUsername,

                robloxUsername:
                    cleanRoblox,

                passwordHash,

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
                    account.id
                );


            return res.json({

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

        } catch (error) {

            console.error(
                "Ошибка регистрации:",
                error
            );

            return res
                .status(500)
                .json({
                    error:
                        "Ошибка регистрации"
                });

        }

    }
);


/* =========================================================
   AUTH — LOGIN
========================================================= */

app.post(
    "/api/auth/login",
    async (
        req,
        res
    ) => {

        try {

            const {
                username,
                password
            } = req.body;


            const cleanUsername =
                String(
                    username || ""
                ).trim();


            const cleanPassword =
                String(
                    password || ""
                );


            const accounts =
                getAccounts();


            const account =
                accounts.find(
                    item =>
                        item.username.toLowerCase() ===
                        cleanUsername.toLowerCase()
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
                    cleanPassword,
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
                    account.id
                );


            return res.json({

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

        } catch (error) {

            console.error(
                "Ошибка входа:",
                error
            );

            return res
                .status(500)
                .json({
                    error:
                        "Ошибка входа"
                });

        }

    }
);


/* =========================================================
   AUTH — ME
========================================================= */

app.get(
    "/api/auth/me",
    requireAuth,
    (
        req,
        res
    ) => {

        return res.json({

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
   AUTH — LOGOUT
========================================================= */

app.post(
    "/api/auth/logout",
    (
        req,
        res
    ) => {

        const header =
            req.headers.authorization ||
            "";

        if (
            header.startsWith(
                "Bearer "
            )
        ) {

            const token =
                header.slice(
                    7
                ).trim();

            sessions.delete(
                token
            );

        }

        return res.json({
            success:
                true
        });

    }
);


/* =========================================================
   ПРОМОКОД
========================================================= */

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
        ] ||
        0
    );

}


/* =========================================================
   REFFERAL
========================================================= */

function generateReferralCode(
    profileId
) {

    const clean =
        String(
            profileId
        )
            .replace(
                /[^a-zA-Z0-9]/g,
                ""
            )
            .toUpperCase();

    return (
        "RI" +
        clean.slice(
            -7
        )
    );

}


function findProfileByReferralCode(
    users,
    referralCode
) {

    const normalized =
        String(
            referralCode || ""
        )
            .trim()
            .toUpperCase();


    if (!normalized) {
        return null;
    }


    const order =
        users.find(
            item =>
                String(
                    item.myReferralCode ||
                    ""
                ).toUpperCase() ===
                normalized
        );


    if (!order) {
        return null;
    }


    return {

        profileId:
            order.profileId,

        referralCode:
            order.myReferralCode

    };

}


function getProfileOrders(
    users,
    profileId
) {

    return users.filter(
        order =>
            String(
                order.profileId
            ) ===
            String(
                profileId
            )
    );

}


/* =========================================================
   ЦЕНА
========================================================= */

function calculatePrice(
    robux,
    promoCode = "",
    referralApplied = false
) {

    const amount =
        Math.floor(
            Number(
                robux
            )
        );


    const basePrice =
        Math.round(
            amount *
            PRICE_PER_ROBUX *
            100
        ) / 100;


    const promoPercent =
        getPromoDiscount(
            promoCode
        );


    const promoAmount =
        Math.round(
            basePrice *
            promoPercent /
            100 *
            100
        ) / 100;


    let afterPromo =
        basePrice -
        promoAmount;


    let referralAmount =
        0;


    /*
    Реферальная скидка не суммируется
    с промокодом.
    */

    if (
        referralApplied &&
        promoPercent === 0
    ) {

        referralAmount =
            Math.round(
                afterPromo *
                REFERRAL_DISCOUNT /
                100 *
                100
            ) / 100;

    }


    const finalPrice =
        Math.round(
            (
                afterPromo -
                referralAmount
            ) *
            100
        ) / 100;


    return {

        basePrice,

        promoPercent,

        promoAmount,

        referralAmount,

        finalPrice

    };

}


/* =========================================================
   ПРОВЕРКА ПРОМО
========================================================= */

app.post(
    "/api/promos/validate",
    (
        req,
        res
    ) => {

        const {
            code,
            robux
        } = req.body;


        const amount =
            Math.floor(
                Number(
                    robux
                )
            );


        if (
            !code ||
            !Number.isFinite(
                amount
            ) ||
            amount < 1
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Неверные данные"
                });

        }


        const normalized =
            normalizePromoCode(
                code
            );


        const discount =
            getPromoDiscount(
                normalized
            );


        if (
            discount <= 0
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Такого промокода нет"
                });

        }


        const price =
            calculatePrice(
                amount,
                normalized,
                false
            );


        return res.json({

            success:
                true,

            promoCode:
                normalized,

            discountPercent:
                price.promoPercent,

            basePrice:
                price.basePrice,

            discountAmount:
                price.promoAmount,

            finalPrice:
                price.finalPrice

        });

    }
);


/* =========================================================
   РЕФЕРАЛЬНАЯ ИНФОРМАЦИЯ
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


        const orders =
            users.filter(
                order =>
                    String(
                        order.accountId
                    ) ===
                    String(
                        req.account.id
                    )
            );


        let profileId = "";


        if (
            orders.length > 0 &&
            orders[0].profileId
        ) {

            profileId =
                orders[0].profileId;

        } else {

            profileId =
                req.account.id;

        }


        const referralCode =
            generateReferralCode(
                profileId
            );


        const invited =
            users.filter(
                order =>
                    String(
                        order.referrerProfileId
                    ) ===
                    String(
                        profileId
                    )
            );


        let bonus =
            0;


        orders.forEach(
            order => {

                bonus +=
                    Number(
                        order.referralBonus ||
                        0
                    );

            }
        );


        return res.json({

            referralCode,

            referralLink:
                `https://rirobux.onrender.com/?ref=${encodeURIComponent(
                    referralCode
                )}`,

            invitedCount:
                invited.length,

            bonusRobux:
                bonus,

            invitedDiscount:
                REFERRAL_DISCOUNT

        });

    }
);


/* =========================================================
   СОЗДАНИЕ ЗАКАЗА
========================================================= */

app.post(
    "/api/users",
    requireAuth,
    (
        req,
        res
    ) => {

        const {
            username,
            robux,
            profileId,
            promoCode,
            referralCode
        } = req.body;


        const amount =
            Math.floor(
                Number(
                    robux
                )
            );


        if (
            !username ||
            !String(
                username
            ).trim()
        ) {

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


        const buyerProfileId =
            String(
                profileId ||
                req.account.id
            );


        let referralApplied =
            false;


        let referrerProfileId =
            "";


        const referrer =
            findProfileByReferralCode(
                users,
                referralCode
            );


        const buyerOrders =
            users.filter(
                order =>
                    String(
                        order.accountId
                    ) ===
                    String(
                        req.account.id
                    )
            );


        if (
            referrer &&
            String(
                referrer.profileId
            ) !==
            buyerProfileId &&
            buyerOrders.length === 0
        ) {

            referralApplied =
                true;

            referrerProfileId =
                String(
                    referrer.profileId
                );

        }


        const normalizedPromo =
            normalizePromoCode(
                promoCode
            );


        const price =
            calculatePrice(
                amount,
                normalizedPromo,
                referralApplied
            );


        const myReferralCode =
            generateReferralCode(
                buyerProfileId
            );


        const order = {

            id:
                createId(
                    "order"
                ),

            orderNumber:
                1000 +
                users.length +
                1,

            accountId:
                req.account.id,

            profileId:
                buyerProfileId,

            username:
                String(
                    username
                ).trim(),

            robux:
                amount,

            price:
                price.finalPrice,

            basePrice:
                price.basePrice,

            discountPercent:
                price.promoPercent,

            discountAmount:
                (
                    price.promoAmount +
                    price.referralAmount
                ),

            promoCode:
                price.promoPercent > 0
                    ? normalizedPromo
                    : "",

            referralCode:
                referralApplied
                    ? String(
                        referralCode
                    )
                        .trim()
                        .toUpperCase()
                    : "",

            referrerProfileId:
                referralApplied
                    ? referrerProfileId
                    : "",

            referralDiscount:
                referralApplied
                    ? price.referralAmount
                    : 0,

            myReferralCode,

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
        Бонус пригласившему.
        */

        if (
            referralApplied &&
            referrerProfileId
        ) {

            users.forEach(
                item => {

                    if (
                        String(
                            item.accountId
                        ) ===
                        String(
                            referrerProfileId
                        ) ||
                        String(
                            item.profileId
                        ) ===
                        String(
                            referrerProfileId
                        )
                    ) {

                        item.referralBonus =
                            Number(
                                item.referralBonus ||
                                0
                            ) +
                            REFERRAL_BONUS_ROBUX;

                        item.referralCount =
                            Number(
                                item.referralCount ||
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


        return res.json(
            order
        );

    }
);


/* =========================================================
   ЗАКАЗЫ ТЕКУЩЕГО АККАУНТА
========================================================= */

app.get(
    "/api/my/orders",
    requireAuth,
    (
        req,
        res
    ) => {

        const users =
            getUsers();


        const orders =
            users.filter(
                order =>
                    String(
                        order.accountId
                    ) ===
                    String(
                        req.account.id
                    ) &&
                    !order.hiddenForProfile
            );


        return res.json(
            orders
        );

    }
);


/* =========================================================
   ВСЕ ЗАКАЗЫ — АДМИН
========================================================= */

app.get(
    "/api/users",
    (
        req,
        res
    ) => {

        /*
        Старый интерфейс админки использует
        этот endpoint.

        Авторизацию админки сейчас оставляем
        на существующем admin.html.
        */

        return res.json(
            getUsers()
        );

    }
);


/* =========================================================
   ОДИН ЗАКАЗ
========================================================= */

app.get(
    "/api/users/:id",
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


        return res.json(
            order
        );

    }
);


/* =========================================================
   СООБЩЕНИЯ
========================================================= */

app.post(
    "/api/users/:id/messages",
    (
        req,
        res
    ) => {

        const {
            text,
            sender
        } = req.body;


        if (
            !text ||
            !String(
                text
            ).trim()
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Введите сообщение"
                });

        }


        if (
            sender !== "user" &&
            sender !== "admin"
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Неверный отправитель"
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

            sender,

            text:
                String(
                    text
                ).trim(),

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


        return res.json(
            message
        );

    }
);


/* =========================================================
   УДАЛЕНИЕ СООБЩЕНИЯ
========================================================= */

app.delete(
    "/api/users/:orderId/messages/:messageId",
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


        order.messages =
            Array.isArray(
                order.messages
            )
                ? order.messages.filter(
                    message =>
                        String(
                            message.id
                        ) !==
                        String(
                            req.params.messageId
                        )
                )
                : [];


        order.updatedAt =
            Date.now();


        saveUsers(
            users
        );


        return res.json({
            success:
                true
        });

    }
);


/* =========================================================
   СТАТУС
========================================================= */

app.patch(
    "/api/users/:id/status",
    (
        req,
        res
    ) => {

        const {
            status
        } = req.body;


        const allowedStatuses = [

            "Новая заявка",
            "В работе",
            "Выполняется",
            "Выполнено",
            "Отменена"

        ];


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


        return res.json(
            order
        );

    }
);


/* =========================================================
   СКРЫТЬ
========================================================= */

app.post(
    "/api/users/:id/hide",
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


        return res.json({

            success:
                true

        });

    }
);


/* =========================================================
   ЗАПУСК
========================================================= */

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
            `👤 Серверная авторизация: включена`
        );

        console.log(
            `🔐 Пароли: crypto.scrypt`
        );

    }
);
