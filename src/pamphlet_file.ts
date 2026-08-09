import {
    assertPamphletStructure,
    createEmptyPamphlet,
    type CreatePamphletMeta,
    type PamphletStructure,
} from "./pamphlet_schema";

let fileHandle: FileSystemFileHandle | null = null;
let fileName = "";

const JSON_PICKER_TYPES: FilePickerAcceptType[] = [
    {
        description: "Pamphlet JSON",
        accept: { "application/json": [".json"] },
    },
];

export function isFileSystemAccessSupported(): boolean {
    return (
        typeof window !== "undefined" &&
        "showOpenFilePicker" in window &&
        "showSaveFilePicker" in window
    );
}

export function getOpenFileName(): string {
    return fileName;
}

export function hasOpenFile(): boolean {
    return fileHandle !== null;
}

function suggestFileName(meta: CreatePamphletMeta): string {
    const series = meta.series.trim().replace(/[^\w.-]+/g, "_") || "pamphlet";
    const chapter = meta.series_chapter.trim().replace(/[^\w.-]+/g, "_") || "1";
    return `${series}_ch${chapter}.json`;
}

async function readHandle(handle: FileSystemFileHandle): Promise<PamphletStructure> {
    const file = await handle.getFile();
    const text = await file.text();
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error("Invalid JSON: file could not be parsed");
    }
    assertPamphletStructure(parsed);
    return parsed;
}

async function writeHandle(handle: FileSystemFileHandle, data: PamphletStructure): Promise<void> {
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(data, null, 4));
    await writable.close();
}

export async function openPamphletFile(): Promise<PamphletStructure> {
    if (!isFileSystemAccessSupported()) {
        throw new Error(
            "File System Access API is not supported in this browser. Use Chrome or Edge.",
        );
    }

    const [handle] = await window.showOpenFilePicker({
        types: JSON_PICKER_TYPES,
        multiple: false,
    });

    const data = await readHandle(handle);
    fileHandle = handle;
    fileName = handle.name;
    return data;
}

export async function createPamphletFile(meta: CreatePamphletMeta): Promise<PamphletStructure> {
    if (!isFileSystemAccessSupported()) {
        throw new Error(
            "File System Access API is not supported in this browser. Use Chrome or Edge.",
        );
    }

    const title = meta.title.trim();
    const series = meta.series.trim();
    const series_chapter = meta.series_chapter.trim();

    if (!title || !series || !series_chapter) {
        throw new Error("Title, series, and series chapter are required");
    }

    const data = createEmptyPamphlet({ title, series, series_chapter });

    const handle = await window.showSaveFilePicker({
        suggestedName: suggestFileName({ title, series, series_chapter }),
        types: JSON_PICKER_TYPES,
    });

    await writeHandle(handle, data);
    fileHandle = handle;
    fileName = handle.name;
    return data;
}

export async function savePamphlet(data: PamphletStructure): Promise<void> {
    if (!fileHandle) {
        throw new Error("No pamphlet file is open");
    }
    assertPamphletStructure(data);
    await writeHandle(fileHandle, data);
}
