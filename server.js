const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


const dataDir =
    path.join(__dirname, "data");

const usersFile =
    path.join(
        dataDir,
        "users.json"
    );


if (!fs.existsSync(dataDir)) {

    fs.mkdirSync(
        dataDir,
        {
            recursive: true
        }
    );

}


if (!fs.existsSync(usersFile)) {

    fs.writeFileSync(
        usersFile,
        "[]",
        "utf8"
    );

}


/* =========================
   РАБОТА С БАЗОЙ
========================= */

function getUsers() {

    try {

        const data =
            fs.readFileSync(
                usersFile,
                "utf8"
            );

        return JSON.parse(data);

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


function createId(prefix) {

    return (
        prefix +
        "-" +
        Date.now() +
        "-" +
        Math.random()
            .toString(36)
            .slice(2, 10)
    );

}


function getDate() {

    return new Date()
        .toLocaleString(
            "ru-RU"
        );

}


/* =========================
   СОЗДАТЬ ЗАКАЗ
========================= */

app.post(
    "/api/users",
    (req, res) => {

        const {
            username,
            robux,
            price,
            profileId
        } = req.body;


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
            !robux ||
            Number(robux) < 1
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "Введите количество Robux"
                });

        }


        const users =
            getUsers();


        const finalProfileId =
            profileId ||
            createId("profile");


        const order = {

            id:
                createId("order"),

            orderNumber:
                1000 +
                users.length +
                1,

            profileId:
                finalProfileId,

            username:
                String(username)
                    .trim(),

            robux:
                Number(robux),

            price:
                Number(price) ||
                Number(robux) * 1.5,

            status:
                "Новая заявка",

            messages: [],

            createdAt:
                getDate(),

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
                user =>
                    user.profileId ===
                    req.params.profileId
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


        res.json(order);

    }
);


/* =========================
   ОТПРАВИТЬ СООБЩЕНИЕ
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


        const allowedSenders = [
            "user",
            "admin",
            "bot"
        ];


        if (
            !allowedSenders.includes(
                sender
            )
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
                createId("message"),

            sender:
                sender,

            text:
                String(text)
                    .trim(),

            createdAt:
                getDate(),

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


        if (
            !Array.isArray(
                order.messages
            )
        ) {

            order.messages = [];

        }


        const index =
            order.messages.findIndex(
                message =>
                    String(message.id) ===
                    String(
                        req.params.messageId
                    )
            );


        if (index === -1) {

            return res
                .status(404)
                .json({
                    error:
                        "Сообщение не найдено"
                });

        }


        order.messages.splice(
            index,
            1
        );


        order.updatedAt =
            Date.now();


        saveUsers(users);


        res.json({
            success: true
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
            robux,
            username
        } = req.body;


        if (
            robux !== undefined
        ) {

            if (
                Number(robux) < 1
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "Количество Robux должно быть больше 0"
                    });

            }


            order.robux =
                Number(robux);


            order.price =
                Number(robux) *
                1.5;

        }


        if (
            username !== undefined &&
            String(username).trim()
        ) {

            order.username =
                String(username)
                    .trim();

        }


        order.updatedAt =
            Date.now();


        saveUsers(users);


        res.json(order);

    }
);


/* =========================
   ОТМЕНИТЬ ЗАКАЗ
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


        saveUsers(users);


        res.json(order);

    }
);


/* =========================
   ИЗМЕНИТЬ СТАТУС
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


        saveUsers(users);


        res.json(order);

    }
);


/* =========================
   УДАЛИТЬ ЗАКАЗ ИЗ ПРОФИЛЯ
========================= */

app.delete(
    "/api/users/:id",
    (req, res) => {

        const users =
            getUsers();


        const index =
            users.findIndex(
                item =>
                    item.id ===
                    req.params.id
            );


        if (index === -1) {

            return res
                .status(404)
                .json({
                    error:
                        "Заказ не найден"
                });

        }


        users.splice(
            index,
            1
        );


        saveUsers(users);


        res.json({
            success: true
        });

    }
);


/* =========================
   ЗАПУСК
========================= */

app.listen(
    PORT,
    () => {

        console.log(
            "🚀 RiRobux запущен!"
        );

        console.log(
            "👉 http://localhost:" +
            PORT
        );

    }
);