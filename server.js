const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const PRICE_PER_ROBUX = 0.76;

/*
==================================================
ПРОМОКОДЫ
==================================================
20 промокодов:

RITA5       = 5%
RITA10      = 10%
RITA15      = 15%
RITA20      = 20%
RITA25      = 25%
RITA30      = 30%
RITA35      = 35%
RITA40      = 40%
RITA45      = 45%
RITA50      = 50%

ANGELIKA5   = 5%
ANGELIKA10  = 10%
ANGELIKA15  = 15%
ANGELIKA20  = 20%
ANGELIKA25  = 25%
ANGELIKA30  = 30%
ANGELIKA35  = 35%
ANGELIKA40  = 40%
ANGELIKA45  = 45%
ANGELIKA50  = 50%
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


app.use(express.json());

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


/*
==================================================
ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
==================================================
*/

function getUsers() {

    try {

        const raw =
            fs.readFileSync(
                usersFile,
                "utf8"
            );


        const users =
            JSON.parse(raw);


        if (
            !Array.isArray(users)
        ) {

            return [];

        }


        return users.map(
            normalizeOrder
        );

    }

    catch (error) {

        console.error(
            "Ошибка чтения users.json:",
            error
        );

        return [];

    }

}


function saveUsers(
    users
) {

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

        order.hiddenForProfile =
            false;

    }


    if (
        typeof order.updatedAt !==
        "number"
    ) {

        order.updatedAt =
            Date.now();

    }


    if (
        typeof order.discountPercent !==
        "number"
    ) {

        order.discountPercent =
            0;

    }


    if (
        typeof order.discountAmount !==
        "number"
    ) {

        order.discountAmount =
            0;

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

        order.promoCode =
            "";

    }


    return order;

}


function createId(
    prefix
) {

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

    const normalized =
        normalizePromoCode(
            code
        );


    return (
        PROMO_CODES[
            normalized
        ] || 0
    );

}


/*
==================================================
РАСЧЁТ ЦЕНЫ
==================================================
*/

function calculatePrice(
    robux,
    promoCode = ""
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


    const discountPercent =
        getPromoDiscount(
            promoCode
        );


    const discountAmount =
        Math.round(
            basePrice *
            discountPercent /
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


    return {

        basePrice:
            basePrice,

        discountPercent:
            discountPercent,

        discountAmount:
            discountAmount,

        finalPrice:
            finalPrice

    };

}


/*
==================================================
ПРОВЕРКА ПРОМОКОДА
==================================================
*/

app.post(
    "/api/promos/validate",
    (req, res) => {

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
                normalized
            );


        return res.json({

            success:
                true,

            promoCode:
                normalized,

            discountPercent:
                price.discountPercent,

            basePrice:
                price.basePrice,

            discountAmount:
                price.discountAmount,

            finalPrice:
                price.finalPrice

        });

    }
);


/*
==================================================
СОЗДАНИЕ ЗАКАЗА
==================================================
*/

app.post(
    "/api/users",
    (req, res) => {

        const {
            username,
            robux,
            profileId,
            promoCode
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


        const normalizedPromo =
            normalizePromoCode(
                promoCode
            );


        const price =
            calculatePrice(
                amount,
                normalizedPromo
            );


        const users =
            getUsers();


        const order = {

            id:
                createId(
                    "order"
                ),

            orderNumber:
                1000 +
                users.length +
                1,

            profileId:
                profileId ||
                createId(
                    "profile"
                ),

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
                price.discountPercent,

            discountAmount:
                price.discountAmount,

            promoCode:
                price.discountPercent > 0
                    ? normalizedPromo
                    : "",

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


/*
==================================================
ПОЛУЧИТЬ ВСЕ ЗАКАЗЫ
==================================================
*/

app.get(
    "/api/users",
    (req, res) => {

        return res.json(
            getUsers()
        );

    }
);


/*
==================================================
ЗАКАЗЫ ПРОФИЛЯ
==================================================
*/

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


/*
==================================================
ПОЛУЧИТЬ ОДИН ЗАКАЗ
==================================================
*/

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


/*
==================================================
ТАЙМЕР БОТА
==================================================
*/

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

        clearTimeout(
            timer
        );


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
        lower.includes(
            "привет"
        ) ||
        lower.includes(
            "здравствуйте"
        )
    ) {

        return "🤖 Здравствуйте! Сообщение передано продавцу.";

    }


    if (
        lower.includes(
            "когда"
        ) ||
        lower.includes(
            "сколько ждать"
        ) ||
        lower.includes(
            "срок"
        )
    ) {

        return "🤖 Ваш вопрос передан продавцу. Пожалуйста, ожидайте ответа.";

    }


    if (
        lower.includes(
            "где заказ"
        ) ||
        lower.includes(
            "где мой"
        ) ||
        lower.includes(
            "не приш"
        )
    ) {

        return "🤖 Продавец проверит ваш заказ и ответит вам.";

    }


    if (
        lower.includes(
            "спасибо"
        )
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

                    order.messages =
                        [];

                }


                const lastUserMessage =
                    [...order.messages]
                        .reverse()
                        .find(
                            message =>
                                message.sender ===
                                "user"
                        );


                if (
                    !lastUserMessage
                ) {

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


                if (
                    hasAdminReply
                ) {

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


/*
==================================================
СООБЩЕНИЯ
==================================================
*/

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

            order.messages =
                [];

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
            sender ===
            "admin"
        ) {

            cancelBotTimer(
                order.id
            );

        }


        saveUsers(
            users
        );


        if (
            sender ===
            "user"
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


/*
==================================================
УДАЛИТЬ СООБЩЕНИЕ
==================================================
*/

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


/*
==================================================
ИЗМЕНЕНИЕ ЗАКАЗА
==================================================
*/

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
            robux,
            promoCode
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
            undefined ||
            promoCode !==
            undefined
        ) {

            const amount =
                robux !== undefined
                    ? Math.floor(
                        Number(
                            robux
                        )
                    )
                    : order.robux;


            const code =
                promoCode !== undefined
                    ? normalizePromoCode(
                        promoCode
                    )
                    : order.promoCode;


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
                    code
                );


            order.robux =
                amount;

            order.basePrice =
                price.basePrice;

            order.discountPercent =
                price.discountPercent;

            order.discountAmount =
                price.discountAmount;

            order.price =
                price.finalPrice;

            order.promoCode =
                price.discountPercent > 0
                    ? normalizePromoCode(
                        code
                    )
                    : "";

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


/*
==================================================
ОТМЕНА ЗАКАЗА
==================================================
*/

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


/*
==================================================
СТАТУС
==================================================
*/

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


/*
==================================================
СКРЫТЬ ЗАКАЗ ИЗ ПРОФИЛЯ
==================================================
*/

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


/*
==================================================
ЗАПУСК
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
            `🎁 Доступно промокодов: ${
                Object.keys(
                    PROMO_CODES
                ).length
            }`
        );

    }
);
