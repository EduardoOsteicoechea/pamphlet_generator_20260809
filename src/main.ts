import "./style.css";
import {
    createPamphletFile,
    getOpenFileName,
    hasOpenFile,
    isFileSystemAccessSupported,
    openPamphletFile,
    savePamphlet,
} from "./pamphlet_file";
import { renderFromPamphlet, serializePamphlet } from "./pamphlet_io";
import type { PamphletHeader, PamphletStructure } from "./pamphlet_schema";

function requireElement<T extends HTMLElement>(selector: string): T {
    const el = document.querySelector<T>(selector);
    if (!el) throw new Error(`Missing element: ${selector}`);
    return el;
}

const main = requireElement<HTMLElement>("main");
const statusEl = requireElement<HTMLElement>("#file-status");
const errorEl = requireElement<HTMLElement>("#file-error");
const openBtn = requireElement<HTMLButtonElement>("#btn-open");
const createBtn = requireElement<HTMLButtonElement>("#btn-create");
const printBtn = requireElement<HTMLButtonElement>("#btn-print");
const titleInput = requireElement<HTMLInputElement>("#input-title");
const seriesInput = requireElement<HTMLInputElement>("#input-series");
const chapterInput = requireElement<HTMLInputElement>("#input-chapter");

const usLetterHeightInMillimeters = 215.9;
const pageMarginMm = 10;
/** Usable column height inside each landscape sheet (215.9 − 10 − 10). */
const columnContentHeightMm = usLetterHeightInMillimeters - pageMarginMm * 2;

let currentHeader: PamphletHeader | null = null;

function convertPixelsToMillimeters(px: number): number {
    return px * (25.4 / 96);
}

function setError(message: string): void {
    errorEl.textContent = message;
}

function clearError(): void {
    errorEl.textContent = "";
}

function setStatus(message: string): void {
    statusEl.textContent = message;
}

function reflowAndReport(container: HTMLElement, maxColHeightMm: number) {
    const items = Array.from(document.querySelectorAll(".pamphlet-item")) as HTMLElement[];

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
        const index = container.querySelectorAll(":scope > .dumb-column").length + 1;
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
        currentColumnDiv.appendChild(item);

        const heightPx = item.getBoundingClientRect().height;
        const heightMm = convertPixelsToMillimeters(heightPx);

        if (currentColumnFilledMm + heightMm > maxColHeightMm && currentColumnItemsCount > 0) {
            report.columns.push({
                columnIndex,
                itemCount: currentColumnItemsCount,
                filledHeightMm: Number(currentColumnFilledMm.toFixed(2)),
                remainingSpaceMm: Number((maxColHeightMm - currentColumnFilledMm).toFixed(2)),
            });

            columnIndex++;
            currentColumnDiv = createAndAppendColumn();
            currentColumnDiv.appendChild(item);

            currentColumnFilledMm = heightMm;
            currentColumnItemsCount = 1;
        } else {
            currentColumnFilledMm += heightMm;
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

    // Keep exactly 8 column slots in the DOM for serialize round-trips
    while (container.querySelectorAll(":scope > .dumb-column").length < 8) {
        createAndAppendColumn();
    }

    console.log("--- Auto-Reflow Layout Report ---");
    console.log(report);
}

function loadPamphlet(data: PamphletStructure): void {
    currentHeader = { ...data.header };
    renderFromPamphlet(main, data);
    reflowAndReport(main, columnContentHeightMm);
    setStatus(`Open: ${getOpenFileName()}`);
    clearError();
}

async function persistPamphlet(): Promise<void> {
    if (!hasOpenFile() || !currentHeader) {
        setError("No pamphlet file is open. Open or create a file first.");
        return;
    }

    try {
        const data = serializePamphlet(main, currentHeader);
        await savePamphlet(data);
        setStatus(`Saved: ${getOpenFileName()}`);
        clearError();
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(`Save failed: ${message}`);
    }
}

main.addEventListener("item-edited", () => {
    reflowAndReport(main, columnContentHeightMm);
});

main.addEventListener("pamphlet-save", () => {
    void persistPamphlet();
});

openBtn.addEventListener("click", async () => {
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

createBtn.addEventListener("click", async () => {
    clearError();
    try {
        const data = await createPamphletFile({
            title: titleInput.value,
            series: seriesInput.value,
            series_chapter: chapterInput.value,
        });
        loadPamphlet(data);
    } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : String(err);
        setError(`Create failed: ${message}`);
    }
});

printBtn.addEventListener("click", () => {
    window.print();
});

if (!isFileSystemAccessSupported()) {
    setError("File System Access API is not supported. Use Chrome or Edge.");
    openBtn.disabled = true;
    createBtn.disabled = true;
} else {
    setStatus("No file open — open an existing JSON or create a new one.");
}
