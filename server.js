const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const PRICE_PER_ROBUX = 0.76;
const REFERRAL_DISCOUNT = 5; // скидка приглашённому на первый заказ
const REFERRAL_BONUS_ROBUX = 15; // бонус пригласившему

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

app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

const dataDir = path.join(
    __dirname,
    "data"
);

const usersFile = path.join(
    dataDir,
    "users.json"
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


/* =========================================
   БАЗА
========================================= */

function getUsers() {
    try {
        const raw = fs.readFileSync(
            usersFile,
            "utf8"
        );

        const users = JSON.parse(raw);

        if (!Array.isArray(users)) {
            return [];
        }

        return users.map(normalizeOrder);
    } catch (error) {
        console.error(
            "Ошибка чтения users.json:",
            error
        );

        return [];
    }
}

function saveUsers(users) {
    fs.writeFileSync(
        usersFile,
        JSON.stringify(
            users,
            null,
            2
        ),
        "utf8"
    );
}

function normalizeOrder(order) {
    if (!Array.isArray(order.messages)) {
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
            Number(order.price || 0);
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

    return order;
}

function createId(prefix) {
    return (
        prefix +
        "-" +
        Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .slice(2, 9)
    );
}

function currentDate() {
    return new Date().toLocaleString(
        "ru-RU"
    );
}


/* =========================================
   ПРОМОКОДЫ
========================================= */

function normalizePromoCode(code) {
    return String(code || "")
        .trim()
        .toUpperCase();
}

function getPromoDiscount(code) {
    const normalized =
        normalizePromoCode(code);

    return (
        PROMO_CODES[normalized] || 0
    );
}


/* =========================================
   РЕФЕРАЛЬНЫЕ КОДЫ
========================================= */

function generateReferralCode(
    profileId
) {
    const clean = String(
        profileId || ""
    )
        .replace(
            /[^a-zA-Z0-9]/g,
            ""
        )
        .toUpperCase();

    const tail =
        clean.slice(-6) ||
        Math.random()
            .toString(36)
            .slice(2, 8)
            .toUpperCase();

    return "RI" + tail;
}

function getOrdersByProfileId(
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

function getReferralCodeForProfile(
    users,
    profileId
) {
    const existingOrder =
        users.find(
            order =>
                String(
                    order.profileId
                ) ===
                String(
                    profileId
                ) &&
                order.myReferralCode
        );

    if (
        existingOrder &&
        existingOrder.myReferralCode
    ) {
        return existingOrder.myReferralCode;
    }

    return generateReferralCode(
        profileId
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
                    item.myReferralCode || ""
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


/* =========================================
   ЦЕНА
========================================= */

function calculatePrice(
    robux,
    promoCode = "",
    referralApplied = false
) {
    const amount =
        Math.floor(
            Number(robux)
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

    let priceAfterPromo =
        basePrice -
        promoAmount;

    let referralAmount = 0;

    if (
        referralApplied &&
        promoPercent === 0
    ) {
        referralAmount =
            Math.round(
                priceAfterPromo *
                REFERRAL_DISCOUNT /
                100 *
                100
            ) / 100;
    }

    const finalPrice =
        Math.round(
            (
                priceAfterPromo -
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


/* =========================================
   ПРОВЕРКА ПРОМОКОДА
========================================= */

app.post(
    "/api/promos/validate",
    (req, res) => {

        const {
            code,
            robux
        } = req.body;

        const amount =
            Math.floor(
                Number(robux)
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

        const discountPercent =
            getPromoDiscount(
                normalized
            );

        if (
            discountPercent <= 0
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


/* =========================================
   РЕФЕРАЛЬНАЯ ССЫЛКА
========================================= */

app.get(
    "/api/referrals/:profileId",
    (req, res) => {

        const profileId =
            String(
                req.params.profileId
            );

        const users =
            getUsers();

        const existing =
            getOrdersByProfileId(
                users,
                profileId
            );

        let referralCode;

        if (
            existing.length > 0
        ) {
            referralCode =
                getReferralCodeForProfile(
                    users,
                    profileId
                );

            let changed = false;

            existing.forEach(
                order => {

                    if (
                        !order.myReferralCode
                    ) {
                        order.myReferralCode =
                            referralCode;

                        changed = true;
                    }

                    if (
                        typeof order.referralBonus !==
                        "number"
                    ) {
                        order.referralBonus =
                            0;

                        changed = true;
                    }

                    if (
                        typeof order.referralCount !==
                        "number"
                    ) {
                        order.referralCount =
                            0;

                        changed = true;
                    }
                }
            );

            if (changed) {
                saveUsers(users);
            }
        } else {
            referralCode =
                generateReferralCode(
                    profileId
                );
        }

        const profileOrders =
            getOrdersByProfileId(
                users,
                profileId
            );

        const referralOrders =
            profileOrders.filter(
                order =>
                    order.referrerProfileId &&
                    order.referrerProfileId !==
                    profileId
            );

        const bonusHolder =
            profileOrders.find(
                order =>
                    typeof order.referralBonus ===
                    "number"
            );

        const referralBonus =
            bonusHolder
                ? Number(
                    bonusHolder.referralBonus
                )
                : 0;

        return res.json({
            profileId,
            referralCode,

            referralLink:
                `https://rirobux.onrender.com/?ref=${encodeURIComponent(
                    referralCode
                )}`,

            invitedCount:
                referralOrders.length,

            bonusRobux:
                referralBonus,

            invitedDiscount:
                REFERRAL_DISCOUNT
        });
    }
);


/* =========================================
   СОЗДАНИЕ ЗАКАЗА
========================================= */

app.post(
    "/api/users",
    (req, res) => {

        const {
            username,
            robux,
            profileId,
            promoCode,
            referralCode
        } = req.body;

        const amount =
            Math.floor(
                Number(robux)
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
                createId("profile")
            );

        const normalizedPromo =
            normalizePromoCode(
                promoCode
            );

        const normalizedReferral =
            String(
                referralCode || ""
            )
                .trim()
                .toUpperCase();

        const referrer =
            findProfileByReferralCode(
                users,
                normalizedReferral
            );

        let referralApplied =
            false;

        let referrerProfileId =
            "";

        /*
        Нельзя пригласить самого себя.
        */

        if (
            referrer &&
            String(
                referrer.profileId
            ) !==
            buyerProfileId
        ) {

            const buyerOrders =
                getOrdersByProfileId(
                    users,
                    buyerProfileId
                );

            /*
            Реферальная скидка
            только на первый заказ.
            */

            referralApplied =
                buyerOrders.length === 0;

            referrerProfileId =
                String(
                    referrer.profileId
                );

        }

        const price =
            calculatePrice(
                amount,
                normalizedPromo,
                referralApplied
            );

        const order = {

            id:
                createId("order"),

            orderNumber:
                1000 +
                users.length +
                1,

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
                price.promoAmount,

            promoCode:
                price.promoPercent > 0
                    ? normalizedPromo
                    : "",

            referralCode:
                referralApplied
                    ? normalizedReferral
                    : "",

            referrerProfileId:
                referralApplied
                    ? referrerProfileId
                    : "",

            referralDiscount:
                referralApplied
                    ? price.referralAmount
                    : 0,

            myReferralCode:
                generateReferralCode(
                    buyerProfileId
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

            updatedAt:
                Date.now()
        };

        /*
        Если у пользователя уже есть
        старый referralCode, используем его.
        */

        const oldProfileOrder =
            users.find(
                item =>
                    String(
                        item.profileId
                    ) ===
                    buyerProfileId &&
                    item.myReferralCode
            );

        if (
            oldProfileOrder &&
            oldProfileOrder.myReferralCode
        ) {
            order.myReferralCode =
                oldProfileOrder.myReferralCode;
        }

        /*
        Начисляем бонус пригласившему
        после создания первого заказа.
        */

        if (
            referralApplied &&
            referrerProfileId
        ) {

            users.forEach(
                item => {

                    if (
                        String(
                            item.profileId
                        ) ===
                        referrerProfileId
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


/* =========================================
   ВСЕ ЗАКАЗЫ
========================================= */

app.get(
    "/api/users",
    (req, res) => {

        return res.json(
            getUsers()
        );

    }
);


/* =========================================
   ЗАКАЗЫ ПРОФИЛЯ
========================================= */

app.get(
    "/api/profiles/:profileId/orders",
    (req, res) => {

        const users =
            getUsers();

        const orders =
            users.filter(
                order =>
                    String(
                        order.profileId
                    ) ===
                    String(
                        req.params.profileId
                    ) &&
                    !order.hiddenForProfile
            );

        return res.json(
            orders
        );
    }
);


/* =========================================
   ОДИН ЗАКАЗ
========================================= */

app.get(
    "/api/users/:id",
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

        return res.json(
            normalizeOrder(
                order
            )
        );
    }
);


/* =========================================
   БОТ
========================================= */

const botTimers =
    new Map();

function cancelBotTimer(
    orderId
) {
    const timer =
        botTimers.get(
            orderId
        );

    if (timer) {
        clearTimeout(timer);
        botTimers.delete(
            orderId
        );
    }
}

function createBotReply(
    text
) {

    const lower =
        String(
            text
        ).toLowerCase();

    if (
        lower.includes("привет") ||
        lower.includes("здравствуйте")
    ) {
        return "🤖 Здравствуйте! Сообщение передано продавцу.";
    }

    if (
        lower.includes("когда") ||
        lower.includes("сколько ждать") ||
        lower.includes("срок")
    ) {
        return "🤖 Ваш вопрос передан продавцу. Пожалуйста, ожидайте ответа.";
    }

    if (
        lower.includes("где заказ") ||
        lower.includes("где мой") ||
        lower.includes("не приш")
    ) {
        return "🤖 Продавец проверит ваш заказ и ответит вам.";
    }

    if (
        lower.includes("спасибо")
    ) {
        return "🤖 Пожалуйста! 💜";
    }

    return "🤖 Сообщение получено. Продавец обязательно его увидит.";
}

function scheduleBot(
    orderId,
    userMessageId
) {

    cancelBotTimer(
        orderId
    );

    const timer =
        setTimeout(
            () => {

                const users =
                    getUsers();

                const order =
                    users.find(
                        item =>
                            item.id ===
                            orderId
                    );

                if (!order) {
                    return;
                }

                if (
                    !Array.isArray(
                        order.messages
                    )
                ) {
                    order.messages = [];
                }

                const lastUserMessage =
                    [...order.messages]
                        .reverse()
                        .find(
                            message =>
                                message.sender ===
                                "user"
                        );

                if (!lastUserMessage) {
                    return;
                }

                if (
                    String(
                        lastUserMessage.id
                    ) !==
                    String(
                        userMessageId
                    )
                ) {
                    return;
                }

                const hasAdminReply =
                    order.messages.some(
                        message =>
                            message.sender ===
                                "admin" &&
                            Number(
                                message.createdTimestamp ||
                                0
                            ) >
                            Number(
                                lastUserMessage.createdTimestamp ||
                                0
                            )
                    );

                if (hasAdminReply) {
                    return;
                }

                const botAlreadyAnswered =
                    order.messages.some(
                        message =>
                            message.sender ===
                                "bot" &&
                            String(
                                message.replyTo
                            ) ===
                            String(
                                userMessageId
                            )
                    );

                if (
                    botAlreadyAnswered
                ) {
                    return;
                }

                order.messages.push({

                    id:
                        createId(
                            "bot"
                        ),

                    sender:
                        "bot",

                    isBot:
                        true,

                    replyTo:
                        userMessageId,

                    text:
                        createBotReply(
                            lastUserMessage.text
                        ),

                    createdAt:
                        currentDate(),

                    createdTimestamp:
                        Date.now()

                });

                order.updatedAt =
                    Date.now();

                saveUsers(
                    users
                );

            },
            2 * 60 * 1000
        );

    botTimers.set(
        orderId,
        timer
    );
}


/* =========================================
   СООБЩЕНИЯ
========================================= */

app.post(
    "/api/users/:id/messages",
    (req, res) => {

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
            order.messages = [];
        }

        const message = {

            id:
                createId(
                    "message"
                ),

            sender:
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

        if (
            sender === "admin"
        ) {
            cancelBotTimer(
                order.id
            );
        }

        saveUsers(
            users
        );

        if (
            sender === "user"
        ) {
            scheduleBot(
                order.id,
                message.id
            );
        }

        return res.json(
            message
        );
    }
);


/* =========================================
   УДАЛЕНИЕ СООБЩЕНИЯ
========================================= */

app.delete(
    "/api/users/:orderId/messages/:messageId",
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


/* =========================================
   ИЗМЕНЕНИЕ ЗАКАЗА
========================================= */

app.patch(
    "/api/users/:id",
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

        if (
            order.status !==
            "Новая заявка"
        ) {
            return res
                .status(400)
                .json({
                    error:
                        "Этот заказ уже нельзя изменить"
                });
        }

        const {
            username,
            robux
        } = req.body;

        if (
            username !==
            undefined
        ) {

            const name =
                String(
                    username
                ).trim();

            if (!name) {
                return res
                    .status(400)
                    .json({
                        error:
                            "Username не может быть пустым"
                    });
            }

            order.username =
                name;
        }

        if (
            robux !==
            undefined
        ) {

            const amount =
                Math.floor(
                    Number(
                        robux
                    )
                );

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
                            "Неверное количество Robux"
                    });
            }

            const price =
                calculatePrice(
                    amount,
                    order.promoCode || "",
                    false
                );

            order.robux =
                amount;

            order.basePrice =
                price.basePrice;

            order.price =
                price.finalPrice;
        }

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


/* =========================================
   ОТМЕНА
========================================= */

app.post(
    "/api/users/:id/cancel",
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

        if (
            order.status !==
            "Новая заявка"
        ) {
            return res
                .status(400)
                .json({
                    error:
                        "Этот заказ уже нельзя отменить"
                });
        }

        order.status =
            "Отменена";

        order.updatedAt =
            Date.now();

        cancelBotTimer(
            order.id
        );

        saveUsers(
            users
        );

        return res.json(
            order
        );
    }
);


/* =========================================
   СТАТУС
========================================= */

app.patch(
    "/api/users/:id/status",
    (req, res) => {

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


/* =========================================
   СКРЫТЬ ЗАКАЗ
========================================= */

app.post(
    "/api/users/:id/hide",
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

        return res.json({
            success:
                true
        });
    }
);


/* =========================================
   ЗАПУСК
========================================= */

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
            `👥 Реферальная скидка: ${REFERRAL_DISCOUNT}%`
        );

        console.log(
            `🎁 Реферальный бонус: ${REFERRAL_BONUS_ROBUX} Robux`
        );

    }
);
