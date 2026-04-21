(function() {
    "use strict";

    // Конфигурация: укажи здесь адрес своего FastAPI сервера
    const CONFIG = {
        API_URL: "http://127.0.0.1:8000",
        ENDPOINTS: {
            UPLOAD: "/upload-file/",
            CHECK: "/check-documents/",
            DOWNLOAD: "/download-report/"
        }
    };

    // --- ЭЛЕМЕНТЫ ИНТЕРФЕЙСА ---
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

    // --- ЛОГИКА ПЕРЕКЛЮЧЕНИЯ СТРАНИЦ ---
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

    // --- РАБОТА С API ---

    // 1. Автоматическая загрузка файла при выборе
    fileInputs.forEach(item => {
        item.input.addEventListener('change', async () => {
            const file = item.input.files[0];
            if (!file) return;

            item.nameSpan.textContent = file.name;
            item.statusSpan.textContent = '⏳ загрузка...';

            const formData = new FormData();
            formData.append('file', file);
            formData.append('doc_type', item.key);

            try {
                const response = await fetch(`${CONFIG.API_URL}${CONFIG.ENDPOINTS.UPLOAD}`, {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    item.statusSpan.textContent = '✅ загружен';
                    item.statusSpan.style.background = '#dcfce7';
                } else {
                    throw new Error();
                }
            } catch (err) {
                item.statusSpan.textContent = '❌ ошибка';
                item.statusSpan.style.background = '#fee2e2';
            }
            
            notificationArea.style.display = 'none';
            successMsg.style.display = 'none';
        });
    });

    // 2. Проверка всех документов
    checkBtn.addEventListener('click', async () => {
        checkBtn.disabled = true;
        checkBtn.textContent = '⌛ Проверка...';

        try {
            const response = await fetch(`${CONFIG.API_URL}${CONFIG.ENDPOINTS.CHECK}`, {
                method: 'POST'
            });
            const data = await response.json();

            if (data.errors && data.errors.length > 0) {
                displayResults(data.errors, false);
                reportStatusSpan.textContent = 'обнаружены замечания';
            } else {
                displayResults([], true);
                reportStatusSpan.textContent = 'успешно ✅';
            }
        } catch (err) {
            displayResults(['Ошибка связи с сервером'], false);
        } finally {
            checkBtn.disabled = false;
            checkBtn.textContent = '🔎 Проверить все документы';
        }
    });

    // 3. Скачивание отчета
    downloadBtn.addEventListener('click', async () => {
        try {
            const response = await fetch(`${CONFIG.API_URL}${CONFIG.ENDPOINTS.DOWNLOAD}`);
            if (!response.ok) throw new Error();

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'Report_Normokontrol_${new Date().toISOString().slice(0,10)}.docx';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert('Не удалось скачать отчёт. Убедитесь, что проверка завершена.');
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

})();