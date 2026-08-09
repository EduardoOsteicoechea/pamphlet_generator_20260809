// ./pamphlet_content_items.ts

import './paragraph.css';



class BaseElement {
    htmlElement: HTMLElement | null = null;
    characterCount: number = 0;
    isRendered: boolean = false;
    parent: HTMLElement | null; // Made nullable so we can clear it during cleanup
    height: number = 0;

    constructor(parent: HTMLElement) {
        this.parent = parent;
    }

    extractData() {
        this.render();
        this.height = this.calculateHeight();
        // this.characterCount = content.length;
    }

    setContent(content: HTMLElement) {
        if (!content) throw new Error("Null content provided"); 
        
        this.htmlElement = content;
        this.extractData();
    }

    render(): void {
        if (!this.parent) throw new Error("Null parent element received");
        if (!this.htmlElement) throw new Error("Null element");

        this.parent.appendChild(this.htmlElement);
        this.isRendered = true;
    }

    calculateHeight(): number {
        if (!this.isRendered || !this.htmlElement) {
            throw new Error("Not rendered yet");
        }

        return this.convertPixelsToMillimeters(
            this.htmlElement.getBoundingClientRect().height
        );
    }

    convertPixelsToMillimeters(value: number): number {
        return value * (25.4 / 96);
    }

    destroy(): void {
        // 1. Remove the element from the live DOM
        if (this.htmlElement) {
            this.htmlElement.remove();
            this.htmlElement = null;
        }

        // 2. Sever the reference to the parent DOM node
        this.parent = null;

        // 3. Reset internal states to prevent logic bugs if referenced later
        this.isRendered = false;
        this.characterCount = 0;
        this.height = 0;
    }
}

export default class Paragraph extends BaseElement {
    constructor(parent: HTMLElement) {
        super(parent);
    }
}