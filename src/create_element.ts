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

export default function CreateElement(
    tag: string,
    id: string,
    classes: string[],
    attributes: { key: string, value: string }[],
    content: string,
): HTMLElement {
    const elContainer: HTMLElement = document.createElement("div");
    
    elContainer.className = "pamphlet-item";
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

    classes.forEach(c => el.classList.add(c));
    attributes.forEach(att => el.setAttribute(att.key, att.value));

    el.textContent = content;

    el.addEventListener("click", () => {
        editTray(elContainer, el, id);
    });

    return elContainer;
}

function editTray(elContainer: HTMLElement, el: HTMLElement, id: string) {
    if (elContainer.querySelector(".element_edit_tray")) return;

    const initialContent = el.textContent || "";

    const editTray = document.createElement("div");
    if (id) editTray.id = `${id}_edit_tray`;
    editTray.className = "element_edit_tray";
    
    editTray.addEventListener("click", (trayEvent: PointerEvent) => {
        trayEvent.stopPropagation();
    });

    const editTrayButtonsTray = document.createElement("div");
    editTrayButtonsTray.className = "element_edit_tray_buttons_container";

    const enboldButton = document.createElement("button");
    enboldButton.type = "button";
    enboldButton.classList.add("edit_tray_icon_button", "edit_tray_text_button");
    enboldButton.textContent = "B";
    enboldButton.setAttribute("aria-label", "Bold");
    enboldButton.title = "Bold";
    
    // --- Move Up Button ---
    const upButton = document.createElement("button");
    setButtonIcon(upButton, ICONS.arrowUp, "Move up");
    upButton.addEventListener("click", () => {
        const prevSibling = elContainer.previousElementSibling;
        if (prevSibling) {
            editTray.remove(); // 1. Close current tray
            prevSibling.before(elContainer); // 2. Move
            elContainer.dispatchEvent(new CustomEvent("item-edited", { bubbles: true })); // 3. Reflow columns
            el.click(); // 4. Re-open tray automatically
        }
    });
    
    // --- Move Down Button ---
    const downButton = document.createElement("button");
    setButtonIcon(downButton, ICONS.arrowDown, "Move down");
    downButton.addEventListener("click", () => {
        const nextSibling = elContainer.nextElementSibling;
        if (nextSibling) {
            editTray.remove(); 
            nextSibling.after(elContainer);
            elContainer.dispatchEvent(new CustomEvent("item-edited", { bubbles: true })); 
            el.click(); 
        }
    });

    // --- Create NEW Element Before (+UP) ---
    const addUpButton = document.createElement("button");
    setButtonIcon(addUpButton, ICONS.addRowAbove, "Add above");
    addUpButton.addEventListener("click", () => {
        editTray.remove(); // Close current tray
        
        const currentTag = el.tagName.toLowerCase();
        const currentClasses = Array.from(el.classList);
        const newElementContainer = CreateElement(currentTag, "", currentClasses, [], "New text");
        
        elContainer.before(newElementContainer);
        elContainer.dispatchEvent(new CustomEvent("item-edited", { bubbles: true }));
        
        // Find the inner element of the newly created container and click it
        const newInnerElement = newElementContainer.firstElementChild as HTMLElement;
        if (newInnerElement) newInnerElement.click();
    });

    // --- Create NEW Element After (+DOWN) ---
    const addDownButton = document.createElement("button");
    setButtonIcon(addDownButton, ICONS.addRowBelow, "Add below");
    addDownButton.addEventListener("click", () => {
        editTray.remove(); // Close current tray
        
        const currentTag = el.tagName.toLowerCase();
        const currentClasses = Array.from(el.classList);
        const newElementContainer = CreateElement(currentTag, "", currentClasses, [], "New text");
        
        elContainer.after(newElementContainer);
        elContainer.dispatchEvent(new CustomEvent("item-edited", { bubbles: true }));
        
        // Find the inner element of the newly created container and click it
        const newInnerElement = newElementContainer.firstElementChild as HTMLElement;
        if (newInnerElement) newInnerElement.click();
    });

    const editTrayTextArea = document.createElement("textarea");
    editTrayTextArea.value = initialContent; 
    editTrayTextArea.classList.add("edit_tray_text_area");
    
    editTrayTextArea.addEventListener("input", (e: Event) => {
        const target = e.target as HTMLTextAreaElement;
        el.textContent = target.value; 
    });

    // --- Undo Button ---
    const undoButton = document.createElement("button");
    setButtonIcon(undoButton, ICONS.undo, "Undo");
    undoButton.addEventListener("click", () => {
        editTrayTextArea.value = initialContent;
        el.textContent = initialContent;
    });

    const deleteButton = document.createElement("button");
    setButtonIcon(deleteButton, ICONS.delete, "Delete");
    deleteButton.classList.add("edit_tray_delete_button");
    deleteButton.addEventListener("click", () => {
        const parent = elContainer.parentElement;
        elContainer.remove(); 
        
        if (parent) {
            parent.dispatchEvent(new CustomEvent("item-edited", { bubbles: true }));
        }
    });

    // --- Close Button ---
    const editTrayCloseButton = document.createElement("button");
    setButtonIcon(editTrayCloseButton, ICONS.check, "Save and close");
    editTrayCloseButton.classList.add("edit_tray_close_button");
    editTrayCloseButton.addEventListener("click", () => {
        editTray.remove();
        elContainer.dispatchEvent(new CustomEvent("item-edited", { bubbles: true }));
        elContainer.dispatchEvent(new CustomEvent("pamphlet-save", { bubbles: true }));
    });

    editTrayButtonsTray.appendChild(editTrayCloseButton);
    editTrayButtonsTray.appendChild(upButton);
    editTrayButtonsTray.appendChild(downButton);
    editTrayButtonsTray.appendChild(addUpButton);
    editTrayButtonsTray.appendChild(addDownButton);
    editTrayButtonsTray.appendChild(enboldButton);
    editTrayButtonsTray.appendChild(undoButton);
    editTrayButtonsTray.appendChild(deleteButton);

    editTray.appendChild(editTrayButtonsTray);
    editTray.appendChild(editTrayTextArea);

    elContainer.appendChild(editTray);

    // Focus the text area and place the cursor at the end of the text
    editTrayTextArea.focus();
    editTrayTextArea.setSelectionRange(editTrayTextArea.value.length, editTrayTextArea.value.length);
}