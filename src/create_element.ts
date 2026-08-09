export type EditTrayMode = "full" | "header";

export type PamphletTrayAction =
    | { action: "edit-open"; container: HTMLElement }
    | { action: "close"; container: HTMLElement }
    | { action: "move-up"; container: HTMLElement }
    | { action: "move-down"; container: HTMLElement }
    | { action: "add-above"; container: HTMLElement }
    | { action: "add-below"; container: HTMLElement }
    | { action: "bold"; container: HTMLElement; start: number; end: number }
    | { action: "undo"; container: HTMLElement }
    | { action: "delete"; container: HTMLElement };

export interface CreateElementOptions {
    trayMode?: EditTrayMode;
    headerField?: string;
    extraClasses?: string[];
}

const ICONS = {
    check: "/check_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    arrowUp: "/arrow_upward_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    arrowDown: "/arrow_downward_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    addRowAbove: "/add_row_above_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    addRowBelow: "/add_row_below_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    undo: "/undo_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
    delete: "/delete_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg",
} as const;

function setButtonIcon(button: HTMLButtonElement, src: string, label: string): void {
    button.replaceChildren();
    button.type = "button";
    button.classList.add("edit_tray_icon_button");
    button.setAttribute("aria-label", label);
    button.title = label;

    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    img.className = "edit_tray_icon";
    img.draggable = false;
    button.appendChild(img);
}

function dispatchTrayAction(target: HTMLElement, detail: PamphletTrayAction): void {
    target.dispatchEvent(
        new CustomEvent<PamphletTrayAction>("pamphlet-tray-action", {
            bubbles: true,
            detail,
        }),
    );
}

export default function CreateElement(
    tag: string,
    id: string,
    classes: string[],
    attributes: { key: string, value: string }[],
    content: string,
    options: CreateElementOptions = {},
): HTMLElement {
    const trayMode = options.trayMode ?? "full";
    const elContainer: HTMLElement = document.createElement("div");

    elContainer.className = "pamphlet-item";
    if (options.extraClasses?.length) {
        elContainer.classList.add(...options.extraClasses);
    }
    elContainer.setAttribute("data-tray-mode", trayMode);
    if (options.headerField) {
        elContainer.setAttribute("data-header-field", options.headerField);
    }
    elContainer.setAttribute(
        "data-item-type",
        tag.toLowerCase() === "h1" ? "heading_1" : "paragraph",
    );
    elContainer.setAttribute(
        "data-style-indexes",
        JSON.stringify([[0, 0], [0, 0], [0, 0]]),
    );

    const el: HTMLElement = document.createElement(tag);
    elContainer.appendChild(el);

    if (id) {
        el.id = id;
        elContainer.id = `${id}_container`;
    }

    classes.forEach((c) => el.classList.add(c));
    attributes.forEach((att) => el.setAttribute(att.key, att.value));
    el.textContent = content;

    el.addEventListener("click", () => {
        editTray(elContainer, el, id, trayMode);
    });

    return elContainer;
}

function editTray(
    elContainer: HTMLElement,
    el: HTMLElement,
    id: string,
    trayMode: EditTrayMode,
) {
    if (elContainer.querySelector(".element_edit_tray")) return;

    dispatchTrayAction(elContainer, { action: "edit-open", container: elContainer });

    const initialContent = el.textContent || "";

    const tray = document.createElement("div");
    if (id) tray.id = `${id}_edit_tray`;
    tray.className = "element_edit_tray";

    tray.addEventListener("click", (trayEvent: PointerEvent) => {
        trayEvent.stopPropagation();
    });

    const editTrayButtonsTray = document.createElement("div");
    editTrayButtonsTray.className = "element_edit_tray_buttons_container";

    const editTrayTextArea = document.createElement("textarea");
    editTrayTextArea.value = initialContent;
    editTrayTextArea.classList.add("edit_tray_text_area");

    editTrayTextArea.addEventListener("input", (e: Event) => {
        const target = e.target as HTMLTextAreaElement;
        el.textContent = target.value;
    });

    const saveAndClose = () => {
        dispatchTrayAction(elContainer, { action: "close", container: elContainer });
    };

    editTrayTextArea.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            saveAndClose();
            return;
        }
        if (e.key === "Escape") {
            e.preventDefault();
            saveAndClose();
        }
    });

    const editTrayCloseButton = document.createElement("button");
    setButtonIcon(editTrayCloseButton, ICONS.check, "Save and close");
    editTrayCloseButton.classList.add("edit_tray_close_button");
    editTrayCloseButton.addEventListener("click", () => {
        saveAndClose();
    });

    const undoButton = document.createElement("button");
    setButtonIcon(undoButton, ICONS.undo, "Undo");
    undoButton.addEventListener("click", () => {
        if (trayMode === "header") {
            editTrayTextArea.value = initialContent;
            el.textContent = initialContent;
            return;
        }
        dispatchTrayAction(elContainer, { action: "undo", container: elContainer });
    });

    editTrayButtonsTray.appendChild(editTrayCloseButton);

    if (trayMode === "full") {
        const upButton = document.createElement("button");
        setButtonIcon(upButton, ICONS.arrowUp, "Move up");
        upButton.addEventListener("click", () => {
            dispatchTrayAction(elContainer, { action: "move-up", container: elContainer });
        });

        const downButton = document.createElement("button");
        setButtonIcon(downButton, ICONS.arrowDown, "Move down");
        downButton.addEventListener("click", () => {
            dispatchTrayAction(elContainer, { action: "move-down", container: elContainer });
        });

        const addUpButton = document.createElement("button");
        setButtonIcon(addUpButton, ICONS.addRowAbove, "Add above");
        addUpButton.addEventListener("click", () => {
            dispatchTrayAction(elContainer, { action: "add-above", container: elContainer });
        });

        const addDownButton = document.createElement("button");
        setButtonIcon(addDownButton, ICONS.addRowBelow, "Add below");
        addDownButton.addEventListener("click", () => {
            dispatchTrayAction(elContainer, { action: "add-below", container: elContainer });
        });

        const enboldButton = document.createElement("button");
        enboldButton.type = "button";
        enboldButton.classList.add("edit_tray_icon_button", "edit_tray_text_button");
        enboldButton.textContent = "B";
        enboldButton.setAttribute("aria-label", "Bold");
        enboldButton.title = "Bold";
        enboldButton.addEventListener("click", () => {
            dispatchTrayAction(elContainer, {
                action: "bold",
                container: elContainer,
                start: editTrayTextArea.selectionStart,
                end: editTrayTextArea.selectionEnd,
            });
        });

        const deleteButton = document.createElement("button");
        setButtonIcon(deleteButton, ICONS.delete, "Delete");
        deleteButton.classList.add("edit_tray_delete_button");
        deleteButton.addEventListener("click", () => {
            dispatchTrayAction(elContainer, { action: "delete", container: elContainer });
        });

        editTrayButtonsTray.appendChild(upButton);
        editTrayButtonsTray.appendChild(downButton);
        editTrayButtonsTray.appendChild(addUpButton);
        editTrayButtonsTray.appendChild(addDownButton);
        editTrayButtonsTray.appendChild(enboldButton);
        editTrayButtonsTray.appendChild(undoButton);
        editTrayButtonsTray.appendChild(deleteButton);
    } else {
        editTrayButtonsTray.appendChild(undoButton);
    }

    tray.appendChild(editTrayButtonsTray);
    tray.appendChild(editTrayTextArea);
    elContainer.appendChild(tray);

    editTrayTextArea.focus();
    editTrayTextArea.setSelectionRange(
        editTrayTextArea.value.length,
        editTrayTextArea.value.length,
    );
}
