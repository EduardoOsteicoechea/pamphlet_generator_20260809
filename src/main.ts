import "./style.css";
import Toastify from "toastify-js";
import "toastify-js/src/toastify.css";
import type { PamphletTrayAction } from "./create_element";
import {
    applyBoldRange,
    clonePamphlet,
    deleteItem,
    getRegionItems,
    insertItem,
    moveItemDown,
    moveItemUp,
    newSiblingItem,
    resolveLocation,
    updateItemContent,
} from "./pamphlet_doc";
import {
    createPamphletFile,
    getOpenFileName,
    hasOpenFile,
    isFileSystemAccessSupported,
    openPamphletFile,
    savePamphlet,
} from "./pamphlet_file";
import {
    createItemSpacer,
    getFlatIndex,
    getItemLocation,
    isHeaderItem,
    renderFromPamphlet,
    renderPageChrome,
    serializePamphlet,
    syncItemContentFromTextarea,
} from "./pamphlet_io";
import {
    FOOTER_COLUMN,
    HEADER_COLUMN,
    HEADER_FIELD_KEYS,
    type HeaderFieldKey,
    type LastEditedElement,
    type PamphletHeader,
    type PamphletStructure,
} from "./pamphlet_schema";

function requireElement<T extends HTMLElement>(selector: string): T {
    const el = document.querySelector<T>(selector);
    if (!el) throw new Error(`Missing element: ${selector}`);
    return el;
}

const main = requireElement<HTMLElement>("main");
const openBtn = requireElement<HTMLButtonElement>("#btn-open");
const createBtn = requireElement<HTMLButtonElement>("#btn-create");
const printBtn = requireElement<HTMLButtonElement>("#btn-print");
const menuBtn = requireElement<HTMLButtonElement>("#btn-menu");
const sidebar = requireElement<HTMLElement>("#app-sidebar");
const sidebarBackdrop = requireElement<HTMLElement>("#sidebar-backdrop");
const createModal = requireElement<HTMLDialogElement>("#create-modal");
const createForm = requireElement<HTMLFormElement>("#create-form");
const modalCancelBtn = requireElement<HTMLButtonElement>("#modal-cancel");
const modalTitle = requireElement<HTMLInputElement>("#modal-title");
const modalSeries = requireElement<HTMLInputElement>("#modal-series");
const modalChapter = requireElement<HTMLInputElement>("#modal-chapter");
const modalAuthor = requireElement<HTMLInputElement>("#modal-author");

function updatePrintAvailability(): void {
    printBtn.disabled = !hasOpenFile() || !currentDoc;
}

function setSidebarOpen(open: boolean): void {
    sidebar.classList.toggle("is-open", open);
    sidebar.setAttribute("aria-hidden", open ? "false" : "true");
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    sidebarBackdrop.hidden = !open;
}

function closeSidebar(): void {
    setSidebarOpen(false);
}

function toggleSidebar(): void {
    setSidebarOpen(!sidebar.classList.contains("is-open"));
}

const usLetterHeightInMillimeters = 215.9;
const pageMarginMm = 10;
const columnContentHeightMm = usLetterHeightInMillimeters - pageMarginMm * 2;

let currentHeader: PamphletHeader | null = null;
let currentDoc: PamphletStructure | null = null;
let undoSnapshot: PamphletStructure | null = null;
let suppressEditOpenSave = false;

function convertPixelsToMillimeters(px: number): number {
    return px * (25.4 / 96);
}

type ToastKind = "info" | "success" | "error";

function showToast(message: string, kind: ToastKind = "info"): void {
    Toastify({
        text: message,
        duration: kind === "error" ? 5000 : 3200,
        gravity: "top",
        position: "left",
        stopOnFocus: true,
        close: true,
        className: `app-toast app-toast--${kind}`,
    }).showToast();
}

function setError(message: string): void {
    showToast(message, "error");
}

function clearError(): void {
    // Errors are ephemeral toasts; nothing persistent to clear.
}

function setStatus(message: string, kind: ToastKind = "info"): void {
    showToast(message, kind);
}

function reflowAndReport(container: HTMLElement, maxColHeightMm: number) {
    const items = Array.from(
        container.querySelectorAll<HTMLElement>(
            ":scope > .dumb-column[class*='pamphlet-column-'] > .pamphlet-item",
        ),
    );
    container.innerHTML = "";

    const report = {
        config: { maxColumnHeightMm: maxColHeightMm, columnWidth: "60.35mm" },
        columns: [] as {
            columnIndex: number;
            itemCount: number;
            filledHeightMm: number;
            remainingSpaceMm: number;
        }[],
        totalItemsProcessed: items.length,
    };

    function createAndAppendColumn() {
        const index = container.querySelectorAll(
            ":scope > .dumb-column[class*='pamphlet-column-']",
        ).length + 1;
        const col = document.createElement("div");
        col.className = `dumb-column pamphlet-column-${index}`;
        container.appendChild(col);
        return col;
    }

    let currentColumnDiv = createAndAppendColumn();
    let currentColumnFilledMm = 0;
    let currentColumnItemsCount = 0;
    let columnIndex = 1;

    items.forEach((item) => {
        // Drop a stale spacer if this item was still paired in the previous layout
        const staleSpacer = item.nextElementSibling;
        if (staleSpacer?.classList.contains("pamphlet-item-spacer")) {
            staleSpacer.remove();
        }

        const spacer = createItemSpacer();
        currentColumnDiv.appendChild(item);
        currentColumnDiv.appendChild(spacer);

        const itemMm = convertPixelsToMillimeters(item.getBoundingClientRect().height);
        const spacerMm = convertPixelsToMillimeters(spacer.getBoundingClientRect().height);
        const blockMm = itemMm + spacerMm;

        if (currentColumnFilledMm + blockMm > maxColHeightMm && currentColumnItemsCount > 0) {
            report.columns.push({
                columnIndex,
                itemCount: currentColumnItemsCount,
                filledHeightMm: Number(currentColumnFilledMm.toFixed(2)),
                remainingSpaceMm: Number((maxColHeightMm - currentColumnFilledMm).toFixed(2)),
            });

            columnIndex++;
            currentColumnDiv = createAndAppendColumn();
            currentColumnDiv.appendChild(item);
            currentColumnDiv.appendChild(spacer);

            currentColumnFilledMm = blockMm;
            currentColumnItemsCount = 1;
        } else {
            currentColumnFilledMm += blockMm;
            currentColumnItemsCount++;
        }
    });

    if (currentColumnItemsCount > 0) {
        report.columns.push({
            columnIndex,
            itemCount: currentColumnItemsCount,
            filledHeightMm: Number(currentColumnFilledMm.toFixed(2)),
            remainingSpaceMm: Number((maxColHeightMm - currentColumnFilledMm).toFixed(2)),
        });
    }

    while (
        container.querySelectorAll(":scope > .dumb-column[class*='pamphlet-column-']").length < 8
    ) {
        createAndAppendColumn();
    }

    if (currentDoc) {
        renderPageChrome(container, currentDoc);
    }

    console.log("--- Auto-Reflow Layout Report ---");
    console.log(report);
}

function clickInner(target: HTMLElement | undefined): void {
    if (!target) return;
    const inner = target.firstElementChild as HTMLElement | null;
    if (!inner) return;
    suppressEditOpenSave = true;
    requestAnimationFrame(() => {
        inner.click();
        suppressEditOpenSave = false;
    });
}

function activateEditAt(data: PamphletStructure, loc: LastEditedElement): void {
    if (loc.column === HEADER_COLUMN) {
        const items = Array.from(
            main.querySelectorAll<HTMLElement>(
                ":scope > .pamphlet-page-header > .pamphlet-item[data-header-field]",
            ),
        );
        clickInner(items[Math.min(Math.max(loc.index, 0), items.length - 1)]);
        return;
    }

    if (loc.column === FOOTER_COLUMN) {
        const items = Array.from(
            main.querySelectorAll<HTMLElement>(":scope > .pamphlet-page-footer > .pamphlet-item"),
        );
        if (items.length === 0) return;
        clickInner(items[Math.min(Math.max(loc.index, 0), items.length - 1)]);
        return;
    }

    const flat = getFlatIndex(data, loc);
    const items = Array.from(
        main.querySelectorAll<HTMLElement>(
            ":scope > .dumb-column[class*='pamphlet-column-'] > .pamphlet-item",
        ),
    );
    if (items.length === 0) return;
    clickInner(items[Math.min(Math.max(flat, 0), items.length - 1)]);
}

function renderDocument(data: PamphletStructure, openEdit: boolean): void {
    currentDoc = data;
    currentHeader = { ...data.header };
    renderFromPamphlet(main, data);
    reflowAndReport(main, columnContentHeightMm);
    if (openEdit) {
        activateEditAt(data, data.last_edited_element);
    }
}

async function commitDocument(data: PamphletStructure, openEdit: boolean): Promise<void> {
    if (!hasOpenFile()) {
        setError("No pamphlet file is open. Open or create a file first.");
        return;
    }

    try {
        await savePamphlet(data);
        renderDocument(data, openEdit);
        setStatus(`Saved: ${getOpenFileName()}`, "success");
        clearError();
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`Save failed: ${message}`);
    }
}

function pushUndoSnapshot(): void {
    if (currentDoc) {
        undoSnapshot = clonePamphlet(currentDoc);
    }
}

function snapshotFromDom(lastEdited: LastEditedElement): PamphletStructure | null {
    if (!currentDoc) return null;
    return serializePamphlet(main, lastEdited);
}

function locationFromContainer(container: HTMLElement): LastEditedElement | null {
    return getItemLocation(container);
}

function syncContentIntoDoc(
    container: HTMLElement,
    data: PamphletStructure,
): LastEditedElement | null {
    syncItemContentFromTextarea(container);
    const loc = locationFromContainer(container);
    if (!loc) return null;

    const tray = container.querySelector<HTMLTextAreaElement>(".edit_tray_text_area");
    const content = tray?.value ?? "";

    if (loc.column === HEADER_COLUMN) {
        const field = container.getAttribute("data-header-field") as HeaderFieldKey | null;
        if (field && HEADER_FIELD_KEYS.includes(field)) {
            data.header[field] = content;
        }
        return loc;
    }

    const resolved = resolveLocation(data, loc);
    if (!resolved) return null;
    updateItemContent(data, resolved, content);
    return resolved;
}

async function handleTrayAction(detail: PamphletTrayAction): Promise<void> {
    if (!currentDoc || !currentHeader) {
        setError("No pamphlet file is open.");
        return;
    }

    if (detail.action === "edit-open") {
        if (suppressEditOpenSave) return;
        const loc = locationFromContainer(detail.container);
        if (!loc) return;
        const next = snapshotFromDom(loc);
        if (!next) return;
        currentDoc = next;
        currentHeader = { ...next.header };
        try {
            await savePamphlet(next);
            setStatus(`Saved: ${getOpenFileName()}`, "success");
            clearError();
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(`Save failed: ${message}`);
        }
        return;
    }

    if (detail.action === "undo") {
        if (isHeaderItem(detail.container)) return;
        if (!undoSnapshot) {
            setError("Nothing to undo.");
            return;
        }
        const restored = clonePamphlet(undoSnapshot);
        undoSnapshot = currentDoc ? clonePamphlet(currentDoc) : null;
        await commitDocument(restored, true);
        return;
    }

    const base = snapshotFromDom(currentDoc.last_edited_element);
    if (!base) return;

    const loc = syncContentIntoDoc(detail.container, base);
    if (!loc) return;

    // Header: only close updates JSON (undo is local in the tray)
    if (loc.column === HEADER_COLUMN) {
        if (detail.action !== "close") return;
        base.last_edited_element = loc;
        currentHeader = { ...base.header };
        pushUndoSnapshot();
        await commitDocument(base, false);
        return;
    }

    let nextDoc: PamphletStructure | null = null;
    let openEdit = true;

    switch (detail.action) {
        case "close": {
            base.last_edited_element = loc;
            nextDoc = base;
            openEdit = false;
            break;
        }
        case "move-up": {
            const nextLoc = moveItemUp(base, loc);
            if (!nextLoc) return;
            base.last_edited_element = nextLoc;
            nextDoc = base;
            break;
        }
        case "move-down": {
            const nextLoc = moveItemDown(base, loc);
            if (!nextLoc) return;
            base.last_edited_element = nextLoc;
            nextDoc = base;
            break;
        }
        case "add-above": {
            const items = getRegionItems(base, loc.column);
            const template = items[loc.index] ?? {
                type: "paragraph" as const,
                content: "Escribe aquí",
                style_indexes: [[0, 0], [0, 0], [0, 0]] as [[number, number], [number, number], [number, number]],
            };
            base.last_edited_element = insertItem(base, loc, newSiblingItem(template), "above");
            nextDoc = base;
            break;
        }
        case "add-below": {
            const items = getRegionItems(base, loc.column);
            const template = items[loc.index] ?? {
                type: "paragraph" as const,
                content: "Escribe aquí",
                style_indexes: [[0, 0], [0, 0], [0, 0]] as [[number, number], [number, number], [number, number]],
            };
            base.last_edited_element = insertItem(base, loc, newSiblingItem(template), "below");
            nextDoc = base;
            break;
        }
        case "bold": {
            applyBoldRange(base, loc, detail.start, detail.end);
            base.last_edited_element = loc;
            nextDoc = base;
            break;
        }
        case "delete": {
            const confirmed = window.confirm("¿Seguro que quieres borrar este elemento?");
            if (!confirmed) return;
            const { focus } = deleteItem(base, loc);
            base.last_edited_element = focus;
            nextDoc = base;
            break;
        }
    }

    if (!nextDoc) return;
    pushUndoSnapshot();
    await commitDocument(nextDoc, openEdit);
}

function loadPamphlet(data: PamphletStructure): void {
    undoSnapshot = null;
    renderDocument(data, false);
    setStatus(`Open: ${getOpenFileName()}`, "success");
    clearError();
    updatePrintAvailability();
}

main.addEventListener("pamphlet-tray-action", (event: Event) => {
    const custom = event as CustomEvent<PamphletTrayAction>;
    void handleTrayAction(custom.detail);
});

menuBtn.addEventListener("click", () => {
    toggleSidebar();
});

sidebarBackdrop.addEventListener("click", () => {
    closeSidebar();
});

openBtn.addEventListener("click", async () => {
    closeSidebar();
    clearError();
    try {
        const data = await openPamphletFile();
        loadPamphlet(data);
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : String(err);
        setError(`Open failed: ${message}`);
    }
});

function openCreateModal(): void {
    clearError();
    createForm.reset();
    createModal.showModal();
    modalTitle.focus();
}

function closeCreateModal(): void {
    if (createModal.open) createModal.close();
}

createBtn.addEventListener("click", () => {
    closeSidebar();
    openCreateModal();
});

modalCancelBtn.addEventListener("click", () => {
    closeCreateModal();
});

createForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    const title = modalTitle.value.trim();
    const series = modalSeries.value.trim();
    const series_chapter = modalChapter.value.trim();
    const author = modalAuthor.value.trim();

    if (!title || !series || !series_chapter || !author) {
        setError("Completa título, serie, capítulo y autor.");
        return;
    }

    try {
        const data = await createPamphletFile({
            title,
            series,
            series_chapter,
            author,
        });
        closeCreateModal();
        loadPamphlet(data);
        activateEditAt(data, { column: HEADER_COLUMN, index: 0 });
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : String(err);
        setError(`Create failed: ${message}`);
    }
});

printBtn.addEventListener("click", () => {
    if (printBtn.disabled) return;
    closeSidebar();
    window.print();
});

updatePrintAvailability();

if (!isFileSystemAccessSupported()) {
    setError("File System Access API is not supported. Use Chrome or Edge.");
    openBtn.disabled = true;
    createBtn.disabled = true;
} else {
    setStatus("No file open — open an existing .epam or create a new one.");
}
