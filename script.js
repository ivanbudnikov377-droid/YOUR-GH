// ============================================================
// YOUR GC - LINE ASSISTANT (HMI SCRIPT)
// ============================================================

let calculatedNozzles = [];

// ============================================================
// 1. ЗАСТАВКА (SPLASH SCREEN) И ЧАСТИЦЫ
// ============================================================
function dismissSplash() {
    const splash = document.getElementById('splash-screen');
    const mainApp = document.getElementById('main-app');
    
    if (splash && !splash.classList.contains('fade-out')) {
        splash.classList.add('fade-out');
        
        setTimeout(() => {
            splash.style.display = 'none';
            mainApp.classList.remove('hidden');
        }, 600);
    }
}

function createParticles() {
    const container = document.getElementById('splash-particles');
    if (!container) return;
    
    const particleCount = 40;
    for (let i = 0; i < particleCount; i++) {
        const p = document.createElement('div');
        p.classList.add('splash-particle');
        
        const size = Math.random() * 4 + 2;
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        p.style.left = Math.random() * 100 + 'vw';
        p.style.animationDuration = (Math.random() * 5 + 3) + 's';
        p.style.animationDelay = (Math.random() * 3) + 's';
        
        container.appendChild(p);
    }
}

// ============================================================
// 2. ЖИВЫЕ ЧАСЫ
// ============================================================
function updateClock() {
    const now = new Date();
    const dateEl = document.getElementById('hmi-date');
    const timeEl = document.getElementById('hmi-time');
    
    if (dateEl && timeEl) {
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        dateEl.textContent = `${day}.${month}.${year}`;
        timeEl.textContent = `${hours}:${minutes}:${seconds}`;
    }
}

// ============================================================
// 3. НАВИГАЦИЯ
// ============================================================
function switchTab(tabName, event) {
    if (event && event.currentTarget) {
        document.querySelectorAll('.hmi-nav-btn').forEach(btn => btn.classList.remove('active'));
        event.currentTarget.classList.add('active');
    }

    document.querySelectorAll('.hmi-screen').forEach(screen => {
        if (screen.classList.contains('active')) {
            screen.classList.remove('active');
            setTimeout(() => screen.classList.add('hidden'), 300); 
        }
    });

    const targetScreen = document.getElementById(`screen-${tabName}`);
    if (targetScreen) {
        targetScreen.classList.remove('hidden');
        setTimeout(() => targetScreen.classList.add('active'), 50);
    }
}

// ============================================================
// 4. АВТОРАСЧЕТ ОБЪЕМА
// ============================================================
function updateVolumePreview() {
    const weight = parseFloat(document.getElementById('input_weight').value) || 0;
    const density = parseFloat(document.getElementById('input_density').value) || 1;
    if (density <= 0) return;
    
    const volume = weight / density;
    const resultEl = document.getElementById('calc_volume_result');
    if (resultEl) resultEl.textContent = volume.toFixed(1) + ' мл';
}

// ============================================================
// 5. УМНОЕ ФИЗИЧЕСКОЕ ЯДРО
// ============================================================
function generateRecipeFromInputs() {
    const lineSelect = document.getElementById('input_line');
    const selectedLineText = lineSelect.options[lineSelect.selectedIndex].text;
    
    const diameterSelect = document.getElementById('input_nozzle_diameter');
    const nozzle_D = parseFloat(diameterSelect.value);
    const selectedDiameterText = diameterSelect.options[diameterSelect.selectedIndex].text;

    const bottleVolume = parseFloat(document.getElementById('input_bottle_volume').value);
    const height = parseFloat(document.getElementById('input_height').value);
    
    const weight = parseFloat(document.getElementById('input_weight').value);
    const density = parseFloat(document.getElementById('input_density').value);
    const viscosity = parseFloat(document.getElementById('input_viscosity').value);

    if (bottleVolume <= 0 || height <= 0 || weight <= 0 || density <= 0 || viscosity <= 0) {
        alert("Ошибка: Проверьте правильность ввода замеров. Все значения должны быть больше нуля.");
        return;
    }

    const targetVolume_ml = weight / density;
    const viscosity_PaS = viscosity * 0.001;
    
    const nozzle_A = Math.PI * Math.pow(nozzle_D / 2, 2);
    const nozzle_L = 0.02;
    const hose_D = 0.016;
    const hoseLengths = [1.5, 1.6, 1.8, 2.0, 1.7, 1.9, 2.1, 1.5, 1.8, 2.2, 2.0, 1.6];
    const hose_L_avg = 1.8; 

    let V_max = 0.8 + (viscosity * 0.0018); 
    if (V_max > 5.0) V_max = 5.0;

    const Q_max_safe_m3_s = V_max * nozzle_A;
    const Q_max_safe_ml_s = Q_max_safe_m3_s * 1000000;

    const optimalTime_sec = targetVolume_ml / Q_max_safe_ml_s;

    const R_hose = (128 * viscosity_PaS * hose_L_avg) / (Math.PI * Math.pow(hose_D, 4));
    const R_nozzle = (128 * viscosity_PaS * nozzle_L) / (Math.PI * Math.pow(nozzle_D, 4));
    const R_avg = R_hose + R_nozzle;

    const P_required_Pa = Q_max_safe_m3_s * R_avg;
    let pressure_bar = P_required_Pa / 100000;

    const MAX_SAFE_PRESSURE_BAR = 3.0; 
    let isPressureLimited = false;
    let actualFillTime = optimalTime_sec;

    if (pressure_bar > MAX_SAFE_PRESSURE_BAR) {
        pressure_bar = MAX_SAFE_PRESSURE_BAR;
        isPressureLimited = true;
        
        const P_limited_Pa = pressure_bar * 100000;
        const Q_limited_m3_s = P_limited_Pa / R_avg;
        const Q_limited_ml_s = Q_limited_m3_s * 1000000;
        actualFillTime = targetVolume_ml / Q_limited_ml_s;
    }

    const basePreAct = targetVolume_ml * 0.02; 
    calculatedNozzles = [];
    const P_actual_Pa = pressure_bar * 100000;

    for (let i = 0; i < 12; i++) {
        const R_hose_i = (128 * viscosity_PaS * hoseLengths[i]) / (Math.PI * Math.pow(hose_D, 4));
        const R_total_i = R_hose_i + R_nozzle;

        const Q_ml_s_i = (P_actual_Pa / R_total_i) * 1000000;
        
        const preAct_ml = (Q_ml_s_i * 0.02) + (viscosity / 500) + basePreAct;
        const kp_base = 1.65;
        const resistance_factor = R_total_i / R_avg;
        const kp = kp_base * resistance_factor;
        const ki = viscosity > 1000 ? 0.08 : 0.15;

        calculatedNozzles.push({
            id: i + 1,
            dose: targetVolume_ml.toFixed(1),
            preAct: preAct_ml.toFixed(1),
            kp: kp.toFixed(2),
            ki: ki.toFixed(2),
            theoreticalTime: (targetVolume_ml / Q_ml_s_i).toFixed(2)
        });
    }

    const bottleAreaMlPerMm = bottleVolume / height;
    const safeSubmergeDepthMm = 20; 
    const volumeToSubmergeMl = bottleAreaMlPerMm * safeSubmergeDepthMm;
    
    const averageFlowRate = targetVolume_ml / actualFillTime; 
    let submergeDelay = volumeToSubmergeMl / averageFlowRate;
    if (submergeDelay < 0.1) submergeDelay = 0.1;

    const nozzleDownPosition = Math.round(height - 43);
    const nozzleUpPosition = Math.round(height + 74);
    
    document.getElementById('set_tank_on').value = "0.10";
    document.getElementById('set_tank_off').value = "0.10";
    document.getElementById('set_tank_time').value = "90.00";
    document.getElementById('set_pressure').value = pressure_bar.toFixed(2);
    document.getElementById('set_sensitivity').value = (viscosity > 1000) ? "0.1" : "0.15";

    document.getElementById('set_stem_on_sec').value = "0.02";
    document.getElementById('set_stem_on_speed').value = "100.0";
    document.getElementById('set_stem_on_steps').value = nozzleUpPosition;

    document.getElementById('set_stem_cycle_sec').value = actualFillTime.toFixed(2);
    document.getElementById('set_stem_cycle_speed').value = (viscosity < 1000) ? "7.2" : "15.0"; 
    document.getElementById('set_stem_cycle_steps').value = nozzleDownPosition;

    document.getElementById('set_stem_off_sec').value = "0.02";
    document.getElementById('set_stem_off_speed').value = "120.0";

    document.getElementById('set_drop_on').value = "0.01";
    document.getElementById('set_drop_off').value = "0.01";
    document.getElementById('set_gate_on').value = "0.02";
    document.getElementById('set_gate_off').value = "0.01";
    
    document.getElementById('set_cutter_in_on').value = "0.01";
    document.getElementById('set_cutter_in_off').value = (actualFillTime + 2.5).toFixed(2);
    document.getElementById('set_cutter_out_on').value = "0.01";
    document.getElementById('set_cutter_out_off').value = "0.02";
    
    document.getElementById('set_conv_on').value = "0.01";
    document.getElementById('set_conv_off').value = "0.01";

    document.getElementById('bottle_input_dose').value = targetVolume_ml.toFixed(1);
    document.getElementById('bottle_max_time').value = (actualFillTime + 5).toFixed(1);
    document.getElementById('bottle_delay').value = submergeDelay.toFixed(2); 

    const bottleBtn = document.querySelectorAll('.hmi-nav-btn')[1];
    switchTab('bottle', { currentTarget: bottleBtn });
    
    let report = `АВТОМАТИЧЕСКИЙ РАСЧЕТ ЗАВЕРШЕН\n\n`;
    report += `Линия: ${selectedLineText}\n`;
    report += `Сопла: ${selectedDiameterText}\n`;
    report += `Флакон: ${bottleVolume} мл, ${height} мм\n\n`;
    report += `Целевой объем дозы: ${targetVolume_ml.toFixed(1)} мл\n`;
    report += `Безопасная скорость: ${V_max.toFixed(2)} м/с\n`;
    report += `Рассчитанное давление: ${pressure_bar.toFixed(2)} бар\n`;
    report += `Время налива: ~${actualFillTime.toFixed(1)} сек.\n`;
    report += `Задержка подъема (погружение): ${submergeDelay.toFixed(2)} сек.\n\n`;

    if (isPressureLimited) {
        report += `⚠️ ВНИМАНИЕ: Давление ограничено безопасным максимумом (${MAX_SAFE_PRESSURE_BAR} бар).\n`;
        report += `Из-за высокой вязкости продукта налив займет больше времени.`;
    } else {
        report += `✅ Настройки безопасны. Риск пены и брызг минимален.`;
    }

    alert(report);
}

// ============================================================
// 6. РАБОТА С ФОРСУНКАМИ
// ============================================================
let currentNozzleId = null;

function openNozzleSettings(nozzleId) {
    currentNozzleId = nozzleId;
    const data = calculatedNozzles[nozzleId - 1];

    document.getElementById('modal-nozzle-title').textContent = `Форсунка №${nozzleId}`;
    document.getElementById('modal-input-dose').value = data ? data.dose : "851";
    document.getElementById('modal-input-kp').value = data ? data.kp : "1.65";
    document.getElementById('modal-input-ki').value = data ? data.ki : "0.10";
    document.getElementById('hmi-modal-nozzle').classList.remove('hidden');
}

function closeNozzleSettings() {
    document.getElementById('hmi-modal-nozzle').classList.add('hidden');
    currentNozzleId = null;
}

function saveNozzleSettings() {
    if (!currentNozzleId) return;
    const newKp = parseFloat(document.getElementById('modal-input-kp').value);
    const newKi = parseFloat(document.getElementById('modal-input-ki').value);

    if (calculatedNozzles[currentNozzleId - 1]) {
        calculatedNozzles[currentNozzleId - 1].kp = newKp;
        calculatedNozzles[currentNozzleId - 1].ki = newKi;
    }

    const saveBtn = document.querySelector('.hmi-btn-save');
    const originalText = saveBtn.innerHTML;
    saveBtn.innerHTML = '✓ Сохранено';
    saveBtn.style.background = '#00ff00';
    
    setTimeout(() => {
        saveBtn.innerHTML = originalText;
        saveBtn.style.background = 'var(--hmi-accent)';
        closeNozzleSettings();
    }, 600);
}

// ============================================================
// 7. ИНИЦИАЛИЗАЦИЯ
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    
    const splash = document.getElementById('splash-screen');
    if (splash) splash.addEventListener('click', dismissSplash);

    setInterval(updateClock, 1000);
    updateClock();

    const listContainer = document.getElementById('nozzles-list-container');
    if (listContainer) {
        for (let i = 1; i <= 12; i++) {
            const btn = document.createElement('button');
            btn.className = 'hmi-nozzle-btn';
            btn.textContent = `Форсунка ${i}`;
            btn.onclick = () => openNozzleSettings(i);
            listContainer.appendChild(btn);
        }
    }

    updateVolumePreview();
});
