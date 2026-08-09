import CreateElement from "./create_element";
import {
    COLUMN_KEYS,
    DEFAULT_STYLE_INDEXES,
    itemTypeToTag,
    tagToItemType,
    type PamphletHeader,
    type PamphletItem,
    type PamphletStructure,
    type StyleIndexes,
} from "./pamphlet_schema";

const STYLE_INDEXES_ATTR = "data-style-indexes";
const ITEM_TYPE_ATTR = "data-item-type";

function parseStyleIndexes(raw: string | null): StyleIndexes {
    if (!raw) return DEFAULT_STYLE_INDEXES;
    try {
        const parsed = JSON.parse(raw) as StyleIndexes;
        return parsed;
    } catch {
        return DEFAULT_STYLE_INDEXES;
    }
}

function applyItemMeta(container: HTMLElement, item: PamphletItem): void {
    container.setAttribute(ITEM_TYPE_ATTR, item.type);
    container.setAttribute(STYLE_INDEXES_ATTR, JSON.stringify(item.style_indexes));
}

export function createItemElement(item: PamphletItem): HTMLElement {
    const tag = itemTypeToTag(item.type);
    const container = CreateElement(tag, "", [], [], item.content);
    applyItemMeta(container, item);
    return container;
}

export function renderFromPamphlet(main: HTMLElement, data: PamphletStructure): void {
    main.innerHTML = "";

    COLUMN_KEYS.forEach((key, index) => {
        const col = document.createElement("div");
        col.className = `dumb-column pamphlet-column-${index + 1}`;
        main.appendChild(col);

        for (const item of data[key]) {
            col.appendChild(createItemElement(item));
        }
    });
}

function serializeItem(container: HTMLElement): PamphletItem {
    const inner = container.firstElementChild as HTMLElement | null;
    const tag = inner?.tagName ?? "P";
    const typeAttr = container.getAttribute(ITEM_TYPE_ATTR);
    const type = typeAttr === "heading_1" || typeAttr === "paragraph"
        ? typeAttr
        : tagToItemType(tag);

    return {
        type,
        content: inner?.textContent ?? "",
        style_indexes: parseStyleIndexes(container.getAttribute(STYLE_INDEXES_ATTR)),
    };
}

export function serializePamphlet(main: HTMLElement, header: PamphletHeader): PamphletStructure {
    const columns = Array.from(main.querySelectorAll<HTMLElement>(":scope > .dumb-column"));
    const pamphlet = {
        type: "pamphlet_single_sheet" as const,
        header: { ...header },
        column_1: [] as PamphletItem[],
        column_2: [] as PamphletItem[],
        column_3: [] as PamphletItem[],
        column_4: [] as PamphletItem[],
        column_5: [] as PamphletItem[],
        column_6: [] as PamphletItem[],
        column_7: [] as PamphletItem[],
        column_8: [] as PamphletItem[],
    };

    for (let i = 0; i < 8; i++) {
        const key = COLUMN_KEYS[i];
        const col = columns[i];
        if (!col) {
            pamphlet[key] = [];
            continue;
        }
        const items = Array.from(col.querySelectorAll<HTMLElement>(":scope > .pamphlet-item"));
        pamphlet[key] = items.map(serializeItem);
    }

    // Preserve content if reflow produced more than 8 columns
    for (let i = 8; i < columns.length; i++) {
        const extras = Array.from(
            columns[i].querySelectorAll<HTMLElement>(":scope > .pamphlet-item"),
        ).map(serializeItem);
        pamphlet.column_8.push(...extras);
    }

    return pamphlet;
}
