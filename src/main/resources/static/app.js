const STATUS = ["A_FAZER", "FAZENDO", "CONCLUIDA"];
const CORES = ["blue", "purple", "green", "orange"];
const DOTS = { blue: "#77c8f2", purple: "#9c7bea", green: "#65bf9b", orange: "#f0ad64" };

let tarefas = [];
let listas = [];
let filtro = { tipo: "todas", id: null };

const hoje = new Date().toLocaleDateString("sv-SE"); // AAAA-MM-DD

async function api(url, method = "GET", body) {
    const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
    });
    if (!r.ok) throw new Error("Erro " + r.status);
    return r.status === 204 ? null : r.json();
}

const corDaLista = (l) => CORES[Math.abs(l.id) % CORES.length];

function diasAte(data) {
    return Math.round((new Date(data + "T00:00") - new Date(hoje + "T00:00")) / 86400000);
}

function rotuloData(data) {
    if (!data) return "";
    const d = diasAte(data);
    if (d === 0) return "Hoje";
    if (d === 1) return "Amanhã";
    if (d === -1) return "Ontem";
    return new Date(data + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function passaFiltro(t) {
    switch (filtro.tipo) {
        case "hoje": return t.dataEntrega && diasAte(t.dataEntrega) <= 0 && t.status !== "CONCLUIDA";
        case "semana": return t.dataEntrega && diasAte(t.dataEntrega) >= 0 && diasAte(t.dataEntrega) <= 7;
        case "lista": return t.lista && t.lista.id === filtro.id;
        default: return true;
    }
}

async function carregar() {
    try {
        [tarefas, listas] = await Promise.all([api("/api/tarefas"), api("/api/listas")]);
        render();
    } catch (e) {
        alert("Não foi possível conectar à API. O servidor está rodando?");
    }
}

function render() {
    renderSidebar();
    renderSelect();
    STATUS.forEach((s) => {
        const col = document.getElementById("col-" + s);
        col.innerHTML = "";
        const itens = tarefas.filter((t) => t.status === s && passaFiltro(t));
        itens.forEach((t) => col.appendChild(criarCard(t)));
        document.getElementById("n-" + s).textContent = itens.length;
    });
}

function renderSidebar() {
    document.getElementById("c-todas").textContent = tarefas.length;
    document.getElementById("c-hoje").textContent = tarefas.filter(
        (t) => t.dataEntrega && diasAte(t.dataEntrega) <= 0 && t.status !== "CONCLUIDA").length;
    document.getElementById("c-semana").textContent = tarefas.filter(
        (t) => t.dataEntrega && diasAte(t.dataEntrega) >= 0 && diasAte(t.dataEntrega) <= 7).length;

    const nav = document.getElementById("nav-listas");
    nav.innerHTML = "";
    listas.forEach((l) => {
        const a = document.createElement("a");
        a.href = "#";
        a.className = "nav-item";
        a.dataset.filtro = "lista";
        a.dataset.id = l.id;

        const nome = document.createElement("span");
        const dot = document.createElement("i");
        dot.className = "list-dot";
        dot.style.background = DOTS[corDaLista(l)];
        nome.append(dot, l.nome);

        const qtd = document.createElement("strong");
        qtd.textContent = tarefas.filter((t) => t.lista && t.lista.id === l.id).length;

        a.append(nome, qtd);
        nav.appendChild(a);
    });

    document.querySelectorAll("#nav .nav-item").forEach((a) => {
        const ativo = a.dataset.filtro === filtro.tipo &&
            (filtro.tipo !== "lista" || Number(a.dataset.id) === filtro.id);
        a.classList.toggle("active", ativo);
    });

    const titulo = { todas: "Todas", hoje: "Hoje", semana: "Próximos 7 dias" }[filtro.tipo];
    const lista = listas.find((l) => l.id === filtro.id);
    document.getElementById("titulo-pagina").textContent = titulo || (lista ? lista.nome : "");
}

function renderSelect() {
    const sel = document.getElementById("select-lista");
    const atual = sel.value;
    sel.innerHTML = "";
    sel.add(new Option("Sem lista", ""));
    listas.forEach((l) => sel.add(new Option(l.nome, l.id)));
    sel.value = filtro.tipo === "lista" ? String(filtro.id) : atual;
}

function criarCard(t) {
    const card = document.createElement("article");
    card.className = "task-card" + (t.status === "CONCLUIDA" ? " completed" : "");
    card.draggable = true;
    card.addEventListener("dragstart", (e) => e.dataTransfer.setData("text/plain", t.id));

    const linha = document.createElement("div");
    linha.className = "task-title-row";

    const check = document.createElement("button");
    check.type = "button";
    check.className = "check-button" + (t.status === "CONCLUIDA" ? " checked" : "");
    check.textContent = t.status === "CONCLUIDA" ? "✓" : "";
    check.addEventListener("click", () =>
        mudarStatus(t, t.status === "CONCLUIDA" ? "A_FAZER" : "CONCLUIDA"));

    const h3 = document.createElement("h3");
    h3.textContent = t.titulo;
    h3.title = "Clique para editar";
    h3.style.cursor = "text";
    h3.addEventListener("click", () => editarTitulo(t));

    const menu = document.createElement("button");
    menu.type = "button";
    menu.className = "card-menu";
    menu.textContent = "•••";
    menu.title = "Excluir";
    menu.addEventListener("click", () => excluir(t));

    linha.append(check, h3, menu);
    card.appendChild(linha);

    const meta = document.createElement("div");
    meta.className = "task-meta";
    if (t.lista) {
        const tag = document.createElement("span");
        tag.className = "tag tag-" + corDaLista(t.lista);
        tag.textContent = t.lista.nome;
        meta.appendChild(tag);
    }
    if (t.dataEntrega) {
        const d = document.createElement("span");
        d.className = "due-date";
        d.textContent = rotuloData(t.dataEntrega);
        meta.appendChild(d);
    }
    card.appendChild(meta);
    return card;
}

async function mudarStatus(t, status) {
    try {
        await api(`/api/tarefas/${t.id}`, "PUT", { ...t, status });
        await carregar();
    } catch (e) { alert("Erro ao atualizar a tarefa."); }
}

async function editarTitulo(t) {
    const novo = prompt("Editar tarefa:", t.titulo);
    if (novo === null || !novo.trim()) return;
    try {
        await api(`/api/tarefas/${t.id}`, "PUT", { ...t, titulo: novo.trim() });
        await carregar();
    } catch (e) { alert("Erro ao editar."); }
}

async function excluir(t) {
    if (!confirm(`Excluir "${t.titulo}"?`)) return;
    try {
        await api(`/api/tarefas/${t.id}`, "DELETE");
        await carregar();
    } catch (e) { alert("Erro ao excluir."); }
}

async function criarTarefa(titulo, status, listaId, data) {
    try {
        await api("/api/tarefas", "POST", {
            titulo,
            status,
            lista: listaId ? { id: Number(listaId) } : null,
            dataEntrega: data || null
        });
        await carregar();
    } catch (e) { alert("Erro ao criar a tarefa."); }
}

// Formulário rápido
document.getElementById("form-rapido").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("input-titulo");
    const titulo = input.value.trim();
    if (!titulo) return;
    await criarTarefa(titulo, "A_FAZER",
        document.getElementById("select-lista").value,
        document.getElementById("input-data").value);
    input.value = "";
    document.getElementById("input-data").value = "";
});

document.getElementById("btn-nova-tarefa").addEventListener("click", () =>
    document.getElementById("input-titulo").focus());

// Botões "+" das colunas
document.querySelectorAll("[data-add]").forEach((b) =>
    b.addEventListener("click", async () => {
        const titulo = prompt("Nome da tarefa:");
        if (!titulo || !titulo.trim()) return;
        await criarTarefa(titulo.trim(), b.dataset.add,
            filtro.tipo === "lista" ? filtro.id : "", "");
    }));

// Arrastar e soltar entre colunas
document.querySelectorAll(".task-column").forEach((col) => {
    col.addEventListener("dragover", (e) => e.preventDefault());
    col.addEventListener("drop", (e) => {
        e.preventDefault();
        const t = tarefas.find((x) => x.id === Number(e.dataTransfer.getData("text/plain")));
        if (t && t.status !== col.dataset.status) mudarStatus(t, col.dataset.status);
    });
});

// Filtros da barra lateral
document.getElementById("nav").addEventListener("click", (e) => {
    const a = e.target.closest(".nav-item");
    if (!a) return;
    e.preventDefault();
    filtro = { tipo: a.dataset.filtro, id: a.dataset.id ? Number(a.dataset.id) : null };
    render();
});

// Nova lista
document.getElementById("btn-nova-lista").addEventListener("click", async () => {
    const nome = prompt("Nome da nova lista:");
    if (!nome || !nome.trim()) return;
    try {
        await api("/api/listas", "POST", { nome: nome.trim() });
        await carregar();
    } catch (e) { alert("Erro ao criar a lista."); }
});

document.getElementById("data-hoje").textContent =
    new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();

carregar();