function evaluarFuncion(expr, x) {
    try {
        let formula = expr
            .replace(/\^/g, '**')
            .replace(/(\d)([a-zA-Z(])/g, '$1*$2')
            .replace(/(\))(\d|[a-zA-Z(])/g, '$1*$2');
        with (Math) {
            const f = new Function('x', `return ${formula};`);
            return f(x);
        }
    } catch (e) {
        throw new Error(`Error en la función: ${e.message}`);
    }
}

function mostrarResultado(id, html, tipo = 'success') {
    const el = document.getElementById(id);
    el.className = 'resultado show ' + tipo;
    el.innerHTML = html;
}

function formatearValorTabla(val) {
    if (typeof val !== 'number') return val;
    if (Number.isInteger(val)) return val.toString();
    return val.toFixed(8);
}

function generarTablaIteraciones(encabezados, filas) {
    let html = '<div class="tabla-iteraciones"><table><thead><tr>';
    encabezados.forEach(h => html += `<th>${h}</th>`);
    html += '</tr></thead><tbody>';
    filas.forEach(fila => {
        html += '<tr>';
        fila.forEach(val => {
            html += `<td>${formatearValorTabla(val)}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table></div>';
    return html;
}

let bisChartInstance = null;
let bisChartState = {
    a: null,
    b: null,
    xMin: null,
    xMax: null,
    xCenter: null,
    baseSpan: null,
    zoom: 1,
    lastXr: null,
};
const BIS_ZOOM_STEP = 1.3;
const BIS_ZOOM_MAX = 64;
const BIS_ZOOM_MIN = 0.0625;

function actualizarLabelZoom() {
    const el = document.getElementById('bis-zoom-level');
    if (el) el.textContent = `Zoom: ${bisChartState.zoom.toFixed(2)}×`;
}

function renderBisChart(mostrarMensaje = false) {
    try {
        const func = document.getElementById('bis-funcion').value.trim();
        const a = bisChartState.a;
        const b = bisChartState.b;
        if (!func || isNaN(a) || isNaN(b)) {
            return;
        }

        const datos = generarDatosFuncion(func, bisChartState.xMin, bisChartState.xMax);
        if (!datos || datos.data.every(v => v === null)) {
            if (mostrarMensaje) {
                throw new Error('No se pudo evaluar la función en el rango. Verifica la sintaxis.');
            }
            return;
        }

        const container = document.getElementById('bis-chart-container');
        container.style.display = 'block';

        const ctx = document.getElementById('bis-chart').getContext('2d');
        if (bisChartInstance) bisChartInstance.destroy();
        bisChartInstance = new Chart(
            ctx,
            construirConfigChart(datos, a, b, bisChartState.lastXr)
        );

        actualizarLabelZoom();

        if (mostrarMensaje) {
            mostrarResultado(
                'bis-resultado',
                `<h4>📊 Gráfica generada correctamente</h4>
                 <p>Rango visible: [${bisChartState.xMin.toFixed(3)}, ${bisChartState.xMax.toFixed(3)}] · Zoom: ${bisChartState.zoom.toFixed(2)}×</p>
                 <p>Línea roja punteada marca el eje f(x)=0. Usa ➕/➖ para acercar/alejar y ⟳ para restablecer.</p>
                 <p><small>Si ya calculaste la raíz, ésta se marca como un punto rojo.</small></p>`,
                'success'
            );
        }
    } catch (e) {
        const container = document.getElementById('bis-chart-container');
        container.style.display = 'none';
        if (mostrarMensaje) {
            mostrarResultado('bis-resultado', `<h4>❌ Error al graficar</h4><p>${e.message}</p>`, 'error');
        }
    }
}

function zoomInBiseccion() {
    if (bisChartState.baseSpan == null) return;
    const nextZoom = Math.min(bisChartState.zoom * BIS_ZOOM_STEP, BIS_ZOOM_MAX);
    if (nextZoom === bisChartState.zoom) return;
    bisChartState.zoom = nextZoom;
    const span = bisChartState.baseSpan / bisChartState.zoom;
    bisChartState.xMin = bisChartState.xCenter - span / 2;
    bisChartState.xMax = bisChartState.xCenter + span / 2;
    renderBisChart(false);
}

function zoomOutBiseccion() {
    if (bisChartState.baseSpan == null) return;
    const nextZoom = Math.max(bisChartState.zoom / BIS_ZOOM_STEP, BIS_ZOOM_MIN);
    if (nextZoom === bisChartState.zoom) return;
    bisChartState.zoom = nextZoom;
    const span = bisChartState.baseSpan / bisChartState.zoom;
    bisChartState.xMin = bisChartState.xCenter - span / 2;
    bisChartState.xMax = bisChartState.xCenter + span / 2;
    renderBisChart(false);
}

function resetZoomBiseccion() {
    if (bisChartState.a == null || isNaN(bisChartState.a)) return;
    bisChartState.zoom = 1;
    bisChartState.baseSpan = (Math.max(bisChartState.a, bisChartState.b) + 2) - (Math.min(bisChartState.a, bisChartState.b) - 2);
    bisChartState.xCenter = (bisChartState.a + bisChartState.b) / 2;
    bisChartState.xMin = Math.min(bisChartState.a, bisChartState.b) - 2;
    bisChartState.xMax = Math.max(bisChartState.a, bisChartState.b) + 2;
    renderBisChart(false);
}

function generarDatosFuncion(func, xMin, xMax, numPuntos = 400) {
    const labels = [];
    const data = [];
    const paso = (xMax - xMin) / (numPuntos - 1);
    for (let i = 0; i < numPuntos; i++) {
        const x = xMin + i * paso;
        let y;
        try {
            y = evaluarFuncion(func, x);
        } catch (_) {
            y = NaN;
        }
        if (!isFinite(y)) y = NaN;
        labels.push(Number(x.toFixed(5)));
        data.push(isNaN(y) ? null : y);
    }
    return { labels, data };
}

function construirConfigChart(datos, a, b, xr = null) {
    const datasets = [
        {
            label: 'f(x)',
            data: datos.data,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.15)',
            borderWidth: 2.5,
            pointRadius: 0,
            tension: 0.25,
            fill: false,
        },
    ];

    if (xr !== null) {
        let yr = 0;
        try { yr = evaluarFuncion(
            document.getElementById('bis-funcion').value.trim(), xr
        ); } catch (_) { yr = 0; }
        datasets.push({
            label: `Raíz xr ≈ ${xr.toFixed(5)}`,
            data: datos.labels.map((x) => (Math.abs(x - xr) < 1e-9 ? yr : null)),
            borderColor: '#dc2626',
            backgroundColor: '#dc2626',
            pointRadius: 9,
            pointHoverRadius: 11,
            pointStyle: 'circle',
            showLine: false,
            borderWidth: 0,
        });
    }

    const yMax = Math.max(...datos.data.filter(v => v !== null && isFinite(v)), 5);
    const yMin = Math.min(...datos.data.filter(v => v !== null && isFinite(v)), -5);
    const yPadding = Math.max(Math.abs(yMax), Math.abs(yMin), 1) * 0.15;

    return {
        type: 'line',
        data: {
            labels: datos.labels,
            datasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Gráfica de f(x) - Método de Bisección',
                    font: { size: 15, weight: '600' },
                    padding: { top: 6, bottom: 12 },
                    color: '#1e293b',
                },
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true, padding: 16, font: { size: 12 } },
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 41, 59, 0.95)',
                    padding: 12,
                    titleFont: { size: 13 },
                    bodyFont: { size: 12 },
                    callbacks: {
                        title: (items) => `x ≈ ${Number(items[0].label).toFixed(5)}`,
                        label: (ctx) => ` f(x) ≈ ${(ctx.parsed.y ?? 0).toFixed(6)}`,
                    },
                },
                annotation: undefined,
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'x',
                        font: { size: 13, weight: '600' },
                        color: '#475569',
                    },
                    ticks: { color: '#64748b', maxTicksLimit: 12 },
                    grid: { color: 'rgba(100, 116, 139, 0.12)' },
                },
                y: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'f(x)',
                        font: { size: 13, weight: '600' },
                        color: '#475569',
                    },
                    ticks: { color: '#64748b' },
                    grid: { color: 'rgba(100, 116, 139, 0.12)' },
                    suggestedMin: yMin - yPadding,
                    suggestedMax: yMax + yPadding,
                },
            },
        },
        plugins: [
            {
                id: 'customLineZero',
                afterDraw: (chart) => {
                    const { ctx, chartArea: area, scales: { x, y } } = chart;
                    if (!y._gridLineItems) return;
                    const yZeroPx = y.getPixelForValue(0);
                    if (yZeroPx < area.top || yZeroPx > area.bottom) return;
                    ctx.save();
                    ctx.beginPath();
                    ctx.moveTo(area.left, yZeroPx);
                    ctx.lineTo(area.right, yZeroPx);
                    ctx.lineWidth = 1.5;
                    ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
                    ctx.setLineDash([8, 5]);
                    ctx.stroke();
                    ctx.restore();

                    if (a !== undefined && b !== undefined) {
                        const xa = x.getPixelForValue(a);
                        const xb = x.getPixelForValue(b);
                        const yTop = area.top + 6;
                        const yBot = area.top + 22;
                        ctx.save();
                        ctx.fillStyle = '#7c3aed';
                        ctx.fillRect(xa, yTop, 2, yBot - yTop);
                        ctx.fillRect(xb, yTop, 2, yBot - yTop);
                        ctx.font = 'bold 11px Segoe UI';
                        ctx.fillStyle = '#7c3aed';
                        ctx.textAlign = 'center';
                        ctx.fillText(`a=${a}`, xa, yBot + 12);
                        ctx.fillText(`b=${b}`, xb, yBot + 12);
                        ctx.setLineDash([]);
                        ctx.strokeStyle = 'rgba(124, 58, 237, 0.35)';
                        ctx.lineWidth = 1;
                        ctx.beginPath();
                        ctx.rect(xa, area.top, xb - xa, area.bottom - area.top);
                        ctx.stroke();
                        ctx.restore();
                    }
                },
            },
        ],
    };
}

function graficarBiseccion(xrExtra = null) {
    try {
        const func = document.getElementById('bis-funcion').value.trim();
        const a = parseFloat(document.getElementById('bis-a').value);
        const b = parseFloat(document.getElementById('bis-b').value);

        if (!func || isNaN(a) || isNaN(b)) {
            throw new Error('Ingresa una función y valores válidos para a y b antes de graficar.');
        }

        bisChartState.a = a;
        bisChartState.b = b;
        bisChartState.zoom = 1;
        bisChartState.baseSpan = (Math.max(a, b) + 2) - (Math.min(a, b) - 2);
        bisChartState.xCenter = (a + b) / 2;
        bisChartState.xMin = Math.min(a, b) - 2;
        bisChartState.xMax = Math.max(a, b) + 2;
        if (xrExtra != null) bisChartState.lastXr = xrExtra;

        renderBisChart(true);

    } catch (e) {
        const container = document.getElementById('bis-chart-container');
        container.style.display = 'none';
        mostrarResultado('bis-resultado', `<h4>❌ Error al graficar</h4><p>${e.message}</p>`, 'error');
    }
}

function actualizarGraficoBiseccionConRaiz(xr) {
    bisChartState.lastXr = xr;
    const container = document.getElementById('bis-chart-container');
    if (container.style.display === 'none' || !bisChartInstance) {
        graficarBiseccion(xr);
        return;
    }
    renderBisChart(false);
}

const ZOOM_STEP = 1.3;
const ZOOM_MAX = 64;
const ZOOM_MIN = 0.0625;

function crearChartState() {
    return {
        instance: null,
        xMin: null,
        xMax: null,
        xCenter: null,
        baseSpan: null,
        zoom: 1,
        lastRoot: null,
        extraPoints: null,
    };
}

function actualizarZoomLabel(idLabel, state) {
    const el = document.getElementById(idLabel);
    if (el) el.textContent = `Zoom: ${state.zoom.toFixed(2)}×`;
}

function aplicarZoom(state, factor) {
    if (state.baseSpan == null) return;
    const nextZoom = Math.min(Math.max(state.zoom * factor, ZOOM_MIN), ZOOM_MAX);
    if (nextZoom === state.zoom) return;
    state.zoom = nextZoom;
    const span = state.baseSpan / state.zoom;
    state.xMin = state.xCenter - span / 2;
    state.xMax = state.xCenter + span / 2;
}

function resetChartView(state, center, span) {
    state.zoom = 1;
    state.baseSpan = span;
    state.xCenter = center;
    state.xMin = center - span / 2;
    state.xMax = center + span / 2;
}

function construirConfigChartGenerico({ datos, titulo, color = '#2563eb', puntosExtra = [], mostrarY0 = true, lineasExtra = [], anotacionesSuperiores = [] }) {
    const datasets = [
        {
            label: 'f(x)',
            data: datos.data,
            borderColor: color,
            backgroundColor: color.replace(')', ', 0.15)').replace('rgb', 'rgba'),
            borderWidth: 2.5,
            pointRadius: 0,
            tension: 0.25,
            fill: false,
        },
        ...lineasExtra,
    ];

    puntosExtra.forEach((p) => {
        datasets.push({
            label: p.label,
            data: datos.labels.map((x) => (Math.abs(x - p.x) < 1e-9 ? p.y : null)),
            borderColor: p.color,
            backgroundColor: p.color,
            pointRadius: p.radius || 9,
            pointHoverRadius: (p.radius || 9) + 2,
            pointStyle: p.style || 'circle',
            showLine: false,
            borderWidth: 0,
        });
    });

    const valoresValidos = datos.data.filter((v) => v !== null && isFinite(v));
    const yMax = Math.max(...valoresValidos, 5);
    const yMin = Math.min(...valoresValidos, -5);
    const yPadding = Math.max(Math.abs(yMax), Math.abs(yMin), 1) * 0.15;

    return {
        type: 'line',
        data: { labels: datos.labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                title: {
                    display: true,
                    text: titulo,
                    font: { size: 15, weight: '600' },
                    padding: { top: 6, bottom: 12 },
                    color: '#1e293b',
                },
                legend: {
                    position: 'top',
                    labels: { usePointStyle: true, padding: 16, font: { size: 12 } },
                },
                tooltip: {
                    backgroundColor: 'rgba(30, 41, 59, 0.95)',
                    padding: 12,
                    titleFont: { size: 13 },
                    bodyFont: { size: 12 },
                    callbacks: {
                        title: (items) => `x ≈ ${Number(items[0].label).toFixed(5)}`,
                        label: (ctx) => ` y ≈ ${(ctx.parsed.y ?? 0).toFixed(6)}`,
                    },
                },
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'x', font: { size: 13, weight: '600' }, color: '#475569' },
                    ticks: { color: '#64748b', maxTicksLimit: 12 },
                    grid: { color: 'rgba(100, 116, 139, 0.12)' },
                },
                y: {
                    type: 'linear',
                    title: { display: true, text: 'y', font: { size: 13, weight: '600' }, color: '#475569' },
                    ticks: { color: '#64748b' },
                    grid: { color: 'rgba(100, 116, 139, 0.12)' },
                    suggestedMin: yMin - yPadding,
                    suggestedMax: yMax + yPadding,
                },
            },
        },
        plugins: [
            {
                id: 'customLineZeroPlus',
                afterDraw: (chart) => {
                    const { ctx, chartArea: area, scales: { x, y } } = chart;
                    if (!y._gridLineItems) return;

                    if (mostrarY0) {
                        const yZeroPx = y.getPixelForValue(0);
                        if (yZeroPx >= area.top && yZeroPx <= area.bottom) {
                            ctx.save();
                            ctx.beginPath();
                            ctx.moveTo(area.left, yZeroPx);
                            ctx.lineTo(area.right, yZeroPx);
                            ctx.lineWidth = 1.5;
                            ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
                            ctx.setLineDash([8, 5]);
                            ctx.stroke();
                            ctx.restore();
                        }
                    }

                    anotacionesSuperiores.forEach((ant) => {
                        ctx.save();
                        const yTop = area.top + 6;
                        const yBot = area.top + 22;
                        ctx.fillStyle = ant.color;
                        if (ant.x1 !== undefined) {
                            const xa = x.getPixelForValue(ant.x1);
                            const xb = x.getPixelForValue(ant.x2);
                            ctx.fillRect(xa, yTop, 2, yBot - yTop);
                            ctx.fillRect(xb, yTop, 2, yBot - yTop);
                            ctx.font = 'bold 11px Segoe UI';
                            ctx.textAlign = 'center';
                            ctx.fillText(`${ant.labelA}=${ant.x1}`, xa, yBot + 12);
                            ctx.fillText(`${ant.labelB}=${ant.x2}`, xb, yBot + 12);
                            ctx.setLineDash([]);
                            ctx.strokeStyle = ant.color.replace(')', ', 0.35)').replace('rgb', 'rgba');
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            ctx.rect(xa, area.top, xb - xa, area.bottom - area.top);
                            ctx.stroke();
                        } else {
                            const xp = x.getPixelForValue(ant.x);
                            ctx.fillRect(xp - 1, yTop, 2, yBot - yTop);
                            ctx.font = 'bold 11px Segoe UI';
                            ctx.textAlign = 'center';
                            ctx.fillText(`${ant.label}=${ant.x}`, xp, yBot + 12);
                        }
                        ctx.restore();
                    });
                },
            },
        ],
    };
}

const newtonState = crearChartState();

function renderNewtonChart(mostrarMensaje = false) {
    try {
        const func = document.getElementById('new-funcion').value.trim();
        const x0 = parseFloat(document.getElementById('new-x0').value);
        if (!func || isNaN(x0)) return;

        const datos = generarDatosFuncion(func, newtonState.xMin, newtonState.xMax);
        if (!datos || datos.data.every((v) => v === null)) {
            if (mostrarMensaje) throw new Error('No se pudo evaluar la función en el rango. Verifica la sintaxis.');
            return;
        }

        const container = document.getElementById('new-chart-container');
        container.style.display = 'block';

        const puntosExtra = [];
        if (newtonState.lastRoot != null) {
            let yr = 0;
            try { yr = evaluarFuncion(func, newtonState.lastRoot); } catch (_) { yr = 0; }
            puntosExtra.push({ label: `Raíz ≈ ${newtonState.lastRoot.toFixed(5)}`, x: newtonState.lastRoot, y: yr, color: '#dc2626' });
        }
        let y0 = 0;
        try { y0 = evaluarFuncion(func, x0); } catch (_) { y0 = 0; }
        puntosExtra.push({ label: `x0 = ${x0}`, x: x0, y: y0, color: '#f59e0b', radius: 7, style: 'rectRot' });

        const ctx = document.getElementById('new-chart').getContext('2d');
        if (newtonState.instance) newtonState.instance.destroy();
        newtonState.instance = new Chart(
            ctx,
            construirConfigChartGenerico({
                datos,
                titulo: 'Gráfica de f(x) - Newton-Raphson',
                color: '#7c3aed',
                puntosExtra,
                anotacionesSuperiores: [{ x: x0, label: 'x0', color: 'rgb(245, 158, 11)' }],
            })
        );

        actualizarZoomLabel('new-zoom-level', newtonState);
        if (mostrarMensaje) {
            mostrarResultado(
                'new-resultado',
                `<h4>📊 Gráfica generada correctamente</h4>
                 <p>Rango visible: [${newtonState.xMin.toFixed(3)}, ${newtonState.xMax.toFixed(3)}] · Zoom: ${newtonState.zoom.toFixed(2)}×</p>
                 <p>Línea roja punteada marca el eje y=0. El punto naranja es x0. Si ya calculaste la raíz, aparece en rojo.</p>`,
                'success'
            );
        }
    } catch (e) {
        document.getElementById('new-chart-container').style.display = 'none';
        if (mostrarMensaje) mostrarResultado('new-resultado', `<h4>❌ Error al graficar</h4><p>${e.message}</p>`, 'error');
    }
}

function graficarNewton(rootExtra = null) {
    try {
        const func = document.getElementById('new-funcion').value.trim();
        const x0 = parseFloat(document.getElementById('new-x0').value);
        if (!func || isNaN(x0)) throw new Error('Ingresa una función y x0 válidos antes de graficar.');

        const span = 6;
        resetChartView(newtonState, x0, span);
        if (rootExtra != null) newtonState.lastRoot = rootExtra;
        renderNewtonChart(true);
    } catch (e) {
        document.getElementById('new-chart-container').style.display = 'none';
        mostrarResultado('new-resultado', `<h4>❌ Error al graficar</h4><p>${e.message}</p>`, 'error');
    }
}

function zoomInNewton() { aplicarZoom(newtonState, ZOOM_STEP); renderNewtonChart(false); }
function zoomOutNewton() { aplicarZoom(newtonState, 1 / ZOOM_STEP); renderNewtonChart(false); }
function resetZoomNewton() {
    const x0 = parseFloat(document.getElementById('new-x0').value);
    if (isNaN(x0)) return;
    resetChartView(newtonState, x0, 6);
    renderNewtonChart(false);
}

function actualizarGraficoNewtonConRaiz(r) {
    newtonState.lastRoot = r;
    const c = document.getElementById('new-chart-container');
    if (c.style.display === 'none' || !newtonState.instance) { graficarNewton(r); return; }
    renderNewtonChart(false);
}

const rfState = crearChartState();

function renderRFChart(mostrarMensaje = false) {
    try {
        const func = document.getElementById('rf-funcion').value.trim();
        const a = rfState.a, b = rfState.b;
        if (!func || isNaN(a) || isNaN(b)) return;

        const datos = generarDatosFuncion(func, rfState.xMin, rfState.xMax);
        if (!datos || datos.data.every((v) => v === null)) {
            if (mostrarMensaje) throw new Error('No se pudo evaluar la función en el rango. Verifica la sintaxis.');
            return;
        }

        const container = document.getElementById('rf-chart-container');
        container.style.display = 'block';

        const puntosExtra = [];
        if (rfState.lastRoot != null) {
            let yr = 0;
            try { yr = evaluarFuncion(func, rfState.lastRoot); } catch (_) { yr = 0; }
            puntosExtra.push({ label: `Raíz ≈ ${rfState.lastRoot.toFixed(5)}`, x: rfState.lastRoot, y: yr, color: '#dc2626' });
        }

        const ctx = document.getElementById('rf-chart').getContext('2d');
        if (rfState.instance) rfState.instance.destroy();
        rfState.instance = new Chart(
            ctx,
            construirConfigChartGenerico({
                datos,
                titulo: 'Gráfica de f(x) - Regla Falsa',
                color: '#0ea5e9',
                puntosExtra,
                anotacionesSuperiores: [{ x1: a, x2: b, labelA: 'a', labelB: 'b', color: 'rgb(14, 165, 233)' }],
            })
        );

        actualizarZoomLabel('rf-zoom-level', rfState);
        if (mostrarMensaje) {
            mostrarResultado(
                'rf-resultado',
                `<h4>📊 Gráfica generada correctamente</h4>
                 <p>Rango visible: [${rfState.xMin.toFixed(3)}, ${rfState.xMax.toFixed(3)}] · Zoom: ${rfState.zoom.toFixed(2)}×</p>
                 <p>Intervalo [a, b] resaltado en azul. Si ya calculaste la raíz, aparece como punto rojo.</p>`,
                'success'
            );
        }
    } catch (e) {
        document.getElementById('rf-chart-container').style.display = 'none';
        if (mostrarMensaje) mostrarResultado('rf-resultado', `<h4>❌ Error al graficar</h4><p>${e.message}</p>`, 'error');
    }
}

function graficarReglaFalsa(rootExtra = null) {
    try {
        const func = document.getElementById('rf-funcion').value.trim();
        const a = parseFloat(document.getElementById('rf-a').value);
        const b = parseFloat(document.getElementById('rf-b').value);
        if (!func || isNaN(a) || isNaN(b)) throw new Error('Ingresa una función y valores válidos para a y b antes de graficar.');

        rfState.a = a; rfState.b = b;
        const span = (Math.max(a, b) + 2) - (Math.min(a, b) - 2);
        resetChartView(rfState, (a + b) / 2, span);
        if (rootExtra != null) rfState.lastRoot = rootExtra;
        renderRFChart(true);
    } catch (e) {
        document.getElementById('rf-chart-container').style.display = 'none';
        mostrarResultado('rf-resultado', `<h4>❌ Error al graficar</h4><p>${e.message}</p>`, 'error');
    }
}

function zoomInReglaFalsa() { aplicarZoom(rfState, ZOOM_STEP); renderRFChart(false); }
function zoomOutReglaFalsa() { aplicarZoom(rfState, 1 / ZOOM_STEP); renderRFChart(false); }
function resetZoomReglaFalsa() {
    const a = rfState.a, b = rfState.b;
    if (a == null || isNaN(a)) return;
    const span = (Math.max(a, b) + 2) - (Math.min(a, b) - 2);
    resetChartView(rfState, (a + b) / 2, span);
    renderRFChart(false);
}

function actualizarGraficoRFConRaiz(r) {
    rfState.lastRoot = r;
    const c = document.getElementById('rf-chart-container');
    if (c.style.display === 'none' || !rfState.instance) { graficarReglaFalsa(r); return; }
    renderRFChart(false);
}

const pfState = crearChartState();

function generarDatosLineaIdentidad(xMin, xMax, numPuntos = 400) {
    const labels = []; const data = [];
    const paso = (xMax - xMin) / (numPuntos - 1);
    for (let i = 0; i < numPuntos; i++) {
        const x = xMin + i * paso;
        labels.push(Number(x.toFixed(5)));
        data.push(x);
    }
    return { labels, data };
}

function renderPFChart(mostrarMensaje = false) {
    try {
        const g = document.getElementById('pf-g').value.trim();
        const x0 = parseFloat(document.getElementById('pf-x0').value);
        if (!g || isNaN(x0)) return;

        const datosG = generarDatosFuncion(g, pfState.xMin, pfState.xMax);
        if (!datosG || datosG.data.every((v) => v === null)) {
            if (mostrarMensaje) throw new Error('No se pudo evaluar g(x) en el rango. Verifica la sintaxis.');
            return;
        }
        const datosId = generarDatosLineaIdentidad(pfState.xMin, pfState.xMax);

        const container = document.getElementById('pf-chart-container');
        container.style.display = 'block';

        const lineasExtra = [
            {
                label: 'y = x',
                data: datosId.data,
                borderColor: 'rgba(16, 185, 129, 0.85)',
                borderDash: [6, 4],
                borderWidth: 2,
                pointRadius: 0,
                tension: 0,
                fill: false,
            },
        ];

        const puntosExtra = [];
        if (pfState.lastRoot != null) {
            let y = 0;
            try { y = evaluarFuncion(g, pfState.lastRoot); } catch (_) { y = pfState.lastRoot; }
            puntosExtra.push({ label: `Punto fijo ≈ ${pfState.lastRoot.toFixed(5)}`, x: pfState.lastRoot, y, color: '#dc2626' });
        }
        let y0 = 0;
        try { y0 = evaluarFuncion(g, x0); } catch (_) { y0 = 0; }
        puntosExtra.push({ label: `x0 = ${x0}`, x: x0, y: y0, color: '#f59e0b', radius: 7, style: 'rectRot' });

        const valoresValidos = datosG.data.filter((v) => v !== null && isFinite(v));
        const yMax = Math.max(...valoresValidos, ...datosId.data, 5);
        const yMin = Math.min(...valoresValidos, ...datosId.data, -5);
        const yPadding = Math.max(Math.abs(yMax), Math.abs(yMin), 1) * 0.15;

        const datasets = [
            {
                label: 'g(x)',
                data: datosG.data,
                borderColor: '#7c3aed',
                backgroundColor: 'rgba(124, 58, 237, 0.15)',
                borderWidth: 2.5,
                pointRadius: 0,
                tension: 0.25,
                fill: false,
            },
            ...lineasExtra,
        ];
        puntosExtra.forEach((p) => {
            datasets.push({
                label: p.label,
                data: datosG.labels.map((x) => (Math.abs(x - p.x) < 1e-9 ? p.y : null)),
                borderColor: p.color, backgroundColor: p.color,
                pointRadius: p.radius || 9, pointHoverRadius: (p.radius || 9) + 2,
                pointStyle: p.style || 'circle', showLine: false, borderWidth: 0,
            });
        });

        const ctx = document.getElementById('pf-chart').getContext('2d');
        if (pfState.instance) pfState.instance.destroy();
        pfState.instance = new Chart(ctx, {
            type: 'line',
            data: { labels: datosG.labels, datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    title: { display: true, text: 'Gráfica: y = x y y = g(x) - Punto Fijo', font: { size: 15, weight: '600' }, padding: { top: 6, bottom: 12 }, color: '#1e293b' },
                    legend: { position: 'top', labels: { usePointStyle: true, padding: 16, font: { size: 12 } } },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.95)', padding: 12, titleFont: { size: 13 }, bodyFont: { size: 12 },
                        callbacks: {
                            title: (items) => `x ≈ ${Number(items[0].label).toFixed(5)}`,
                            label: (ctx) => ` y ≈ ${(ctx.parsed.y ?? 0).toFixed(6)}`,
                        },
                    },
                },
                scales: {
                    x: { type: 'linear', title: { display: true, text: 'x', font: { size: 13, weight: '600' }, color: '#475569' }, ticks: { color: '#64748b', maxTicksLimit: 12 }, grid: { color: 'rgba(100, 116, 139, 0.12)' } },
                    y: { type: 'linear', title: { display: true, text: 'y', font: { size: 13, weight: '600' }, color: '#475569' }, ticks: { color: '#64748b' }, grid: { color: 'rgba(100, 116, 139, 0.12)' }, suggestedMin: yMin - yPadding, suggestedMax: yMax + yPadding },
                },
            },
        });

        actualizarZoomLabel('pf-zoom-level', pfState);
        if (mostrarMensaje) {
            mostrarResultado(
                'pf-resultado',
                `<h4>📊 Gráfica generada correctamente</h4>
                 <p>Rango visible: [${pfState.xMin.toFixed(3)}, ${pfState.xMax.toFixed(3)}] · Zoom: ${pfState.zoom.toFixed(2)}×</p>
                 <p><span style="color:#7c3aed"><b>Morado:</b> g(x)</span> · <span style="color:#10b981"><b>Verde (punteado):</b> recta y = x</span>. El punto fijo es la intersección. Punto naranja: x0.</p>`,
                'success'
            );
        }
    } catch (e) {
        document.getElementById('pf-chart-container').style.display = 'none';
        if (mostrarMensaje) mostrarResultado('pf-resultado', `<h4>❌ Error al graficar</h4><p>${e.message}</p>`, 'error');
    }
}

function graficarPuntoFijo(rootExtra = null) {
    try {
        const g = document.getElementById('pf-g').value.trim();
        const x0 = parseFloat(document.getElementById('pf-x0').value);
        if (!g || isNaN(x0)) throw new Error('Ingresa g(x) y x0 válidos antes de graficar.');

        const span = 8;
        resetChartView(pfState, x0, span);
        if (rootExtra != null) pfState.lastRoot = rootExtra;
        renderPFChart(true);
    } catch (e) {
        document.getElementById('pf-chart-container').style.display = 'none';
        mostrarResultado('pf-resultado', `<h4>❌ Error al graficar</h4><p>${e.message}</p>`, 'error');
    }
}

function zoomInPuntoFijo() { aplicarZoom(pfState, ZOOM_STEP); renderPFChart(false); }
function zoomOutPuntoFijo() { aplicarZoom(pfState, 1 / ZOOM_STEP); renderPFChart(false); }
function resetZoomPuntoFijo() {
    const x0 = parseFloat(document.getElementById('pf-x0').value);
    if (isNaN(x0)) return;
    resetChartView(pfState, x0, 8);
    renderPFChart(false);
}

function actualizarGraficoPFConRaiz(r) {
    pfState.lastRoot = r;
    const c = document.getElementById('pf-chart-container');
    if (c.style.display === 'none' || !pfState.instance) { graficarPuntoFijo(r); return; }
    renderPFChart(false);
}

document.getElementById('menuToggle').addEventListener('click', function () {
    const nav = document.querySelector('.nav-links');
    nav.classList.toggle('open');
});

document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => {
        document.querySelector('.nav-links').classList.remove('open');
    });
});

const backToTopBtn = document.getElementById('backToTop');
window.addEventListener('scroll', function () {
    if (window.scrollY > 500) {
        backToTopBtn.classList.add('show');
    } else {
        backToTopBtn.classList.remove('show');
    }
});

backToTopBtn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
});
