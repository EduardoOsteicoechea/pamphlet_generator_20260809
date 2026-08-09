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
} & Record<ColumnKey, PamphletItem[]>;

export const DEFAULT_STYLE_INDEXES: StyleIndexes = [[0, 0], [0, 0], [0, 0]];

const ROOT_KEYS = ["type", "header", ...COLUMN_KEYS] as const;
const HEADER_KEYS = [
    "title",
    "subtitle",
    "author",
    "series",
    "series_chapter",
    "date",
] as const;
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
}

export function createEmptyPamphlet(meta: CreatePamphletMeta): PamphletStructure {
    const pamphlet = {
        type: "pamphlet_single_sheet" as const,
        header: {
            title: meta.title,
            subtitle: "",
            author: "",
            series: meta.series,
            series_chapter: meta.series_chapter,
            date: new Date().toISOString().slice(0, 10),
        },
        column_1: [
            {
                type: "paragraph",
                content: "Escribe aquí",
                style_indexes: DEFAULT_STYLE_INDEXES,
            },
        ],
        column_2: [] as PamphletItem[],
        column_3: [] as PamphletItem[],
        column_4: [] as PamphletItem[],
        column_5: [] as PamphletItem[],
        column_6: [] as PamphletItem[],
        column_7: [] as PamphletItem[],
        column_8: [] as PamphletItem[],
    };
    return pamphlet;
}

export function itemTypeToTag(type: PamphletItemType): string {
    return type === "heading_1" ? "h1" : "p";
}

export function tagToItemType(tag: string): PamphletItemType {
    return tag.toLowerCase() === "h1" ? "heading_1" : "paragraph";
}
