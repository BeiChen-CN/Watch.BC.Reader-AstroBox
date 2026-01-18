import AstroBox from "astrobox-plugin-sdk";
import InterHandshake from "./handshake";
import { formatBytes } from "./utils";

interface ChapterForTransfer {
    index: number;
    name: string;
    content: string;
    wordCount: number;
    chunkNum: number;
    totalChunks: number;
}

interface StartTransferData {
    stat: "startTransfer";
    filename: string;
    total: number;
    wordCount: number;
    startFrom: number;
    chapterIndices: number[];
    hasCover: boolean;
}

interface DataChunkData {
    stat: "d";
    count: number;
    data: string;
}

interface ChapterCompleteData {
    stat: "chapter_complete";
    count: number;
}

interface TransferCompleteData {
    stat: "transfer_complete";
}

interface CancelData {
    stat: "cancel";
}

type FileMessageFromDevice =
    | { type: "ready"; usage: number; count: number }
    | { type: "error"; message: string; count: number }
    | { type: "success"; message: string; count: number }
    | { type: "next"; message: string; count: number }
    | { type: "next_chunk" }
    | { type: "chapter_chunk_complete" }
    | { type: "chapter_saved"; count: number; syncedCount: number; totalCount: number; progress: number }
    | { type: "transfer_finished" }
    | { type: "cancel" };

export default class File {
    private readonly conn: InterHandshake;
    private readonly CHUNK_SIZE = 10 * 1024;

    private busy: boolean = false;
    private lastChunkTime: number = 0;

    private chapters: Array<{ name: string; content: string; wordCount: number }> = [];
    private currentChapterIndex: number = 0;
    private currentChapterChunks: string[] = [];
    private currentChunkIndex: number = 0;
    private nextChunk: Promise<string> = Promise.resolve("");

    private onError: (message: string, count: number) => void = () => {};
    private onSuccess: (message: string, count: number) => void = () => {};
    private onProgress: (progress: number, status: string) => void = () => {};

    constructor(conn: InterHandshake) {
        this.conn = conn;

        this.conn.addListener<FileMessageFromDevice>("file", (message) => {
            if (!this.busy || !message) return;

            try {
                switch (message.type) {
                    case "ready":
                        if (message.usage > 25 * 1024 * 1024) {
                            this.onError("存储空间不足", 0);
                            this.resetState();
                            return;
                        }
                        this.sendNextChapter(0);
                        break;

                    case "error":
                        this.onError(message.message, message.count);
                        this.resetState();
                        break;

                    case "success":
                        this.onProgress(1.0, "传输完成");
                        this.onSuccess(message.message, message.count);
                        this.resetState();
                        break;

                    case "next":
                        this.sendNextChapter(message.count);
                        break;

                    case "next_chunk":
                        this.currentChunkIndex++;
                        this.sendCurrentChunk();
                        break;

                    case "chapter_chunk_complete":
                        this.sendChapterComplete();
                        break;

                    case "chapter_saved":
                        const nextIndex = this.currentChapterIndex + 1;
                        if (nextIndex >= this.chapters.length) {
                            this.sendTransferComplete();
                        } else {
                            this.sendNextChapter(nextIndex);
                        }
                        break;

                    case "transfer_finished":
                        this.onProgress(1.0, "传输完成");
                        this.onSuccess("传输完成", this.chapters.length);
                        this.resetState();
                        break;

                    case "cancel":
                        this.onSuccess("传输已取消", 0);
                        this.resetState();
                        break;
                }
            } catch (e: any) {
                console.error("Error processing file message:", message, e);
                this.onError("解析消息失败", 0);
                this.resetState();
            }
        });
    }

    public async sendFile(
        filename: string,
        path: string,
        size: number,
        text_len: number,
        onProgress: (progress: number, status: string) => void,
        onSuccess: (message: string, count: number) => void,
        onError: (message: string, count: number) => void,
    ) {
        if (this.busy) {
            onError("传输正在进行中", 0);
            return;
        }

        this.busy = true;
        this.onProgress = onProgress;
        this.onSuccess = onSuccess;
        this.onError = onError;
        this.lastChunkTime = 0;

        onProgress(0.0, "正在读取文件...");

        try {
            const content = await AstroBox.filesystem.readFile(path, {
                len: text_len,
                decode_text: true,
            }) as string;

            this.chapters = this.parseChapters(content, filename);

            if (this.chapters.length === 0) {
                onError("未找到章节", 0);
                this.resetState();
                return;
            }

            onProgress(0.0, `准备发送 ${this.chapters.length} 个章节...`);

            const totalWordCount = this.chapters.reduce((sum, ch) => sum + ch.wordCount, 0);
            const chapterIndices = this.chapters.map((_, i) => i);
            const startMessage: StartTransferData = {
                stat: "startTransfer",
                filename: filename,
                total: this.chapters.length,
                wordCount: totalWordCount,
                startFrom: 0,
                chapterIndices: chapterIndices,
                hasCover: false
            };

            await this.conn.send("file", startMessage);
        } catch (e: any) {
            this.onError(`文件读取失败: ${e.message}`, 0);
            this.resetState();
        }
    }

    private parseChapters(content: string, filename: string): Array<{ name: string; content: string; wordCount: number }> {
        const chapters: Array<{ name: string; content: string; wordCount: number }> = [];
        const chapterRegex = /第[零一二三四五六七八九十百千万\d]+[章节回]/g;
        const matches = [...content.matchAll(chapterRegex)];

        if (matches.length === 0) {
            return [{
                name: filename,
                content: content,
                wordCount: content.length
            }];
        }

        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const startIndex = match.index!;
            const endIndex = i < matches.length - 1 ? matches[i + 1].index! : content.length;
            const chapterContent = content.substring(startIndex, endIndex).trim();
            const chapterName = match[0];

            chapters.push({
                name: chapterName,
                content: chapterContent,
                wordCount: chapterContent.length
            });
        }

        return chapters;
    }

    private async sendNextChapter(chapterIndex: number) {
        if (chapterIndex < 0 || chapterIndex >= this.chapters.length) {
            this.onError(`无效的章节索引: ${chapterIndex}`, chapterIndex);
            this.resetState();
            return;
        }

        this.currentChapterIndex = chapterIndex;
        const chapter = this.chapters[chapterIndex];

        this.currentChapterChunks = this.chunkString(chapter.content, this.CHUNK_SIZE);
        this.currentChunkIndex = 0;

        if (this.currentChapterChunks.length > 0) {
            this.nextChunk = Promise.resolve(this.currentChapterChunks[0]);
        }

        this.sendCurrentChunk();
    }

    private chunkString(str: string, size: number): string[] {
        const chunks: string[] = [];
        for (let i = 0; i < str.length; i += size) {
            chunks.push(str.substring(i, i + size));
        }
        return chunks;
    }

    private async sendCurrentChunk() {
        if (this.currentChunkIndex >= this.currentChapterChunks.length) {
            console.error("sendCurrentChunk called in invalid state");
            return;
        }

        const chapter = this.chapters[this.currentChapterIndex];
        const chunkContent = await this.nextChunk;
        const totalChunks = this.currentChapterChunks.length;

        const chapterData: ChapterForTransfer = {
            index: this.currentChapterIndex,
            name: chapter.name,
            content: chunkContent,
            wordCount: chapter.wordCount,
            chunkNum: this.currentChunkIndex,
            totalChunks: totalChunks
        };

        const dataString = JSON.stringify(chapterData);
        const message: DataChunkData = {
            stat: "d",
            count: this.currentChapterIndex,
            data: dataString
        };

        const currentTime = Date.now();

        if (this.currentChunkIndex + 1 < totalChunks) {
            this.nextChunk = Promise.resolve(this.currentChapterChunks[this.currentChunkIndex + 1]);
        }

        try {
            await this.conn.send("file", message);

            const progress = (this.currentChapterIndex + (this.currentChunkIndex + 1) / totalChunks) / this.chapters.length;

            if (this.lastChunkTime !== 0) {
                const timeTaken = currentTime - this.lastChunkTime;
                if (timeTaken > 0) {
                    const speed = chunkContent.length / (timeTaken / 1000.0);
                    this.onProgress(
                        progress,
                        `${chapter.name} (${this.currentChunkIndex + 1}/${totalChunks}) ${formatBytes(speed)}/s`
                    );
                } else {
                    this.onProgress(progress, `${chapter.name} (${this.currentChunkIndex + 1}/${totalChunks})`);
                }
            } else {
                this.onProgress(progress, `${chapter.name} (${this.currentChunkIndex + 1}/${totalChunks})`);
            }
            this.lastChunkTime = currentTime;
        } catch (e: any) {
            this.onError(`发送失败: ${e.message}`, this.currentChapterIndex);
            this.resetState();
        }
    }

    private async sendChapterComplete() {
        try {
            const message: ChapterCompleteData = {
                stat: "chapter_complete",
                count: this.currentChapterIndex
            };
            await this.conn.send("file", message);
        } catch (e: any) {
            this.onError(`章节完成命令发送失败: ${e.message}`, this.currentChapterIndex);
            this.resetState();
        }
    }

    private async sendTransferComplete() {
        try {
            const message: TransferCompleteData = {
                stat: "transfer_complete"
            };
            await this.conn.send("file", message);
        } catch (e: any) {
            console.error("Failed to send transfer_complete", e);
            this.onProgress(1.0, "传输完成");
            this.onSuccess("传输完成", this.chapters.length);
            this.resetState();
        }
    }

    public cancel() {
        if (!this.busy) return;

        const message: CancelData = { stat: "cancel" };
        this.conn.send("file", message).catch(e => {
            console.error("发送取消消息失败", e);
        });
        this.resetState();
    }

    private resetState() {
        this.busy = false;
        this.chapters = [];
        this.currentChapterIndex = 0;
        this.currentChapterChunks = [];
        this.currentChunkIndex = 0;
        this.lastChunkTime = 0;
        this.nextChunk = Promise.resolve("");
    }
}
