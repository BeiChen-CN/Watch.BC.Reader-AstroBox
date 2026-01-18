import AstroBox, { PickFileReturn } from "astrobox-plugin-sdk";
import InterHandshake from "./handshake";
import InterFile from "./sendFile";
import { formatBytes, getFileName } from "./utils";
import { UINode } from "./types";

let interconn: InterHandshake;
let fileSender: InterFile;
let file: PickFileReturn | null = null;
let lastUIUpdateTime: number = 0;

const pickFile = AstroBox.native.regNativeFun(() => onPick());
const sendFile = AstroBox.native.regNativeFun(() => handleSend());
const cancelSend = AstroBox.native.regNativeFun(() => handleCancelSend());

const ui: UINode[] = [
    {
        node_id: "pickFile",
        visibility: true,
        disabled: false,
        content: {
            type: "Button",
            value: {
                primary: true,
                text: "选择文件",
                callback_fun_id: pickFile
            }
        }
    }, {
        node_id: "send",
        visibility: true,
        disabled: true,
        content: {
            type: "Button",
            value: {
                primary: true,
                text: "发送文件",
                callback_fun_id: sendFile
            }
        }
    }, {
        node_id: "filename",
        visibility: true,
        disabled: false,
        content: {
            type: "Text",
            value: `未选择文件`
        }
    }, {
        node_id: "tip",
        visibility: true,
        disabled: false,
        content: {
            type: "Text",
            value: `请选择 TXT 电子书文件`
        }
    }
];

function updateUI() {
    (AstroBox.ui as any).updatePluginSettingsUI(ui);
}

AstroBox.lifecycle.onLoad(() => {
    console.log("Plugin on LOAD!");
    updateUI();
    interconn = new InterHandshake("Watch.BC.Reader");
    fileSender = new InterFile(interconn);
});
async function onPick() {
    try {
        if (file?.path) await AstroBox.filesystem.unloadFile(file.path);
    } catch (error: any) {
        console.error(error);
        (ui[2].content as any).value = error.message;
        updateUI();
    }
    file = await AstroBox.filesystem.pickFile({
        decode_text: true,
    });

    // 获取不含扩展名的文件名作为书名
    const fileName = getFileName(file.path);

    ui[2] = {
        node_id: "filename",
        visibility: true,
        disabled: false,
        content: {
            type: "Text",
            value: `${fileName}\n${formatBytes(file.size)}`
        }
    };
    ui[1].disabled = false;
    updateUI();
}
async function handleSend() {
    if (!file) return;
    ui[0].disabled = true;
    (ui[1].content as any).value.text = "取消";
    (ui[1].content as any).value.callback_fun_id = cancelSend;
    updateUI();
    try {
        const appList = await AstroBox.thirdpartyapp.getThirdPartyAppList();
        const app = appList.find(app => app.package_name == "Watch.BC.Reader");
        if (!app) {
            (ui[2].content as any).value = "请先安装 BcReader 快应用";
            return updateUI();
        }
        await AstroBox.thirdpartyapp.launchQA(app, "Watch.BC.Reader");
        await new Promise(resolve => setTimeout(resolve, 3000));
        // 使用文件名（去除扩展名）作为书名
        const bookName = getFileName(file.path).replace(/\.[^/.]+$/, "");
        await fileSender.sendFile(bookName, file.path, file.size, file.text_len, onprogress, onsuccess, onerror);
    } catch (error: any) {
        console.error(error);
        (ui[2].content as any).value = error.message;
        updateUI();
    }
}
async function handleCancelSend() {
    fileSender.cancel();
    ui[0].disabled = false;
    (ui[1].content as any).value.text = "发送文件";
    (ui[1].content as any).value.callback_fun_id = sendFile;
    updateUI();
}
function onprogress(progress: number, status: string) {
    const currentTime = Date.now();
    if (currentTime - lastUIUpdateTime > 200) {
        (ui[2].content as any).value = `${status} ${(progress * 100).toFixed(2)}%`;
        updateUI();
        lastUIUpdateTime = currentTime;
    }
}
function onsuccess(message: string, count: number) {
    (ui[2].content as any).value = `发送成功: ${message}`;
    updateUI();
}
function onerror(message: string, count: number) {
    (ui[2].content as any).value = `发送失败: ${message}`;
    updateUI();
}
