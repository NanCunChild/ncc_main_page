// browser-linux.js
// Drop-in embed for the v86 browser-linux image.
//
// Usage:
//
//   <script src="libv86.js"></script>
//   <script src="browser-linux.js"></script>
//   <script>
//     const linux = new BrowserLinux({
//       v86Base:   "/v86/",        // dir containing v86.wasm, seabios.bin
//       imageBase: "/image/",      // dir containing bzImage, rootfs.squashfs
//       container: "#term",        // DOM element or CSS selector for output
//       input:     "#cmd",         // DOM element or CSS selector for keyboard input
//     });
//     linux.boot();
//   </script>
//
// API:
//   new BrowserLinux(opts)
//   linux.boot()                start the VM (idempotent)
//   linux.reset()               restart the VM
//   linux.destroy()             tear down (removes listeners, stops CPU)
//   linux.send(str)             send a string to ttyS0 stdin
//   linux.uploadFile(File)      copy a File into /mnt/web/<name>
//   linux.clear()               clear the on-screen terminal (does NOT clear VM)
//
// Events (set via opts callbacks):
//   onStatus(string)            "loaded", "CPU running", etc.
//   onByte(number)              raw byte from ttyS0 (after our state machine sees it)
//   onText(string)              printable text after ANSI-strip; same as what we put in DOM
//

(function (global) {
"use strict";

// Default cmdline that boots cleanly under v86. Tested on the official copy.sh
// build of libv86. Tweak if your setup needs different params.
const DEFAULT_CMDLINE =
    "root=/dev/sda rootfstype=squashfs ro " +
    "console=ttyS0,115200 " +
    "noapic nolapic notsc " +
    "8250.nr_uarts=1 8250.skip_txen_test=1";

function $(sel) {
    if (sel == null) return null;
    if (typeof sel === "string") return document.querySelector(sel);
    return sel;  // already an element
}

function joinPath(base, name) {
    if (!base) return name;
    return base.endsWith("/") ? base + name : base + "/" + name;
}

// -------------------------------------------------------------------
// ANSI escape stripping state machine.
// Operates byte-by-byte; keeps state across calls so partial sequences
// (e.g., split across two events) still work.
//
// Recognised:
//   ESC [ ... <final>   CSI (final byte 0x40-0x7e)         — color, cursor, etc.
//   ESC ] ... BEL/ST    OSC (terminator BEL=0x07 or ESC \) — window title etc.
//   ESC <any>           generic 2-byte ESC sequences
// Plain control chars (\b, DEL, …) are also dropped to avoid weird artefacts
// in the plain-DIV terminal. \r \n \t pass through.
// -------------------------------------------------------------------
function makeAnsiStripper() {
    let state = 0; // 0=normal 1=after-ESC 2=in-CSI 3=in-OSC 4=OSC-saw-ESC
    return function step(c) {
        switch (state) {
        case 0:
            if (c === 0x1b) { state = 1; return ""; }
            // Drop most control bytes; keep \b? — drop, no useful behaviour in plain DIV
            if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) return "";
            if (c === 0x7f) return "";
            return String.fromCharCode(c);
        case 1: // after ESC
            if (c === 0x5b /* '[' */) { state = 2; return ""; }
            if (c === 0x5d /* ']' */) { state = 3; return ""; }
            state = 0; return "";
        case 2: // CSI
            if (c >= 0x40 && c <= 0x7e) state = 0;
            return "";
        case 3: // OSC
            if (c === 0x07) { state = 0; return ""; }
            if (c === 0x1b) { state = 4; return ""; }
            return "";
        case 4: // OSC saw ESC, expect '\'
            state = 0;
            return "";
        }
        return "";
    };
}

// -------------------------------------------------------------------
class BrowserLinux {
    constructor(opts) {
        opts = opts || {};

        this.opts = {
            v86Base:    opts.v86Base    || "",
            imageBase:  opts.imageBase  || "",
            container:  $(opts.container),
            input:      $(opts.input),
            cmdline:    opts.cmdline    || DEFAULT_CMDLINE,
            memoryMB:   opts.memoryMB   || 128,
            onStatus:   opts.onStatus   || (() => {}),
            onByte:     opts.onByte     || null,
            onText:     opts.onText     || null,
        };

        this.emulator   = null;
        this.outBytes   = 0;

        // Output batching — see flush() and queueAppend().
        this._pending     = [];
        this._pendingLen  = 0;
        this._flushQueued = false;
        this._termCap     = 64 * 1024;

        this._stripByte = makeAnsiStripper();

        // Bind so we can pass to addEventListener / removeEventListener.
        this._onKeyDown = this._onKeyDown.bind(this);
    }

    // ---- public API ----
    boot() {
        if (this.emulator) return;

        const o = this.opts;
        o.onStatus("constructing");

        this.emulator = new V86({
            wasm_path:        joinPath(o.v86Base, "v86.wasm"),
            memory_size:      o.memoryMB * 1024 * 1024,
            vga_memory_size:  2 * 1024 * 1024,
            autostart:        true,
            disable_keyboard: true,                 // we drive ttyS0, not the PS/2 KBD
            disable_mouse:    true,
            screen_container: null,

            bios:    { url: joinPath(o.v86Base,   "seabios.bin") },
            bzimage: { url: joinPath(o.imageBase, "bzImage") },
            cmdline: o.cmdline,

            hda:     { url: joinPath(o.imageBase, "rootfs.squashfs"), async: true },
            filesystem: {},
        });

        this.emulator.add_listener("serial0-output-byte", b => this._handleByte(b));

        this.emulator.add_listener("emulator-loaded",  () => o.onStatus("loaded"));
        this.emulator.add_listener("emulator-ready",   () => o.onStatus("ready"));
        this.emulator.add_listener("emulator-started", () => o.onStatus("CPU running"));
        this.emulator.add_listener("download-progress", d => {
            const p = (d.loaded || 0) + "/" + (d.total || "?");
            o.onStatus("downloading " + (d.file_name || "") + " " + p);
        });
        this.emulator.add_listener("download-error", e => {
            o.onStatus("download error");
            this._appendText("\n[download-error] " + JSON.stringify(e) + "\n");
        });

        if (o.input) o.input.addEventListener("keydown", this._onKeyDown);
    }

    reset() {
        if (!this.emulator) return;
        this.emulator.restart();
        this.outBytes = 0;
        this._appendText("\n[reset]\n");
        this.opts.onStatus("restarted");
    }

    destroy() {
        if (this.opts.input) this.opts.input.removeEventListener("keydown", this._onKeyDown);
        if (this.emulator) {
            // v86 doesn't have a destroy in all builds; best-effort stop.
            if (typeof this.emulator.stop === "function") this.emulator.stop();
            if (typeof this.emulator.destroy === "function") this.emulator.destroy();
        }
        this.emulator = null;
    }

    send(s) {
        if (this.emulator && typeof this.emulator.serial0_send === "function") {
            this.emulator.serial0_send(s);
        }
    }

    async uploadFile(file) {
        if (!this.emulator || !this.emulator.fs9p) {
            this._appendText("[fs9p not ready]\n");
            return false;
        }
        const buf = new Uint8Array(await file.arrayBuffer());
        this.emulator.create_file("/" + file.name, buf);
        this._appendText("[uploaded " + file.name + " (" + buf.length + " bytes) → /mnt/web/" + file.name + "]\n");
        return true;
    }

    // Read a file from the 9P share back into JS. Path is relative to the
    // share root, i.e. "foo.txt" in JS == "/mnt/web/foo.txt" in the VM.
    // Returns Uint8Array on success, null if 9P isn't ready.
    async readFile(path) {
        if (!this.emulator || !this.emulator.fs9p) return null;
        // Strip any leading slashes so callers can pass either form.
        const p = path.replace(/^\/+/, "");
        return await this.emulator.read_file("/" + p);
    }

    clear() {
        this._pending = []; this._pendingLen = 0;
        if (this.opts.container) this.opts.container.textContent = "";
    }

    // ---- internal ----
    _onKeyDown(e) {
        if (!this.emulator) return;
        const o = this.opts;
        if (e.key === "Enter") {
            this.send(o.input.value + "\n");
            o.input.value = "";
            e.preventDefault();
        } else if (e.key === "Tab") {
            this.send("\t");
            e.preventDefault();
        } else if (e.ctrlKey && e.key.length === 1) {
            const ch = e.key.toLowerCase();
            if (ch === "c") { this.send("\x03"); e.preventDefault(); }
            else if (ch === "d") { this.send("\x04"); e.preventDefault(); }
            else if (ch === "l") { this.send("\x0c"); e.preventDefault(); }
        }
    }

    _handleByte(b) {
        this.outBytes++;
        if (this.opts.onByte) this.opts.onByte(b);
        const out = this._stripByte(b);
        if (out !== "") this._appendText(out);
    }

    _appendText(s) {
        if (this.opts.onText) this.opts.onText(s);
        if (!this.opts.container) return;
        this._pending.push(s);
        this._pendingLen += s.length;
        if (this._pendingLen > 4096) {
            this._pending = [this._pending.join("")];
        }
        if (!this._flushQueued) {
            this._flushQueued = true;
            requestAnimationFrame(() => this._flush());
        }
    }

    _flush() {
        this._flushQueued = false;
        if (this._pendingLen === 0) return;
        const chunk = this._pending.length === 1 ? this._pending[0] : this._pending.join("");
        this._pending = []; this._pendingLen = 0;

        const el = this.opts.container;
        let next = el.textContent + chunk;
        if (next.length > this._termCap) {
            next = next.slice(next.length - Math.floor(this._termCap * 0.8));
        }
        el.textContent = next;
        el.scrollTop   = el.scrollHeight;
    }
}

global.BrowserLinux = BrowserLinux;

})(typeof window !== "undefined" ? window : globalThis);
