export type StyleIndexes = [[number, number], [number, number], [number, number]];

export type PamphletItemType = "paragraph" | "heading_1";

export interface PamphletItem {
    type: PamphletItemType;
    content: string;
    style_indexes: StyleIndexes;
}

export interface PamphletHeader {
    title: string;
    subtitle: string;
    author: string;
    series: string;
    series_chapter: string;
    date: string;
}

export interface PamphletFooter {
    items: PamphletItem[];
}

/**
 * column: 0 = header field, 1–8 = body columns, 9 = footer
 * index: item/field index within that region
 */
export interface LastEditedElement {
    column: number;
    index: number;
}

export const HEADER_COLUMN = 0;
export const FOOTER_COLUMN = 9;

export const HEADER_FIELD_KEYS = [
    "title",
    "subtitle",
    "author",
    "series",
    "series_chapter",
    "date",
] as const;

export type HeaderFieldKey = (typeof HEADER_FIELD_KEYS)[number];

export const COLUMN_KEYS = [
    "column_1",
    "column_2",
    "column_3",
    "column_4",
    "column_5",
    "column_6",
    "column_7",
    "column_8",
] as const;

export type ColumnKey = (typeof COLUMN_KEYS)[number];

export type PamphletStructure = {
    type: "pamphlet_single_sheet";
    header: PamphletHeader;
    footer: PamphletFooter;
    last_edited_element: LastEditedElement;
} & Record<ColumnKey, PamphletItem[]>;

export const DEFAULT_STYLE_INDEXES: StyleIndexes = [[0, 0], [0, 0], [0, 0]];

const ROOT_KEYS = ["type", "header", "footer", "last_edited_element", ...COLUMN_KEYS] as const;
const HEADER_KEYS = [
    "title",
    "subtitle",
    "author",
    "series",
    "series_chapter",
    "date",
] as const;
const FOOTER_KEYS = ["items"] as const;
const LAST_EDITED_KEYS = ["column", "index"] as const;
const ITEM_KEYS = ["type", "content", "style_indexes"] as const;
const ITEM_TYPES = new Set<string>(["paragraph", "heading_1"]);

function assertExactKeys(obj: object, expected: readonly string[], label: string): void {
    const keys = Object.keys(obj).sort();
    const want = [...expected].sort();
    if (keys.length !== want.length || keys.some((k, i) => k !== want[i])) {
        throw new Error(
            `${label}: expected keys [${want.join(", ")}], got [${keys.join(", ")}]`,
        );
    }
}

function assertString(value: unknown, label: string): asserts value is string {
    if (typeof value !== "string") {
        throw new Error(`${label} must be a string`);
    }
}

function assertNonNegativeInt(value: unknown, label: string): asserts value is number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
        throw new Error(`${label} must be a non-negative integer`);
    }
}

function assertStyleIndexes(value: unknown, label: string): asserts value is StyleIndexes {
    if (!Array.isArray(value) || value.length !== 3) {
        throw new Error(`${label} must be an array of 3 [start, end] pairs`);
    }
    for (let i = 0; i < 3; i++) {
        const pair = value[i];
        if (
            !Array.isArray(pair) ||
            pair.length !== 2 ||
            typeof pair[0] !== "number" ||
            typeof pair[1] !== "number"
        ) {
            throw new Error(`${label}[${i}] must be [number, number]`);
        }
    }
}

function assertPamphletItem(value: unknown, label: string): asserts value is PamphletItem {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${label} must be an object`);
    }
    assertExactKeys(value, ITEM_KEYS, label);
    const item = value as Record<string, unknown>;
    assertString(item.type, `${label}.type`);
    if (!ITEM_TYPES.has(item.type)) {
        throw new Error(`${label}.type must be "paragraph" or "heading_1"`);
    }
    assertString(item.content, `${label}.content`);
    assertStyleIndexes(item.style_indexes, `${label}.style_indexes`);
}

function assertLastEditedElement(
    value: unknown,
    label: string,
): asserts value is LastEditedElement {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`${label} must be an object`);
    }
    assertExactKeys(value, LAST_EDITED_KEYS, label);
    const loc = value as Record<string, unknown>;
    assertNonNegativeInt(loc.column, `${label}.column`);
    assertNonNegativeInt(loc.index, `${label}.index`);
    if (loc.column < 0 || loc.column > 9) {
        throw new Error(`${label}.column must be between 0 and 9`);
    }
}

export function assertPamphletStructure(data: unknown): asserts data is PamphletStructure {
    if (typeof data !== "object" || data === null || Array.isArray(data)) {
        throw new Error("Pamphlet JSON must be an object");
    }

    assertExactKeys(data, ROOT_KEYS, "Root");

    const root = data as Record<string, unknown>;
    if (root.type !== "pamphlet_single_sheet") {
        throw new Error('Root.type must be "pamphlet_single_sheet"');
    }

    if (typeof root.header !== "object" || root.header === null || Array.isArray(root.header)) {
        throw new Error("header must be an object");
    }
    assertExactKeys(root.header, HEADER_KEYS, "header");
    const header = root.header as Record<string, unknown>;
    for (const key of HEADER_KEYS) {
        assertString(header[key], `header.${key}`);
    }

    if (typeof root.footer !== "object" || root.footer === null || Array.isArray(root.footer)) {
        throw new Error("footer must be an object");
    }
    assertExactKeys(root.footer, FOOTER_KEYS, "footer");
    const footer = root.footer as Record<string, unknown>;
    if (!Array.isArray(footer.items)) {
        throw new Error("footer.items must be an array");
    }
    footer.items.forEach((item, index) => {
        assertPamphletItem(item, `footer.items[${index}]`);
    });

    assertLastEditedElement(root.last_edited_element, "last_edited_element");

    for (const col of COLUMN_KEYS) {
        const items = root[col];
        if (!Array.isArray(items)) {
            throw new Error(`${col} must be an array`);
        }
        items.forEach((item, index) => {
            assertPamphletItem(item, `${col}[${index}]`);
        });
    }
}

export interface CreatePamphletMeta {
    title: string;
    series: string;
    series_chapter: string;
    author: string;
}

export function createStarterItem(): PamphletItem {
    return {
        type: "paragraph",
        content: "Escribe aquí",
        style_indexes: [[0, 0], [0, 0], [0, 0]],
    };
}

export function createEmptyPamphlet(meta: CreatePamphletMeta): PamphletStructure {
    return {
        type: "pamphlet_single_sheet",
        header: {
            title: meta.title,
            subtitle: "",
            author: meta.author,
            series: meta.series,
            series_chapter: meta.series_chapter,
            date: new Date().toISOString().slice(0, 10),
        },
        footer: { items: [createStarterItem()] },
        last_edited_element: { column: 1, index: 0 },
        column_1: [createStarterItem()],
        column_2: [],
        column_3: [],
        column_4: [],
        column_5: [],
        column_6: [],
        column_7: [],
        column_8: [],
    };
}

export function itemTypeToTag(type: PamphletItemType): string {
    return type === "heading_1" ? "h1" : "p";
}

export function tagToItemType(tag: string): PamphletItemType {
    return tag.toLowerCase() === "h1" ? "heading_1" : "paragraph";
}

export function columnKey(column: number): ColumnKey {
    return COLUMN_KEYS[column - 1];
}
