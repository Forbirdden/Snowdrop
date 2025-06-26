        const translations = {
            ru: {
                appName: "Snowdrop",
                addServer: "+ Добавить сервер",
                serverTitle: "Название сервера",
                address: "IP/домен",
                port: "Порт",
                protocol: "Протокол",
                username: "Имя пользователя (необязательно)",
                password: "Пароль (необязательно)",
                save: "Сохранить",
                cancel: "Отмена",
                editServer: "Изменить сервер",
                deleteServer: "Удалить сервер",
                confirmDelete: 'Удалить сервер "{title}"?',
                settings: "Настройки",
                language: "Язык",
                messageFormat: "Формат сообщения",
                settingsSave: "Сохранить",
                settingsCancel: "Отмена",
                invalidTitle: "Некорректное название",
                invalidAddress: "Некорректный адрес",
                invalidPort: "Некорректный порт",
                duplicateServer: "Такой сервер уже добавлен",
                fillAllFields: "Заполните все поля",
                writeMessage: "Написать сообщение...",
                send: "Отправить",
                plain: "Простой",
                wRACs: "wRACs",
                wRAC: "wRAC (open snowdrop using http://)",
                RACs: "RACs (WIP)",
                RAC: "RAC (WIP)",
                settingsLabelLang: "Язык",
                settingsLabelFormat: "Формат сообщения"
            },
            en: {
                appName: "Snowdrop",
                addServer: "+ Add server",
                serverTitle: "Server title",
                address: "IP/domain",
                port: "Port",
                protocol: "Protocol",
                username: "Username (optional)",
                password: "Password (optional)",
                save: "Save",
                cancel: "Cancel",
                editServer: "Edit server",
                deleteServer: "Delete server",
                confirmDelete: 'Delete server "{title}"?',
                settings: "Settings",
                language: "Language",
                messageFormat: "Message format",
                settingsSave: "Save",
                settingsCancel: "Cancel",
                invalidTitle: "Invalid title",
                invalidAddress: "Invalid address",
                invalidPort: "Invalid port",
                duplicateServer: "This server is already added",
                fillAllFields: "Fill all fields",
                writeMessage: "Write a message...",
                send: "Send",
                plain: "Plain",
                wRACs: "wRACs",
                wRAC: "wRAC (open snowdrop using http://)",
                RACs: "RACs (WIP)",
                RAC: "RAC (WIP)",
                settingsLabelLang: "Language",
                settingsLabelFormat: "Message format"
            }
        };

        function t(key, vars = {}) {
            const lang = settings && settings.lang || "ru";
            let str = translations[lang][key] || translations['ru'][key] || key;
            Object.keys(vars).forEach(k => {
                str = str.replace("{" + k + "}", vars[k]);
            });
            return str;
        }

        const nickMarkers = [
            { marker: "\uB9AC\u3E70", color: "nick-green" },         // бракованный
            { marker: "\u2550\u2550\u2550", color: "nick-lightred" },// краб
            { marker: "\u00B0\u0298", color: "nick-lightmagenta" },  // меф
            { marker: "\u2042", color: "nick-gold" },                // кря
            { marker: "\u0D9E", color: "nick-amogus" },              // сновдроп
        ];

        window.onload = () => { fetchMessages(); };