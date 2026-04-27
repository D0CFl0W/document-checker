(function() {
    "use strict";

    // Настройки адресов бэкенда
    const CONFIG = {
        API_URL: "http://127.0.0.1:8000",
        ENDPOINTS: {
            UPLOAD_ZIP: "/upload-archive/", // Эндпоинт для приема ZIP-архива
            DOWNLOAD: "/download-report/"   // Эндпоинт для скачивания отчета
        }
    };

    // Хранилище для файлов в оперативной памяти
    const selectedFiles = {
        title: null,
        task: null,
        review: null,
        norm: null,
        antiplag: null
    };

    // Элементы интерфейса
    const navLinks = document.querySelectorAll('.nav-link');
    const pages = {
        page1: document.getElementById('page1'),
        page2: document.getElementById('page2'),
        page3: document.getElementById('page3')
    };

    const notificationArea = document.getElementById('notificationArea');
    const errorList = document.getElementById('errorList');
    const successMsg = document.getElementById('successMessage');
    const reportStatusSpan = document.getElementById('reportStatus');
    const checkBtn = document.getElementById('checkBtn');
    const downloadBtn = document.getElementById('downloadReportBtn');

    const fileInputs = [
        { input: document.getElementById('file-title'), nameSpan: document.getElementById('title-name'), statusSpan: document.getElementById('title-status'), key: 'title' },
        { input: document.getElementById('file-task'), nameSpan: document.getElementById('task-name'), statusSpan: document.getElementById('task-status'), key: 'task' },
        { input: document.getElementById('file-review'), nameSpan: document.getElementById('review-name'), statusSpan: document.getElementById('review-status'), key: 'review' },
        { input: document.getElementById('file-norm'), nameSpan: document.getElementById('norm-name'), statusSpan: document.getElementById('norm-status'), key: 'norm' },
        { input: document.getElementById('file-antiplag'), nameSpan: document.getElementById('antiplag-name'), statusSpan: document.getElementById('antiplag-status'), key: 'antiplag' }
    ];

    // --- НАВИГАЦИЯ МЕЖДУ СТРАНИЦАМИ ---
    function switchPage(targetId) {
        Object.values(pages).forEach(p => p.classList.add('hidden'));
        if (pages[targetId]) pages[targetId].classList.remove('hidden');
        
        navLinks.forEach(link => {
            link.classList.toggle('active', link.dataset.page === targetId);
        });
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchPage(link.dataset.page);
        });
    });

    // --- ОБРАБОТКА ВЫБОРА ФАЙЛОВ ---
    fileInputs.forEach(item => {
        item.input.addEventListener('change', () => {
            const file = item.input.files[0];
            if (file) {
                selectedFiles[item.key] = file;
                item.nameSpan.textContent = file.name.length > 25 ? file.name.substring(0, 22) + '...' : file.name;
                item.statusSpan.textContent = '📦 готов';
                item.statusSpan.style.background = '#dcfce7'; // Зеленый фон
            } else {
                selectedFiles[item.key] = null;
                item.nameSpan.textContent = 'файл не выбран';
                item.statusSpan.textContent = '⏳ ожидает';
                item.statusSpan.style.background = '#e6edf6';
            }
            hideNotifications();
        });
    });

    // --- ОТПРАВКА АРХИВА НА БЭКЕНД ---
    checkBtn.addEventListener('click', async () => {
        // Проверка: загружены ли все файлы?
        const missing = Object.keys(selectedFiles).filter(key => !selectedFiles[key]);
        if (missing.length > 0) {
            displayResults(['Загрузите все 5 документов перед отправкой!'], false);
            return;
        }

        checkBtn.disabled = true;
        checkBtn.textContent = '⌛ Упаковка и отправка...';

        try {
            // Создаем ZIP архив
            const zip = new JSZip();
            zip.file("1_title.docx", selectedFiles.title);
            zip.file("2_task.docx", selectedFiles.task);
            zip.file("3_review.docx", selectedFiles.review);
            zip.file("4_norm.docx", selectedFiles.norm);
            zip.file("5_antiplag.pdf", selectedFiles.antiplag);

            // Генерируем архив в виде Blob
            const zipBlob = await zip.generateAsync({ type: "blob" });

            // Подготавливаем данные для отправки
            const formData = new FormData();
            formData.append('archive', zipBlob, "documents_bundle.zip");

            // Fetch запрос
            const response = await fetch(`${CONFIG.API_URL}${CONFIG.ENDPOINTS.UPLOAD_ZIP}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Ошибка сервера');

            const data = await response.json();

            // Если сервер вернул ошибки в ключе 'errors'
            if (data.errors && data.errors.length > 0) {
                displayResults(data.errors, false);
                reportStatusSpan.textContent = 'обнаружены замечания';
            } else {
                displayResults([], true);
                reportStatusSpan.textContent = 'успешно ✅';
            }

        } catch (err) {
            displayResults(['Ошибка связи с сервером. Проверьте FastAPI и CORS.'], false);
        } finally {
            checkBtn.disabled = false;
            checkBtn.textContent = '🔎 Проверить все документы';
        }
    });

    // --- СКАЧИВАНИЕ ОТЧЕТА ---
    downloadBtn.addEventListener('click', async () => {
        try {
            const response = await fetch(`${CONFIG.API_URL}${CONFIG.ENDPOINTS.DOWNLOAD}`, {
                method: 'GET'
            });
            if (!response.ok) throw new Error('Файл не найден');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // Используем обратные апострофы для даты
            a.download = 'Report_Normokontrol_${new Date().toISOString().slice(0,10)}.docx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert('Не удалось скачать отчёт. Убедитесь, что проверка на сервере завершена.');
        }
    });

    // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
    function displayResults(errors, isSuccess) {
        errorList.innerHTML = '';
        if (isSuccess) {
            notificationArea.style.display = 'none';
            successMsg.style.display = 'block';
        } else {
            errors.forEach(err => {
                const li = document.createElement('li');
                li.textContent = err;
                errorList.appendChild(li);
            });
            notificationArea.style.display = 'block';
            successMsg.style.display = 'none';
        }
    }

    function hideNotifications() {
        notificationArea.style.display = 'none';
        successMsg.style.display = 'none';
    }

})();