const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT =
    process.env.PORT || 3000;

const PRICE_PER_ROBUX = 0.76;

const BOT_DELAY =
    2 * 60 * 1000;


app.use(express.json());

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


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


/* =========================
   БАЗА
========================= */

function getUsers() {

    try {

        const raw =
            fs.readFileSync(
                usersFile,
                "utf8"
            );

        const users =
            JSON.parse(raw);

        return users.map(
            normalizeOrder
        );

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

    return new Date()
        .toLocaleString(
            "ru-RU"
        );

}


/* =========================
   СОЗДАНИЕ ЗАКАЗА
========================= */

app.post(
    "/api/users",
    (req, res) => {

        const {
            username,
            robux,
            profileId
        } = req.body;


        const amount =
            Number(robux);


        if (
            !username ||
            !String(username).trim()
        ) {

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
                String(username)
                    .trim(),

            robux:
                Math.floor(
                    amount
                ),

            price:
                Math.round(
                    Math.floor(amount) *
                    PRICE_PER_ROBUX *
                    100
                ) / 100,

            status:
                "Новая заявка",

            messages: [],

            hiddenForProfile:
                false,

            createdAt:
                currentDate(),

            updatedAt:
                Date.now()

        };


        users.push(order);

        saveUsers(users);


        res.json(order);

    }
);


/* =========================
   ВСЕ ЗАКАЗЫ
========================= */

app.get(
    "/api/users",
    (req, res) => {

        res.json(
            getUsers()
        );

    }
);


/* =========================
   ЗАКАЗЫ ПРОФИЛЯ
========================= */

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
                    )
            );


        res.json(orders);

    }
);


/* =========================
   ОДИН ЗАКАЗ
========================= */

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


        res.json(
            normalizeOrder(
                order
            )
        );

    }
);


/* =========================
   СООБЩЕНИЯ
========================= */

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
        String(text)
            .toLowerCase();


    if (
        lower.includes(
            "привет"
        ) ||
        lower.includes(
            "здравствуйте"
        )
    ) {

        return [
            "🤖 Здравствуйте! Сообщение передано продавцу.",
            "🤖 Привет! Продавец увидит ваше сообщение и ответит вам.",
            "🤖 Здравствуйте! Продавец сейчас может быть занят. Ожидайте ответа."
        ][
            Math.floor(
                Math.random() * 3
            )
        ];

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

        return [
            "🤖 Ваш вопрос передан продавцу. Пожалуйста, ожидайте ответа.",
            "🤖 Заказ находится в обработке. Продавец сообщит вам сроки.",
            "🤖 Спасибо за ожидание. Продавец ответит, как только освободится."
        ][
            Math.floor(
                Math.random() * 3
            )
        ];

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

        return [
            "🤖 Продавец проверит ваш заказ и ответит вам.",
            "🤖 Ваш вопрос передан продавцу.",
            "🤖 Не переживайте, информация по заказу будет проверена."
        ][
            Math.floor(
                Math.random() * 3
            )
        ];

    }


    if (
        lower.includes(
            "спасибо"
        )
    ) {

        return [
            "🤖 Пожалуйста! 💜",
            "🤖 Всегда рады помочь!",
            "🤖 Не за что! Ожидайте ответа продавца."
        ][
            Math.floor(
                Math.random() * 3
            )
        ];

    }


    return [
        "🤖 Продавец сейчас не отвечает. Ваше сообщение сохранено.",
        "🤖 Продавец может быть занят. Он обязательно увидит ваше сообщение.",
        "🤖 Сообщение получено. Ожидайте ответа продавца в ближайшее время.",
        "🤖 Ваше сообщение передано продавцу.",
        "🤖 Продавец временно не в сети. Ожидайте ответа."
    ][
        Math.floor(
            Math.random() * 5
        )
    ];

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


                /*
                Берём самое последнее
                сообщение пользователя.
                */

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


                /*
                Если последнее
                сообщение пользователя
                уже не то, на которое
                ставился таймер,
                ничего не делаем.
                */

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


                /*
                Если после него есть
                сообщение продавца,
                бот не отвечает.
                */

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


                /*
                Проверяем, не отвечал
                ли бот уже на это
                сообщение.
                */

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


                const botMessage = {

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

                };


                order.messages.push(
                    botMessage
                );


                order.updatedAt =
                    Date.now();


                saveUsers(
                    users
                );

            },

            BOT_DELAY
        );


    botTimers.set(
        orderId,
        timer
    );

}


/* =========================
   ОТПРАВКА СООБЩЕНИЯ
========================= */

app.post(
    "/api/users/:id/messages",
    (req, res) => {

        const {
            text,
            sender
        } = req.body;


        if (
            !text ||
            !String(text).trim()
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
                String(text)
                    .trim(),

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


        /*
        Продавец ответил —
        отменяем текущий
        таймер бота.
        */

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


        /*
        Покупатель написал —
        запускаем таймер 2 минуты.
        */

        if (
            sender === "user"
        ) {

            scheduleBot(
                order.id,
                message.id
            );

        }


        res.json(
            message
        );

    }
);


/* =========================
   УДАЛИТЬ СООБЩЕНИЕ
========================= */

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


        res.json({
            success:
                true
        });

    }
);


/* =========================
   ИЗМЕНИТЬ ЗАКАЗ
========================= */

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
            username !== undefined
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
            robux !== undefined
        ) {

            const amount =
                Number(
                    robux
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


            order.robux =
                Math.floor(
                    amount
                );


            order.price =
                Math.round(
                    order.robux *
                    PRICE_PER_ROBUX *
                    100
                ) / 100;

        }


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


/* =========================
   ОТМЕНА
========================= */

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


        saveUsers(
            users
        );


        cancelBotTimer(
            order.id
        );


        res.json(order);

    }
);


/* =========================
   СТАТУС
========================= */

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


        res.json(order);

    }
);


/* =========================
   СКРЫТЬ ЗАКАЗ
========================= */

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


        res.json({
            success:
                true
        });

    }
);


/* =========================
   ЗАПУСК
========================= */

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🚀 RiRobux запущен на порту ${PORT}`
        );

    }
);