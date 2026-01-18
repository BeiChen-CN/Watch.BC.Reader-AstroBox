import { PickFileReturn } from "astrobox-plugin-sdk";

export interface UINode {
    node_id: string;
    visibility: boolean;
    disabled: boolean;
    content: UIContent;
}

export type UIContent = TextContent | ButtonContent;

export interface TextContent {
    type: "Text";
    value: string;
}

export interface ButtonContent {
    type: "Button";
    value: {
        primary: boolean;
        text: string;
        callback_fun_id: string;
    };
}

export interface FileState {
    file: PickFileReturn | null;
    isSending: boolean;
}
